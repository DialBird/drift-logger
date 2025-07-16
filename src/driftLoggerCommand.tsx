import { Action, ActionPanel, closeMainWindow, getPreferenceValues, List, open, popToRoot } from "@raycast/api";
import { useEffect, useState } from "react";
import { format, parse } from "date-fns";
import {
  clearCache,
  getLastDriftLoggerEndTime,
  saveDriftLoggerEndTime,
  getTaskGroups,
  getSelectedTaskGroup,
  saveSelectedTaskGroupId,
  addTaskGroup,
  type TaskGroup,
} from "./api/cache/cache.service";
import { v4 as uuidv4 } from "uuid";
import { applyTemplates } from "./api/templating/templating.service";
import { vaultPluginCheck } from "./api/vault/plugins/plugins.service";
import AdvancedURIPluginNotInstalled from "./components/Notifications/AdvancedURIPluginNotInstalled";
import { NoPathProvided } from "./components/Notifications/NoPathProvided";
import { NoVaultFoundMessage } from "./components/Notifications/NoVaultFoundMessage";
import { vaultsWithoutAdvancedURIToast } from "./components/Toasts";
import { useObsidianVaults } from "./utils/hooks";
import type { appendTaskPreferences } from "./utils/preferences";
import { getObsidianTarget, ObsidianTargetType } from "./utils/utils";

interface appendTaskArgs {
  text: string;
  minutes?: string;
  startTime?: string;
}

// 時刻パース関数 (date-fnsを使用)
const parseTimeString = (timeStr: string): Date => {
  const today = new Date();

  if (timeStr.includes(":")) {
    // HH:mm フォーマット (例: "14:30")
    return parse(timeStr, "HH:mm", today);
  } else {
    // HHmm フォーマット (例: "1430")
    return parse(timeStr, "HHmm", today);
  }
};

export default function DriftLogger(props: { arguments: appendTaskArgs }) {
  const { vaults, ready } = useObsidianVaults();
  const { text, minutes, startTime: customStartTime } = props.arguments;

  // タスクグループ関連のstate
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>(getTaskGroups());
  const [selectedTaskGroup] = useState<TaskGroup | null>(getSelectedTaskGroup());

  // 特殊コマンド「pin」の処理
  if (text === "pin") {
    let timeToSave: Date;

    if (customStartTime) {
      timeToSave = parseTimeString(customStartTime);
    } else {
      timeToSave = new Date();
    }

    saveDriftLoggerEndTime(timeToSave);
    popToRoot();
    closeMainWindow();
    return <List isLoading={false} />;
  }

  // 現在時刻
  const now = new Date();

  // 開始時刻と分数の計算
  let startTime: Date;
  let calculatedMinutes: string;

  if (customStartTime && minutes) {
    // モード3: 開始時刻と分数が両方指定されている場合
    startTime = parseTimeString(customStartTime);
    calculatedMinutes = minutes;
  } else if (minutes) {
    // モード1: 分数のみ指定されている場合（現在の動作）
    startTime = new Date(now.getTime() - parseInt(minutes) * 60 * 1000);
    calculatedMinutes = minutes;
  } else {
    // モード2: 分数が指定されていない場合（前回の終了時刻から継続）
    const lastEndTime = getLastDriftLoggerEndTime();
    if (!lastEndTime) {
      throw new Error("最後の時間がわかりません");
    }

    startTime = lastEndTime;
    const diffMs = now.getTime() - lastEndTime.getTime();
    calculatedMinutes = Math.floor(diffMs / (1000 * 60)).toString();
  }

  // 終了時刻の計算（三番目の引数が指定されている場合は開始時刻 + 分数）
  const endTime = customStartTime && minutes ? new Date(startTime.getTime() + parseInt(minutes) * 60 * 1000) : now;

  const startTimeString = startTime.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  const endTimeString = endTime.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

  // ドリフトログ用のフォーマット関数
  // デイリーパス生成関数（同期版）
  const generateDailyPathSync = (): string => {
    if (!projectSettings.notePath) {
      return "";
    }

    const today = new Date();

    // date-fnsのformatを使用してテンプレート置換処理
    const dailyPath = format(today, projectSettings.notePath);

    return dailyPath;
  };

  // デイリーパス生成関数（非同期版、テンプレート処理付き）
  const generateDailyPath = async (): Promise<string> => {
    const dailyPath = generateDailyPathSync();
    if (!dailyPath) {
      return "";
    }
    return await applyTemplates(dailyPath);
  };

  const formatDriftLogEntry = (
    startTime: string,
    endTime: string,
    content: string,
    minutes: string,
    taskGroupName?: string
  ): string => {
    const taskGroupPrefix = taskGroupName ? `【${taskGroupName}】` : "";
    return `- ${startTime}~${endTime} (${minutes}min): ${taskGroupPrefix}${content}`;
  };

  const { appendTemplate, heading, notePath, vaultName, silent } = getPreferenceValues<appendTaskPreferences>();
  const [vaultsWithPlugin, vaultsWithoutPlugin] = vaultPluginCheck(vaults, "obsidian-advanced-uri");
  const [content, setContent] = useState<string | null>(null);

  // 全プロジェクト共通の設定を使用
  const projectSettings = { notePath, vaultName, heading };

  useEffect(() => {
    async function getContent() {
      const content = await applyTemplates(text, appendTemplate);
      setContent(content);
    }

    getContent();
  }, [appendTemplate, text]);

  if (!ready || content === null) {
    return <List isLoading={true} />;
  }

  if (vaults.length === 0) {
    return <NoVaultFoundMessage />;
  }

  if (vaultsWithoutPlugin.length > 0) {
    vaultsWithoutAdvancedURIToast(vaultsWithoutPlugin);
  }

  if (vaultsWithPlugin.length === 0) {
    return <AdvancedURIPluginNotInstalled />;
  }

  if (vaultName) {
    // Fail if selected vault doesn't have plugin
    if (!vaultsWithPlugin.some((v) => v.name === vaultName)) {
      return <AdvancedURIPluginNotInstalled vaultName={vaultName} />;
    }
  }

  if (!projectSettings.notePath) {
    // Fail if selected vault doesn't have plugin
    return <NoPathProvided />;
  }

  // Vault設定をチェック - 設定されていない場合やプラグインがない場合のみVault選択画面を表示
  const selectedVault = projectSettings.vaultName && vaults.find((vault) => vault.name === projectSettings.vaultName);
  const needsVaultSelection = !selectedVault && vaultsWithPlugin.length > 1;

  // Vault選択が必要な場合は従来のVault選択画面
  if (needsVaultSelection) {
    return (
      <List isLoading={false}>
        {vaultsWithPlugin.map((vault) => (
          <List.Item
            key={vault.key}
            title={vault.name}
            actions={
              <ActionPanel>
                <Action
                  title="Drift Logger"
                  onAction={async () => {
                    // 選択したタスクグループを記憶
                    if (selectedTaskGroup) {
                      saveSelectedTaskGroupId(selectedTaskGroup.id);
                    } else {
                      saveSelectedTaskGroupId("");
                    }

                    const dailyPath = await generateDailyPath();
                    const target = getObsidianTarget({
                      type: ObsidianTargetType.AppendTask,
                      path: dailyPath,
                      vault: vault,
                      text: formatDriftLogEntry(
                        startTimeString,
                        endTimeString,
                        content,
                        calculatedMinutes,
                        selectedTaskGroup?.name
                      ),
                      heading: projectSettings.heading,
                      silent: silent,
                    });
                    open(target);
                    clearCache();
                    saveDriftLoggerEndTime(endTime);
                    popToRoot();
                    closeMainWindow();
                  }}
                />
              </ActionPanel>
            }
          />
        ))}
      </List>
    );
  }

  // Vault設定が完了している場合、TaskGroup選択画面を表示
  const vaultToUse = selectedVault || vaultsWithPlugin[0];

  const executeWithTaskGroup = async (taskGroup: TaskGroup | null) => {
    // 選択したタスクグループを記憶
    if (taskGroup) {
      saveSelectedTaskGroupId(taskGroup.id);
    } else {
      saveSelectedTaskGroupId("");
    }

    const dailyPath = await generateDailyPath();
    const target = getObsidianTarget({
      type: ObsidianTargetType.AppendTask,
      path: dailyPath,
      vault: vaultToUse,
      text: formatDriftLogEntry(startTimeString, endTimeString, content, calculatedMinutes, taskGroup?.name),
      heading: projectSettings.heading,
      silent: silent,
    });
    open(target);
    clearCache();
    saveDriftLoggerEndTime(endTime);
    popToRoot();
    closeMainWindow();
  };

  return (
    <List isLoading={false}>
      <List.Section title="タスクグループを選択">
        <List.Item
          key="default"
          title="デフォルト（タスクグループなし）"
          actions={
            <ActionPanel>
              <Action title="Drift Logger" onAction={() => executeWithTaskGroup(null)} />
            </ActionPanel>
          }
        />
        <List.Item
          key="create_new"
          title={`新しいタスクグループ「${text}」を作成`}
          actions={
            <ActionPanel>
              <Action
                title="作成して実行"
                onAction={() => {
                  const newTaskGroup: TaskGroup = {
                    id: uuidv4(),
                    name: text,
                  };
                  addTaskGroup(newTaskGroup);
                  setTaskGroups(getTaskGroups());
                  executeWithTaskGroup(newTaskGroup); // 新規作成したタスクグループで実行
                }}
              />
            </ActionPanel>
          }
        />
        {taskGroups.map((taskGroup) => (
          <List.Item
            key={taskGroup.id}
            title={taskGroup.name}
            accessories={[...(selectedTaskGroup?.id === taskGroup.id ? [{ icon: "✓", tooltip: "選択中" }] : [])]}
            actions={
              <ActionPanel>
                <Action title="Drift Logger" onAction={() => executeWithTaskGroup(taskGroup)} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

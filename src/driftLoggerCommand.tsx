import { Action, ActionPanel, closeMainWindow, getPreferenceValues, List, open, popToRoot } from "@raycast/api";
import { useEffect, useState } from "react";
import { format, parse } from "date-fns";
import { clearCache, getLastDriftLoggerEndTime, saveDriftLoggerEndTime } from "./api/cache/cache.service";
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

export default function DriftLogger(props: { arguments: appendTaskArgs }) {
  const { vaults, ready } = useObsidianVaults();
  const { text, minutes, startTime: customStartTime } = props.arguments;

  // 特殊コマンド「pin」の処理
  if (text === "pin") {
    const currentTime = new Date();
    saveDriftLoggerEndTime(currentTime);
    popToRoot();
    closeMainWindow();
    return <List isLoading={false} />;
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
    if (!notePath) {
      return "";
    }

    const today = new Date();

    // date-fnsのformatを使用してテンプレート置換処理
    const dailyPath = format(today, notePath);

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

  const formatDriftLogEntry = (startTime: string, endTime: string, content: string, minutes: string): string => {
    return `- ${startTime}~${endTime} (${minutes}min): ${content}`;
  };

  const { appendTemplate, heading, notePath, vaultName, silent } = getPreferenceValues<appendTaskPreferences>();
  const [vaultsWithPlugin, vaultsWithoutPlugin] = vaultPluginCheck(vaults, "obsidian-advanced-uri");
  const [content, setContent] = useState<string | null>(null);

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

  if (!notePath) {
    // Fail if selected vault doesn't have plugin
    return <NoPathProvided />;
  }

  const selectedVault = vaultName && vaults.find((vault) => vault.name === vaultName);
  // If there's a configured vault or only one vault, use that
  if (selectedVault || vaultsWithPlugin.length === 1) {
    const vaultToUse = selectedVault || vaultsWithPlugin[0];
    const openObsidian = async () => {
      const dailyPath = await generateDailyPath();
      const target = getObsidianTarget({
        type: ObsidianTargetType.AppendTask,
        path: dailyPath,
        vault: vaultToUse,
        text: formatDriftLogEntry(startTimeString, endTimeString, content, calculatedMinutes),
        heading: heading,
        silent: silent,
      });
      open(target);
      clearCache();
      // 終了時刻を次回の開始時刻として保存（clearCacheの後で実行）
      saveDriftLoggerEndTime(endTime);
      popToRoot();
      closeMainWindow();
    };

    // Render a loading state while the user selects a vault
    if (vaults.length > 1 && !selectedVault) {
      return <List isLoading={true} />;
    }

    // Call the function to open Obsidian when ready
    openObsidian();
  }

  // Otherwise, let the user select a vault
  return (
    <List isLoading={false}>
      {vaultsWithPlugin.map((vault) => (
        <List.Item
          key={vault.key}
          title={vault.name}
          actions={
            <ActionPanel>
              <Action.Open
                title="Drift Logger"
                target={getObsidianTarget({
                  type: ObsidianTargetType.AppendTask,
                  path: generateDailyPathSync(),
                  vault: vault,
                  text: formatDriftLogEntry(startTimeString, endTimeString, content, calculatedMinutes),
                  heading: heading,
                })}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

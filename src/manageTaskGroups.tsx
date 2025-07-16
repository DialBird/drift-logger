/**
 * タスクグループ管理画面
 *
 * この画面では以下の機能を提供します：
 * - タスクグループの一覧表示
 * - タスクグループの追加・編集・削除
 * - タスクグループの選択状態管理
 */

import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  Form,
  Icon,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  getTaskGroups,
  addTaskGroup,
  updateTaskGroup,
  deleteTaskGroup,
  getSelectedTaskGroupId,
  saveSelectedTaskGroupId,
  type TaskGroup,
} from "./api/cache/cache.service";

interface TaskGroupFormValues {
  name: string;
}

function TaskGroupForm({
  taskGroup,
  onSubmit,
  initialName,
}: {
  taskGroup?: TaskGroup;
  onSubmit: (values: TaskGroupFormValues) => void;
  initialName?: string;
}) {
  const { pop } = useNavigation();

  const handleSubmit = (values: TaskGroupFormValues) => {
    onSubmit(values);
    pop();
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={taskGroup ? "タスクグループを更新" : "タスクグループを作成"}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="タスクグループ名"
        placeholder="例: Work Tasks"
        defaultValue={taskGroup?.name || initialName || ""}
      />
    </Form>
  );
}

export default function ManageTaskGroups() {
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [selectedTaskGroupId, setSelectedTaskGroupId] = useState<string | null>(null);
  const { push } = useNavigation();

  useEffect(() => {
    const loadTaskGroups = () => {
      const taskGroupsList = getTaskGroups();
      setTaskGroups(taskGroupsList);
      setSelectedTaskGroupId(getSelectedTaskGroupId());
    };

    loadTaskGroups();
  }, []);

  const handleAddTaskGroup = (values: TaskGroupFormValues) => {
    const newTaskGroup: TaskGroup = {
      id: uuidv4(),
      name: values.name,
    };

    addTaskGroup(newTaskGroup);
    setTaskGroups(getTaskGroups());
    showToast({
      style: Toast.Style.Success,
      title: "タスクグループを作成しました",
      message: newTaskGroup.name,
    });
  };

  const handleUpdateTaskGroup = (updatedTaskGroup: TaskGroup) => (values: TaskGroupFormValues) => {
    const taskGroupToUpdate: TaskGroup = {
      ...updatedTaskGroup,
      name: values.name,
    };

    updateTaskGroup(taskGroupToUpdate);
    setTaskGroups(getTaskGroups());
    showToast({
      style: Toast.Style.Success,
      title: "タスクグループを更新しました",
      message: taskGroupToUpdate.name,
    });
  };

  const handleDeleteTaskGroup = async (taskGroup: TaskGroup) => {
    const confirmed = await confirmAlert({
      title: "タスクグループを削除",
      message: `「${taskGroup.name}」を削除しますか？この操作は取り消せません。`,
      primaryAction: {
        title: "削除",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (confirmed) {
      deleteTaskGroup(taskGroup.id);
      setTaskGroups(getTaskGroups());

      // 削除されたタスクグループが選択されていた場合、選択を解除
      if (selectedTaskGroupId === taskGroup.id) {
        saveSelectedTaskGroupId("");
        setSelectedTaskGroupId(null);
      }

      showToast({
        style: Toast.Style.Success,
        title: "タスクグループを削除しました",
        message: taskGroup.name,
      });
    }
  };

  const handleSelectTaskGroup = (taskGroup: TaskGroup) => {
    saveSelectedTaskGroupId(taskGroup.id);
    setSelectedTaskGroupId(taskGroup.id);
    showToast({
      style: Toast.Style.Success,
      title: "タスクグループを選択しました",
      message: taskGroup.name,
    });
  };

  const handleDeselectTaskGroup = () => {
    saveSelectedTaskGroupId("");
    setSelectedTaskGroupId(null);
    showToast({
      style: Toast.Style.Success,
      title: "タスクグループ選択を解除しました",
    });
  };

  return (
    <List
      actions={
        <ActionPanel>
          <Action
            title="新しいタスクグループを作成"
            icon={Icon.Plus}
            onAction={() => push(<TaskGroupForm onSubmit={handleAddTaskGroup} />)}
          />
          {selectedTaskGroupId && (
            <Action title="タスクグループ選択を解除" icon={Icon.XMarkCircle} onAction={handleDeselectTaskGroup} />
          )}
        </ActionPanel>
      }
    >
      <List.Section title="タスクグループ一覧">
        {taskGroups.length === 0 ? (
          <List.Item
            title="タスクグループが登録されていません"
            subtitle="新しいタスクグループを作成してください"
            icon={Icon.ExclamationMark}
          />
        ) : (
          taskGroups.map((taskGroup) => (
            <List.Item
              key={taskGroup.id}
              title={taskGroup.name}
              accessories={[
                ...(selectedTaskGroupId === taskGroup.id ? [{ icon: Icon.CheckCircle, tooltip: "選択中" }] : []),
              ]}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    {selectedTaskGroupId !== taskGroup.id ? (
                      <Action
                        title="このタスクグループを選択"
                        icon={Icon.CheckCircle}
                        onAction={() => handleSelectTaskGroup(taskGroup)}
                      />
                    ) : (
                      <Action
                        title="タスクグループ選択を解除"
                        icon={Icon.XMarkCircle}
                        onAction={handleDeselectTaskGroup}
                      />
                    )}
                    <Action
                      title="編集"
                      icon={Icon.Pencil}
                      onAction={() =>
                        push(<TaskGroupForm taskGroup={taskGroup} onSubmit={handleUpdateTaskGroup(taskGroup)} />)
                      }
                    />
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    <Action
                      title="新しいタスクグループを作成"
                      icon={Icon.Plus}
                      onAction={() => push(<TaskGroupForm onSubmit={handleAddTaskGroup} />)}
                    />
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    <Action
                      title="削除"
                      icon={Icon.Trash}
                      style={Action.Style.Destructive}
                      onAction={() => handleDeleteTaskGroup(taskGroup)}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          ))
        )}
      </List.Section>
    </List>
  );
}

import { Cache } from "@raycast/api";
import { BYTES_PER_MEGABYTE } from "../../utils/constants";
import { Logger } from "../logger/logger.service";
import { Note } from "../vault/notes/notes.types";
import { loadNotes } from "../vault/vault.service";
import { Vault } from "../vault/vault.types";

//--------------------------------------------------------------------------------
// This cache is shared accross all commands.
//--------------------------------------------------------------------------------

const logger = new Logger("Cache");
const cache = new Cache({ capacity: BYTES_PER_MEGABYTE * 500 });

/**
 * Cache all notes for a given vault.
 *
 * @param vault - Vault to cache notes for
 * @returns The cached notes for the vault
 */
export function cacheNotesFor(vault: Vault) {
  const notes = loadNotes(vault);
  cache.set(vault.name, JSON.stringify({ lastCached: Date.now(), notes: notes }));
  return notes;
}

/**
 * Renews the cache for a given vault by reloading all notes from disk.
 *
 * @param vault - Vault to renew the cache for
 */
export function renewCache(vault: Vault) {
  console.log("Renew Cache");
  cacheNotesFor(vault);
}

/**
 * Test if cache exists for a given vault.
 *
 * @param vault - Vault to test if cache exists for
 * @returns true if cache exists for vault
 */
export function cacheExistForVault(vault: Vault) {
  if (cache.has(vault.name)) {
    return true;
  } else {
    console.log("Cache does not exist for vault: " + vault.name);
  }
}

/**
 * Updates a note that has already been cached.
 *
 * @param vault - The Vault to update the note in
 * @param note - The updated note
 */

export function updateNoteInCache(vault: Vault, note: Note) {
  if (cacheExistForVault(vault)) {
    const data = JSON.parse(cache.get(vault.name) ?? "{}");
    data.notes = data.notes.map((n: Note) => (n.path === note.path ? note : n));
    cache.set(vault.name, JSON.stringify(data));
  }
}

/**
 * Deletes a note from the cache.
 *
 * @param vault - The Vault to delete the note from
 * @param note - The note to delete from the cache
 */
export function deleteNoteFromCache(vault: Vault, note: Note) {
  if (cacheExistForVault(vault)) {
    const data = JSON.parse(cache.get(vault.name) ?? "{}");
    data.notes = data.notes.filter((n: Note) => n.path !== note.path);
    cache.set(vault.name, JSON.stringify(data));
  }
}

export function getNotesFromCache(vault: Vault) {
  if (cacheExistForVault(vault)) {
    const data = JSON.parse(cache.get(vault.name) ?? "{}");
    if (data.notes?.length > 0 && data.lastCached > Date.now() - 1000 * 60 * 5) {
      const notes_ = data.notes as Note[];
      logger.info("Using cached notes.");
      return notes_;
    }
  }
  return cacheNotesFor(vault);
}

export function clearCache() {
  // タスクグループ関連のデータを保存
  const taskGroups = getTaskGroups();
  const selectedTaskGroupId = getSelectedTaskGroupId();
  const lastEndTime = getLastDriftLoggerEndTime();

  // キャッシュをクリア
  cache.clear();

  // タスクグループ関連のデータを復元
  if (taskGroups.length > 0) {
    saveTaskGroups(taskGroups);
  }
  if (selectedTaskGroupId) {
    saveSelectedTaskGroupId(selectedTaskGroupId);
  }
  if (lastEndTime) {
    saveDriftLoggerEndTime(lastEndTime);
  }
}

/**
 * Save the end time of the last drift log entry.
 *
 * @param endTime - The end time to save
 */
export function saveDriftLoggerEndTime(endTime: Date) {
  cache.set("drift_logger_last_end_time", JSON.stringify({ endTime: endTime.getTime() }));
}

/**
 * Get the end time of the last drift log entry.
 *
 * @returns The last end time, or null if not found
 */
export function getLastDriftLoggerEndTime(): Date | null {
  if (cache.has("drift_logger_last_end_time")) {
    const data = JSON.parse(cache.get("drift_logger_last_end_time") ?? "{}");
    return data.endTime ? new Date(data.endTime) : null;
  }
  return null;
}

//--------------------------------------------------------------------------------
// TaskGroup Management Functions
//--------------------------------------------------------------------------------

export interface TaskGroup {
  id: string;
  name: string;
}

/**
 * Save task groups to cache.
 *
 * @param taskGroups - The task groups to save
 */
export function saveTaskGroups(taskGroups: TaskGroup[]) {
  cache.set("drift_logger_task_groups", JSON.stringify(taskGroups));
}

/**
 * Get all task groups from cache.
 *
 * @returns The task groups array
 */
export function getTaskGroups(): TaskGroup[] {
  if (cache.has("drift_logger_task_groups")) {
    const taskGroups = JSON.parse(cache.get("drift_logger_task_groups") ?? "[]");
    return taskGroups as TaskGroup[];
  }
  return [];
}

/**
 * Add a new task group to cache.
 *
 * @param taskGroup - The task group to add
 */
export function addTaskGroup(taskGroup: TaskGroup) {
  const taskGroups = getTaskGroups();
  taskGroups.push(taskGroup);
  saveTaskGroups(taskGroups);
}

/**
 * Update an existing task group in cache.
 *
 * @param updatedTaskGroup - The updated task group
 */
export function updateTaskGroup(updatedTaskGroup: TaskGroup) {
  const taskGroups = getTaskGroups();
  const index = taskGroups.findIndex((tg) => tg.id === updatedTaskGroup.id);
  if (index !== -1) {
    taskGroups[index] = updatedTaskGroup;
    saveTaskGroups(taskGroups);
  }
}

/**
 * Delete a task group from cache.
 *
 * @param taskGroupId - The ID of the task group to delete
 */
export function deleteTaskGroup(taskGroupId: string) {
  const taskGroups = getTaskGroups();
  const filteredTaskGroups = taskGroups.filter((tg) => tg.id !== taskGroupId);
  saveTaskGroups(filteredTaskGroups);
}

/**
 * Save the currently selected task group ID.
 *
 * @param taskGroupId - The task group ID to save as selected
 */
export function saveSelectedTaskGroupId(taskGroupId: string) {
  cache.set("drift_logger_selected_task_group", taskGroupId);
}

/**
 * Get the currently selected task group ID.
 *
 * @returns The selected task group ID, or null if not found
 */
export function getSelectedTaskGroupId(): string | null {
  if (cache.has("drift_logger_selected_task_group")) {
    return cache.get("drift_logger_selected_task_group") ?? null;
  }
  return null;
}

/**
 * Get the currently selected task group.
 *
 * @returns The selected task group, or null if not found
 */
export function getSelectedTaskGroup(): TaskGroup | null {
  const selectedId = getSelectedTaskGroupId();
  if (selectedId) {
    const taskGroups = getTaskGroups();
    return taskGroups.find((tg) => tg.id === selectedId) || null;
  }
  return null;
}

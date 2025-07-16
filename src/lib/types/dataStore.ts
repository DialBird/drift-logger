/**
 * データ保存層の抽象化インターフェース
 *
 * このファイルはプラットフォーム非依存のデータ保存層を実現するための
 * 統一インターフェースを定義します。複数の保存方式（DuckDB、ローカルJSON、
 * Firestore、Obsidian）を同一の操作で扱えるようにします。
 */

import { TaskLogEntry, TaskGroup, DateRangeFilter, TimeRangeFilter, TaskGroupFilter, SearchFilter } from "./taskLog";

export interface DataStore {
  // === タスクログ管理 ===

  /**
   * タスクログエントリを保存
   * @param entry 保存するタスクログエントリ
   */
  saveTaskLog(entry: TaskLogEntry): Promise<void>;

  /**
   * タスクログエントリを取得
   * @param filter 日付範囲フィルタ（省略時は全件取得）
   * @returns フィルタにマッチするタスクログエントリ配列
   */
  getTaskLogs(filter?: DateRangeFilter): Promise<TaskLogEntry[]>;

  /**
   * タスクログエントリを検索
   * @param searchFilter 検索条件
   * @returns 検索条件にマッチするタスクログエントリ配列
   */
  searchTaskLogs(searchFilter: SearchFilter): Promise<TaskLogEntry[]>;

  /**
   * 複合フィルタリングによるタスクログ取得
   * @param filters 複数のフィルタ条件
   * @returns フィルタ条件にマッチするタスクログエントリ配列
   */
  getFilteredTaskLogs(filters: {
    dateRange?: DateRangeFilter;
    timeRange?: TimeRangeFilter;
    taskGroup?: TaskGroupFilter;
    search?: SearchFilter;
  }): Promise<TaskLogEntry[]>;

  /**
   * タスクログエントリを更新
   * @param id タスクログエントリID
   * @param updates 更新内容
   */
  updateTaskLog(id: string, updates: Partial<TaskLogEntry>): Promise<void>;

  /**
   * タスクログエントリを削除
   * @param id 削除するタスクログエントリID
   */
  deleteTaskLog(id: string): Promise<void>;

  // === タスクグループ管理 ===

  /**
   * タスクグループを保存
   * @param group 保存するタスクグループ
   */
  saveTaskGroup(group: TaskGroup): Promise<void>;

  /**
   * 全タスクグループを取得
   * @returns タスクグループ配列
   */
  getTaskGroups(): Promise<TaskGroup[]>;

  /**
   * タスクグループを更新
   * @param id タスクグループID
   * @param updates 更新内容
   */
  updateTaskGroup(id: string, updates: Partial<TaskGroup>): Promise<void>;

  /**
   * タスクグループを削除
   * @param id 削除するタスクグループID
   */
  deleteTaskGroup(id: string): Promise<void>;

  // === 設定管理 ===

  /**
   * 設定値を保存
   * @param key 設定キー
   * @param value 設定値
   */
  saveSetting(key: string, value: unknown): Promise<void>;

  /**
   * 設定値を取得
   * @param key 設定キー
   * @returns 設定値（存在しない場合はundefined）
   */
  getSetting(key: string): Promise<unknown>;

  /**
   * 設定値を削除
   * @param key 削除する設定キー
   */
  deleteSetting(key: string): Promise<void>;

  // === データ同期・バックアップ ===

  /**
   * 全データをJSON形式でエクスポート
   * @returns JSON文字列
   */
  exportData(): Promise<string>;

  /**
   * JSON形式のデータをインポート
   * @param data インポートするJSON文字列
   * @param options インポートオプション
   */
  importData(
    data: string,
    options?: {
      overwrite?: boolean;
      mergeStrategy?: "latest" | "keep_existing";
    }
  ): Promise<void>;

  /**
   * データ同期（クラウド保存時のみ実装）
   * ローカル保存方式では何もしない
   */
  syncData?(): Promise<void>;

  // === ヘルスチェック・統計 ===

  /**
   * データストアの接続状態を確認
   * @returns 接続が正常な場合true
   */
  isHealthy(): Promise<boolean>;

  /**
   * データベース統計情報を取得
   * @returns 統計情報オブジェクト
   */
  getStats(): Promise<{
    totalTaskLogs: number;
    totalTaskGroups: number;
    dateRange: {
      earliest: string;
      latest: string;
    };
    storageSize?: number; // bytes
  }>;

  // === クリーンアップ ===

  /**
   * リソースをクリーンアップ
   * 接続を閉じたり、一時ファイルを削除する
   */
  cleanup(): Promise<void>;
}

// === 設定関連の型定義 ===

export type StorageType = "duckdb" | "local" | "firestore" | "obsidian";

export interface StorageConfig {
  type: StorageType;

  // DuckDB設定
  duckdbConfig?: {
    csvPath: string;
    enableInMemoryCache: boolean;
    maxCacheSize: number; // MB
  };

  // Firebase設定
  firebaseConfig?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };

  // Obsidian設定
  obsidianConfig?: {
    vaultPath: string;
    noteFormat: string;
    enableAdvancedURI: boolean;
  };

  // 同期設定
  syncConfig?: {
    autoSync: boolean;
    syncInterval: number; // 分単位
    conflictResolution: "local" | "remote" | "manual";
  };
}

// === エラー型定義 ===

export class DataStoreError extends Error {
  constructor(
    message: string,
    public code: "CONNECTION_ERROR" | "VALIDATION_ERROR" | "NOT_FOUND" | "DUPLICATE" | "PERMISSION_ERROR" | "UNKNOWN",
    public details?: unknown
  ) {
    super(message);
    this.name = "DataStoreError";
  }
}

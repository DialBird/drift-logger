/**
 * タスクログに関する型定義
 *
 * このファイルはタスクログエントリの構造と関連する型を定義します。
 * データ保存層やジャーナル機能で共通して使用される基本的なデータ構造を提供します。
 */

export interface TaskLogEntry {
  /** ログエントリの一意識別子 */
  id: string;

  /** 作業日 (YYYY-MM-DD形式) */
  date: string;

  /** 開始時刻 (HH:mm形式) */
  startTime: string;

  /** 終了時刻 (HH:mm形式) */
  endTime: string;

  /** 作業時間（分単位） */
  duration: number;

  /** タスクグループID */
  taskGroupId: string;

  /** タスクグループ名 */
  taskGroupName: string;

  /** タスク内容 */
  content: string;

  /** 作成日時 (ISO 8601形式) */
  createdAt: string;

  /** 更新日時 (ISO 8601形式) */
  updatedAt: string;

  /** 元のログエントリ文字列（移行時のトレーサビリティ用） */
  originalEntry?: string;
}

export interface TaskGroup {
  /** タスクグループの一意識別子 */
  id: string;

  /** タスクグループ名 */
  name: string;

  /** 表示色 */
  color?: string;

  /** 作成日時 (ISO 8601形式) */
  createdAt: string;

  /** 更新日時 (ISO 8601形式) */
  updatedAt: string;

  /** アクティブ状態 */
  isActive: boolean;
}

export interface DateRangeFilter {
  /** 開始日 (YYYY-MM-DD形式) */
  startDate: string;

  /** 終了日 (YYYY-MM-DD形式) */
  endDate: string;
}

export interface TimeRangeFilter {
  /** フィルタータイプ */
  type: "all_day" | "business_hours" | "custom";

  /** 開始時刻 (HH:mm形式) */
  startTime?: string;

  /** 終了時刻 (HH:mm形式) */
  endTime?: string;
}

export interface TaskGroupFilter {
  /** フィルタータイプ */
  type: "all" | "specific" | "multiple";

  /** 選択されたタスクグループID配列 */
  selectedGroupIds?: string[];
}

export interface SearchFilter {
  /** 検索クエリ */
  query: string;

  /** 検索対象フィールド */
  fields?: ("content" | "taskGroupName")[];

  /** 大文字小文字を区別するか */
  caseSensitive?: boolean;
}

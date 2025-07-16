/**
 * CSVスキーマとパース関連の型定義
 *
 * このファイルはDuckDB + CSV保存方式で使用するCSVファイルの
 * スキーマ定義とパース処理に関する型を定義します。
 */

/**
 * タスクログCSVの行データ構造
 * CSVファイルの各行を表すインターフェース
 */
export interface TaskLogCsvRow {
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  duration_minutes: string; // 数値（文字列として読み込まれる）
  task_group_id: string; // UUID
  task_group_name: string; // タスクグループ名
  content: string; // タスク内容
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * タスクグループCSVの行データ構造
 */
export interface TaskGroupCsvRow {
  id: string; // UUID
  name: string; // タスクグループ名
  color: string; // カラー（空文字可）
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  is_active: string; // "true" | "false"
}

/**
 * CSVヘッダー定義
 */
export const TASK_LOG_CSV_HEADERS = [
  "date",
  "start_time",
  "end_time",
  "duration_minutes",
  "task_group_id",
  "task_group_name",
  "content",
  "created_at",
  "updated_at",
] as const;

export const TASK_GROUP_CSV_HEADERS = ["id", "name", "color", "created_at", "updated_at", "is_active"] as const;

/**
 * CSV操作エラーの型定義
 */
export class CsvParseError extends Error {
  constructor(message: string, public row?: number, public column?: string, public originalData?: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

/**
 * CSV検証ルール
 */
export interface CsvValidationRule {
  field: string;
  required: boolean;
  pattern?: RegExp;
  validator?: (value: string) => boolean;
  errorMessage?: string;
}

/**
 * タスクログCSVの検証ルール
 */
export const TASK_LOG_CSV_VALIDATION_RULES: CsvValidationRule[] = [
  {
    field: "date",
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    errorMessage: "Date must be in YYYY-MM-DD format",
  },
  {
    field: "start_time",
    required: true,
    pattern: /^\d{1,2}:\d{2}$/,
    errorMessage: "Start time must be in HH:mm format",
  },
  {
    field: "end_time",
    required: true,
    pattern: /^\d{1,2}:\d{2}$/,
    errorMessage: "End time must be in HH:mm format",
  },
  {
    field: "duration_minutes",
    required: true,
    pattern: /^\d+$/,
    errorMessage: "Duration must be a positive integer",
  },
  {
    field: "task_group_id",
    required: true,
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    errorMessage: "Task group ID must be a valid UUID",
  },
  {
    field: "task_group_name",
    required: true,
    validator: (value: string) => value.length > 0,
    errorMessage: "Task group name cannot be empty",
  },
  {
    field: "content",
    required: true,
    validator: (value: string) => value.length > 0,
    errorMessage: "Content cannot be empty",
  },
  {
    field: "created_at",
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
    errorMessage: "Created at must be a valid ISO 8601 timestamp",
  },
  {
    field: "updated_at",
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
    errorMessage: "Updated at must be a valid ISO 8601 timestamp",
  },
];

/**
 * CSV操作の設定
 */
export interface CsvConfig {
  /** CSVファイルのパス */
  filePath: string;

  /** ヘッダー行を含むかどうか */
  hasHeader: boolean;

  /** 区切り文字（デフォルト: ','） */
  delimiter: string;

  /** クォート文字（デフォルト: '"'） */
  quote: string;

  /** エスケープ文字（デフォルト: '"'） */
  escape: string;

  /** エンコーディング（デフォルト: 'utf8'） */
  encoding: "utf8" | "ascii" | "latin1";

  /** データ検証を有効にするか */
  enableValidation: boolean;
}

/**
 * CSV操作の統計情報
 */
export interface CsvStats {
  /** 総行数 */
  totalRows: number;

  /** 有効な行数 */
  validRows: number;

  /** エラー行数 */
  errorRows: number;

  /** ファイルサイズ（バイト） */
  fileSize: number;

  /** 最終更新日時 */
  lastModified: Date;
}

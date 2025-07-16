/**
 * データストアファクトリーとエクスポート
 *
 * このファイルはデータ保存層の統一エントリポイントを提供します。
 * 設定に基づいて適切なDataStoreインスタンスを作成し、返します。
 */

import { DataStore, StorageConfig, DataStoreError } from "../types/dataStore";
import { DuckDBStore } from "./duckdbStore";

/**
 * 設定に基づいてDataStoreインスタンスを作成
 * @param config ストレージ設定
 * @returns DataStoreインスタンス
 */
export function createDataStore(config: StorageConfig): DataStore {
  switch (config.type) {
    case "duckdb":
      return new DuckDBStore(config);

    case "local":
      // TODO: LocalFileStore実装
      throw new DataStoreError("Local file store not implemented yet", "UNKNOWN");

    case "firestore":
      // TODO: FirestoreStore実装
      throw new DataStoreError("Firestore store not implemented yet", "UNKNOWN");

    case "obsidian":
      // TODO: ObsidianStore実装
      throw new DataStoreError("Obsidian store not implemented yet", "UNKNOWN");

    default:
      throw new DataStoreError(`Unsupported storage type: ${(config as StorageConfig).type}`, "VALIDATION_ERROR");
  }
}

/**
 * デフォルトのDuckDB設定を作成
 * @param csvPath CSVファイルのベースパス
 * @returns DuckDB設定
 */
export function createDefaultDuckDBConfig(csvPath: string): StorageConfig {
  return {
    type: "duckdb",
    duckdbConfig: {
      csvPath,
      enableInMemoryCache: true,
      maxCacheSize: 100, // 100MB
    },
  };
}

// 型定義とクラスを再エクスポート
export type { DataStore, StorageConfig, StorageType } from "../types/dataStore";
export { DataStoreError } from "../types/dataStore";
export { DuckDBStore } from "./duckdbStore";

// 型定義を再エクスポート
export type {
  TaskLogEntry,
  TaskGroup,
  DateRangeFilter,
  TimeRangeFilter,
  TaskGroupFilter,
  SearchFilter,
} from "../types/taskLog";

// CSVパーサーを再エクスポート
export { CsvParser } from "../parsers/csvParser";
export type { TaskLogCsvRow, TaskGroupCsvRow, CsvConfig, CsvStats } from "../types/csvSchema";
export { CsvParseError } from "../types/csvSchema";

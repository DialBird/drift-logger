/**
 * DuckDB + CSV データストア実装
 *
 * このファイルはDuckDBとCSVファイルを組み合わせたデータ保存方式を実装します。
 * CSVファイルの可読性とSQLクエリの高性能を両立させます。
 */

import { promises as fs } from "fs";
import path from "path";
import { Database } from "duckdb";
import { v4 as uuidv4 } from "uuid";
import { DataStore, DataStoreError, StorageConfig } from "../types/dataStore";
import {
  TaskLogEntry,
  TaskGroup,
  DateRangeFilter,
  TimeRangeFilter,
  TaskGroupFilter,
  SearchFilter,
} from "../types/taskLog";
import { CsvParser } from "../parsers/csvParser";
import { CsvParseError } from "../types/csvSchema";

/**
 * DuckDBStore実装クラス
 * CSV + DuckDBによる高性能データ保存を提供
 */
export class DuckDBStore implements DataStore {
  private db: Database;
  private csvParser: CsvParser;
  private taskLogsCsvPath: string;
  private taskGroupsCsvPath: string;
  private isInitialized = false;

  constructor(private config: StorageConfig) {
    if (config.type !== "duckdb" || !config.duckdbConfig) {
      throw new DataStoreError("Invalid DuckDB configuration", "VALIDATION_ERROR");
    }

    // CSVファイルパスを設定
    const baseDir = path.dirname(config.duckdbConfig.csvPath);
    this.taskLogsCsvPath = path.join(baseDir, "task_logs.csv");
    this.taskGroupsCsvPath = path.join(baseDir, "task_groups.csv");

    // DuckDBインスタンス作成
    this.db = new Database(":memory:"); // インメモリまたはファイルベース

    // CSVパーサー初期化
    this.csvParser = new CsvParser({
      enableValidation: true,
      hasHeader: true,
      encoding: "utf8",
    });
  }

  /**
   * データストアを初期化
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // ディレクトリが存在しない場合は作成
      await this.ensureDirectoryExists(path.dirname(this.taskLogsCsvPath));

      // CSVファイルが存在しない場合は作成
      await this.ensureCSVFilesExist();

      // DuckDBでCSVファイルを読み込み可能にする
      await this.setupDuckDBTables();

      this.isInitialized = true;
    } catch (error) {
      throw new DataStoreError(
        `Failed to initialize DuckDB store: ${error instanceof Error ? error.message : "Unknown error"}`,
        "CONNECTION_ERROR",
        error
      );
    }
  }

  /**
   * ディレクトリの存在を確認・作成
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * CSVファイルの存在を確認・作成
   */
  private async ensureCSVFilesExist(): Promise<void> {
    // タスクログCSVファイル
    try {
      await fs.access(this.taskLogsCsvPath);
    } catch {
      const headers =
        "date,start_time,end_time,duration_minutes,task_group_id,task_group_name,content,created_at,updated_at\n";
      await fs.writeFile(this.taskLogsCsvPath, headers, "utf8");
    }

    // タスクグループCSVファイル
    try {
      await fs.access(this.taskGroupsCsvPath);
    } catch {
      const headers = "id,name,color,created_at,updated_at,is_active\n";
      await fs.writeFile(this.taskGroupsCsvPath, headers, "utf8");
    }
  }

  /**
   * DuckDBテーブルをセットアップ
   */
  private async setupDuckDBTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      // タスクログビューを作成
      this.db.run(
        `
        CREATE OR REPLACE VIEW task_logs AS 
        SELECT * FROM read_csv_auto('${this.taskLogsCsvPath}')
      `,
        (err) => {
          if (err) {
            reject(new DataStoreError("Failed to create task_logs view", "CONNECTION_ERROR", err));
            return;
          }

          // タスクグループビューを作成
          this.db.run(
            `
          CREATE OR REPLACE VIEW task_groups AS 
          SELECT * FROM read_csv_auto('${this.taskGroupsCsvPath}')
        `,
            (err) => {
              if (err) {
                reject(new DataStoreError("Failed to create task_groups view", "CONNECTION_ERROR", err));
                return;
              }
              resolve();
            }
          );
        }
      );
    });
  }

  // === タスクログ管理 ===

  async saveTaskLog(entry: TaskLogEntry): Promise<void> {
    await this.initialize();

    try {
      // 既存のエントリを読み込み
      const existingEntries = await this.csvParser.readTaskLogsCsv(this.taskLogsCsvPath);

      // 同じIDのエントリが存在する場合は更新、そうでなければ追加
      const existingIndex = existingEntries.findIndex((e) => e.id === entry.id);

      if (existingIndex >= 0) {
        existingEntries[existingIndex] = { ...entry, updatedAt: new Date().toISOString() };
      } else {
        const newEntry = {
          ...entry,
          id: entry.id || uuidv4(),
          createdAt: entry.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        existingEntries.push(newEntry);
      }

      // CSVファイルに書き戻し
      await this.csvParser.writeTaskLogsCsv(existingEntries, this.taskLogsCsvPath);

      // DuckDBビューを更新
      await this.setupDuckDBTables();
    } catch (error) {
      if (error instanceof CsvParseError) {
        throw new DataStoreError(`CSV operation failed: ${error.message}`, "VALIDATION_ERROR", error);
      }
      throw new DataStoreError(
        `Failed to save task log: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  async getTaskLogs(filter?: DateRangeFilter): Promise<TaskLogEntry[]> {
    await this.initialize();

    try {
      if (!filter) {
        // フィルタなしの場合はCSVから直接読み込み
        return await this.csvParser.readTaskLogsCsv(this.taskLogsCsvPath);
      }

      // DuckDBクエリを使用してフィルタリング
      const query = `
        SELECT * FROM task_logs 
        WHERE date BETWEEN '${filter.startDate}' AND '${filter.endDate}'
        ORDER BY date DESC, start_time DESC
      `;

      return await this.executeCsvQuery(query);
    } catch (error) {
      throw new DataStoreError(
        `Failed to get task logs: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  async searchTaskLogs(searchFilter: SearchFilter): Promise<TaskLogEntry[]> {
    await this.initialize();

    try {
      const fields = searchFilter.fields || ["content", "taskGroupName"];
      const conditions = fields
        .map((field) => {
          const columnName = field === "taskGroupName" ? "task_group_name" : field;
          const operator = searchFilter.caseSensitive ? "LIKE" : "ILIKE";
          return `${columnName} ${operator} '%${searchFilter.query}%'`;
        })
        .join(" OR ");

      const query = `
        SELECT * FROM task_logs 
        WHERE ${conditions}
        ORDER BY date DESC, start_time DESC
      `;

      return await this.executeCsvQuery(query);
    } catch (error) {
      throw new DataStoreError(
        `Failed to search task logs: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  async getFilteredTaskLogs(filters: {
    dateRange?: DateRangeFilter;
    timeRange?: TimeRangeFilter;
    taskGroup?: TaskGroupFilter;
    search?: SearchFilter;
  }): Promise<TaskLogEntry[]> {
    await this.initialize();

    try {
      const conditions: string[] = [];

      // 日付範囲フィルタ
      if (filters.dateRange) {
        conditions.push(`date BETWEEN '${filters.dateRange.startDate}' AND '${filters.dateRange.endDate}'`);
      }

      // 時間範囲フィルタ
      if (
        filters.timeRange &&
        filters.timeRange.type === "custom" &&
        filters.timeRange.startTime &&
        filters.timeRange.endTime
      ) {
        conditions.push(
          `start_time >= '${filters.timeRange.startTime}' AND end_time <= '${filters.timeRange.endTime}'`
        );
      }

      // タスクグループフィルタ
      if (filters.taskGroup && filters.taskGroup.type !== "all" && filters.taskGroup.selectedGroupIds) {
        const groupIds = filters.taskGroup.selectedGroupIds.map((id) => `'${id}'`).join(",");
        conditions.push(`task_group_id IN (${groupIds})`);
      }

      // 検索フィルタ
      if (filters.search) {
        const fields = filters.search.fields || ["content", "task_group_name"];
        const searchConditions = fields
          .map((field) => {
            const operator = filters.search?.caseSensitive ? "LIKE" : "ILIKE";
            return `${field} ${operator} '%${filters.search?.query}%'`;
          })
          .join(" OR ");
        conditions.push(`(${searchConditions})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const query = `
        SELECT * FROM task_logs 
        ${whereClause}
        ORDER BY date DESC, start_time DESC
      `;

      return await this.executeCsvQuery(query);
    } catch (error) {
      throw new DataStoreError(
        `Failed to get filtered task logs: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  async updateTaskLog(id: string, updates: Partial<TaskLogEntry>): Promise<void> {
    await this.initialize();

    try {
      const existingEntries = await this.csvParser.readTaskLogsCsv(this.taskLogsCsvPath);
      const entryIndex = existingEntries.findIndex((e) => e.id === id);

      if (entryIndex === -1) {
        throw new DataStoreError(`Task log with ID ${id} not found`, "NOT_FOUND");
      }

      // エントリを更新
      existingEntries[entryIndex] = {
        ...existingEntries[entryIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // CSVファイルに書き戻し
      await this.csvParser.writeTaskLogsCsv(existingEntries, this.taskLogsCsvPath);
      await this.setupDuckDBTables();
    } catch (error) {
      if (error instanceof DataStoreError) {
        throw error;
      }
      throw new DataStoreError(
        `Failed to update task log: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  async deleteTaskLog(id: string): Promise<void> {
    await this.initialize();

    try {
      const existingEntries = await this.csvParser.readTaskLogsCsv(this.taskLogsCsvPath);
      const filteredEntries = existingEntries.filter((e) => e.id !== id);

      if (filteredEntries.length === existingEntries.length) {
        throw new DataStoreError(`Task log with ID ${id} not found`, "NOT_FOUND");
      }

      // CSVファイルに書き戻し
      await this.csvParser.writeTaskLogsCsv(filteredEntries, this.taskLogsCsvPath);
      await this.setupDuckDBTables();
    } catch (error) {
      if (error instanceof DataStoreError) {
        throw error;
      }
      throw new DataStoreError(
        `Failed to delete task log: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  // === タスクグループ管理 ===

  async saveTaskGroup(group: TaskGroup): Promise<void> {
    await this.initialize();

    try {
      // 既存のグループを読み込み（CSV経由）
      const content = await fs.readFile(this.taskGroupsCsvPath, "utf8");
      const lines = content.split("\n").filter((line) => line.trim());

      // ヘッダー
      const header = lines[0];
      const dataLines = lines.slice(1);

      // 既存のエントリを確認
      const existingIndex = dataLines.findIndex((line) => {
        const [id] = line.split(",");
        return id === group.id;
      });

      const csvRow = this.csvParser.taskGroupToCsvRow(group);
      const newLine = `${csvRow.id},${csvRow.name},${csvRow.color},${csvRow.created_at},${csvRow.updated_at},${csvRow.is_active}`;

      if (existingIndex >= 0) {
        dataLines[existingIndex] = newLine;
      } else {
        dataLines.push(newLine);
      }

      // ファイルに書き戻し
      const newContent = [header, ...dataLines].join("\n") + "\n";
      await fs.writeFile(this.taskGroupsCsvPath, newContent, "utf8");

      await this.setupDuckDBTables();
    } catch (error) {
      throw new DataStoreError(
        `Failed to save task group: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  async getTaskGroups(): Promise<TaskGroup[]> {
    await this.initialize();

    try {
      const content = await fs.readFile(this.taskGroupsCsvPath, "utf8");
      const lines = content.split("\n").filter((line) => line.trim());

      // ヘッダーをスキップ
      const dataLines = lines.slice(1);

      return dataLines.map((line) => {
        const [id, name, color, created_at, updated_at, is_active] = line.split(",");
        return this.csvParser.csvRowToTaskGroup({
          id,
          name,
          color,
          created_at,
          updated_at,
          is_active,
        });
      });
    } catch (error) {
      throw new DataStoreError(
        `Failed to get task groups: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  async updateTaskGroup(id: string, updates: Partial<TaskGroup>): Promise<void> {
    await this.initialize();

    try {
      const groups = await this.getTaskGroups();
      const groupIndex = groups.findIndex((g) => g.id === id);

      if (groupIndex === -1) {
        throw new DataStoreError(`Task group with ID ${id} not found`, "NOT_FOUND");
      }

      const updatedGroup = {
        ...groups[groupIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await this.saveTaskGroup(updatedGroup);
    } catch (error) {
      if (error instanceof DataStoreError) {
        throw error;
      }
      throw new DataStoreError(
        `Failed to update task group: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  async deleteTaskGroup(id: string): Promise<void> {
    await this.initialize();

    try {
      const groups = await this.getTaskGroups();
      const filteredGroups = groups.filter((g) => g.id !== id);

      if (filteredGroups.length === groups.length) {
        throw new DataStoreError(`Task group with ID ${id} not found`, "NOT_FOUND");
      }

      // ヘッダーを書き込み
      const header = "id,name,color,created_at,updated_at,is_active\n";
      const dataLines = filteredGroups.map((group) => {
        const csvRow = this.csvParser.taskGroupToCsvRow(group);
        return `${csvRow.id},${csvRow.name},${csvRow.color},${csvRow.created_at},${csvRow.updated_at},${csvRow.is_active}`;
      });

      const content = header + dataLines.join("\n") + "\n";
      await fs.writeFile(this.taskGroupsCsvPath, content, "utf8");

      await this.setupDuckDBTables();
    } catch (error) {
      if (error instanceof DataStoreError) {
        throw error;
      }
      throw new DataStoreError(
        `Failed to delete task group: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  // === 設定管理 ===

  async saveSetting(key: string, value: unknown): Promise<void> {
    // 設定はメモリ内に保存（実装簡略化）
    // 実際の実装では別のCSVファイルまたはJSON設定ファイルを使用
    console.log(`Settings not implemented: saving ${key} with value`, value);
    throw new DataStoreError("Settings management not implemented yet", "UNKNOWN");
  }

  async getSetting(key: string): Promise<unknown> {
    console.log(`Settings not implemented: getting ${key}`);
    throw new DataStoreError("Settings management not implemented yet", "UNKNOWN");
  }

  async deleteSetting(key: string): Promise<void> {
    console.log(`Settings not implemented: deleting ${key}`);
    throw new DataStoreError("Settings management not implemented yet", "UNKNOWN");
  }

  // === データ同期・バックアップ ===

  async exportData(): Promise<string> {
    await this.initialize();

    try {
      const taskLogs = await this.getTaskLogs();
      const taskGroups = await this.getTaskGroups();

      return JSON.stringify(
        {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          taskLogs,
          taskGroups,
        },
        null,
        2
      );
    } catch (error) {
      throw new DataStoreError(
        `Failed to export data: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  async importData(
    data: string,
    options?: { overwrite?: boolean; mergeStrategy?: "latest" | "keep_existing" }
  ): Promise<void> {
    await this.initialize();

    try {
      const parsed = JSON.parse(data);

      if (options?.overwrite) {
        // 全データを削除してからインポート
        await fs.writeFile(
          this.taskLogsCsvPath,
          "date,start_time,end_time,duration_minutes,task_group_id,task_group_name,content,created_at,updated_at\n",
          "utf8"
        );
        await fs.writeFile(this.taskGroupsCsvPath, "id,name,color,created_at,updated_at,is_active\n", "utf8");
      }

      // タスクグループをインポート
      if (parsed.taskGroups) {
        for (const group of parsed.taskGroups) {
          await this.saveTaskGroup(group);
        }
      }

      // タスクログをインポート
      if (parsed.taskLogs) {
        for (const log of parsed.taskLogs) {
          await this.saveTaskLog(log);
        }
      }
    } catch (error) {
      throw new DataStoreError(
        `Failed to import data: ${error instanceof Error ? error.message : "Unknown error"}`,
        "VALIDATION_ERROR",
        error
      );
    }
  }

  // === ヘルスチェック・統計 ===

  async isHealthy(): Promise<boolean> {
    try {
      await this.initialize();

      // CSVファイルの存在確認
      await fs.access(this.taskLogsCsvPath);
      await fs.access(this.taskGroupsCsvPath);

      // DuckDBクエリテスト
      await this.executeCsvQuery("SELECT COUNT(*) as count FROM task_logs LIMIT 1");

      return true;
    } catch {
      return false;
    }
  }

  async getStats(): Promise<{
    totalTaskLogs: number;
    totalTaskGroups: number;
    dateRange: { earliest: string; latest: string };
    storageSize?: number;
  }> {
    await this.initialize();

    try {
      const taskLogs = await this.getTaskLogs();
      const taskGroups = await this.getTaskGroups();

      // ファイルサイズ計算
      const taskLogsStats = await fs.stat(this.taskLogsCsvPath);
      const taskGroupsStats = await fs.stat(this.taskGroupsCsvPath);
      const storageSize = taskLogsStats.size + taskGroupsStats.size;

      // 日付範囲計算
      const dates = taskLogs.map((log) => log.date).sort();
      const earliest = dates.length > 0 ? dates[0] : "";
      const latest = dates.length > 0 ? dates[dates.length - 1] : "";

      return {
        totalTaskLogs: taskLogs.length,
        totalTaskGroups: taskGroups.length,
        dateRange: { earliest, latest },
        storageSize,
      };
    } catch (error) {
      throw new DataStoreError(
        `Failed to get stats: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.db.close();
      this.isInitialized = false;
    } catch (error) {
      throw new DataStoreError(
        `Failed to cleanup: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  // === プライベートヘルパーメソッド ===

  /**
   * DuckDBクエリを実行してTaskLogEntry配列を返す
   */
  private async executeCsvQuery(query: string): Promise<TaskLogEntry[]> {
    return new Promise((resolve, reject) => {
      this.db.all(query, (err, rows) => {
        if (err) {
          reject(new DataStoreError(`SQL query failed: ${err.message}`, "UNKNOWN", err));
          return;
        }

        try {
          const entries = rows.map((row: unknown) => {
            const csvRow = row as Record<string, string>;
            return this.csvParser.csvRowToTaskLogEntry({
              date: csvRow.date,
              start_time: csvRow.start_time,
              end_time: csvRow.end_time,
              duration_minutes: csvRow.duration_minutes,
              task_group_id: csvRow.task_group_id,
              task_group_name: csvRow.task_group_name,
              content: csvRow.content,
              created_at: csvRow.created_at,
              updated_at: csvRow.updated_at,
            });
          });
          resolve(entries);
        } catch (parseError) {
          reject(
            new DataStoreError(
              `Failed to parse query results: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
              "VALIDATION_ERROR",
              parseError
            )
          );
        }
      });
    });
  }
}

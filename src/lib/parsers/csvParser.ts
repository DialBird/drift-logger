/**
 * CSV解析とタスクログエントリ変換ユーティリティ
 *
 * このファイルはCSVファイルの読み書きと、CSVデータとタスクログエントリ間の
 * 変換処理を提供します。データ検証も含まれます。
 */

import { promises as fs } from "fs";
import { v4 as uuidv4 } from "uuid";
import { TaskLogEntry, TaskGroup } from "../types/taskLog";
import {
  TaskLogCsvRow,
  TaskGroupCsvRow,
  TASK_LOG_CSV_HEADERS,
  CsvParseError,
  TASK_LOG_CSV_VALIDATION_RULES,
  CsvConfig,
  CsvStats,
} from "../types/csvSchema";

/**
 * CSVパーサークラス
 * CSV操作の中核となるクラス
 */
export class CsvParser {
  private config: CsvConfig;

  constructor(config: Partial<CsvConfig> = {}) {
    this.config = {
      filePath: config.filePath || "",
      hasHeader: config.hasHeader ?? true,
      delimiter: config.delimiter || ",",
      quote: config.quote || '"',
      escape: config.escape || '"',
      encoding: config.encoding || "utf8",
      enableValidation: config.enableValidation ?? true,
    };
  }

  /**
   * タスクログエントリをCSV行に変換
   */
  taskLogEntryToCsvRow(entry: TaskLogEntry): TaskLogCsvRow {
    return {
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      duration_minutes: entry.duration.toString(),
      task_group_id: entry.taskGroupId,
      task_group_name: entry.taskGroupName,
      content: this.escapeCsvValue(entry.content),
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
    };
  }

  /**
   * CSV行をタスクログエントリに変換
   */
  csvRowToTaskLogEntry(row: TaskLogCsvRow, rowIndex?: number): TaskLogEntry {
    // 検証
    if (this.config.enableValidation) {
      this.validateTaskLogCsvRow(row, rowIndex);
    }

    return {
      id: uuidv4(), // CSVにIDが含まれていない場合は新規生成
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: parseInt(row.duration_minutes),
      taskGroupId: row.task_group_id,
      taskGroupName: row.task_group_name,
      content: this.unescapeCsvValue(row.content),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * タスクグループをCSV行に変換
   */
  taskGroupToCsvRow(group: TaskGroup): TaskGroupCsvRow {
    return {
      id: group.id,
      name: this.escapeCsvValue(group.name),
      color: group.color || "",
      created_at: group.createdAt,
      updated_at: group.updatedAt,
      is_active: group.isActive.toString(),
    };
  }

  /**
   * CSV行をタスクグループに変換
   */
  csvRowToTaskGroup(row: TaskGroupCsvRow): TaskGroup {
    return {
      id: row.id,
      name: this.unescapeCsvValue(row.name),
      color: row.color || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active === "true",
    };
  }

  /**
   * CSVファイルを読み込んでタスクログエントリ配列に変換
   */
  async readTaskLogsCsv(filePath?: string): Promise<TaskLogEntry[]> {
    const path = filePath || this.config.filePath;
    if (!path) {
      throw new CsvParseError("CSV file path is required");
    }

    try {
      const content = await fs.readFile(path, this.config.encoding);
      const rows = this.parseCsvContent(content);

      // ヘッダーをスキップ
      const dataRows = this.config.hasHeader ? rows.slice(1) : rows;

      return dataRows.map((row, index) => {
        const csvRow = this.arrayToCsvRow(row, TASK_LOG_CSV_HEADERS) as TaskLogCsvRow;
        return this.csvRowToTaskLogEntry(csvRow, index + (this.config.hasHeader ? 2 : 1));
      });
    } catch (error) {
      if (error instanceof CsvParseError) {
        throw error;
      }
      throw new CsvParseError(
        `Failed to read CSV file: ${error instanceof Error ? error.message : "Unknown error"}`,
        undefined,
        undefined,
        path
      );
    }
  }

  /**
   * タスクログエントリ配列をCSVファイルに書き込み
   */
  async writeTaskLogsCsv(entries: TaskLogEntry[], filePath?: string): Promise<void> {
    const path = filePath || this.config.filePath;
    if (!path) {
      throw new CsvParseError("CSV file path is required");
    }

    try {
      const csvRows = entries.map((entry) => this.taskLogEntryToCsvRow(entry));
      const content = this.generateCsvContent(csvRows, TASK_LOG_CSV_HEADERS);

      await fs.writeFile(path, content, this.config.encoding);
    } catch (error) {
      throw new CsvParseError(
        `Failed to write CSV file: ${error instanceof Error ? error.message : "Unknown error"}`,
        undefined,
        undefined,
        path
      );
    }
  }

  /**
   * CSV文字列を解析して2次元配列に変換
   */
  private parseCsvContent(content: string): string[][] {
    const lines = content.split("\n").filter((line) => line.trim().length > 0);
    const result: string[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const fields = this.parseCsvLine(line);
        result.push(fields);
      } catch (error) {
        throw new CsvParseError(
          `Failed to parse line ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`,
          i + 1,
          undefined,
          line
        );
      }
    }

    return result;
  }

  /**
   * 単一のCSV行を解析
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === this.config.quote) {
        if (inQuotes && nextChar === this.config.quote) {
          // エスケープされたクォート
          current += this.config.quote;
          i += 2;
        } else {
          // クォートの開始/終了
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === this.config.delimiter && !inQuotes) {
        // フィールドの区切り
        result.push(current);
        current = "";
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // 最後のフィールドを追加
    result.push(current);

    return result;
  }

  /**
   * 配列をCSVロウオブジェクトに変換
   */
  private arrayToCsvRow<T>(array: string[], headers: readonly string[]): Record<string, string> {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = array[index] || "";
    });
    return row as T;
  }

  /**
   * CSVコンテンツを生成
   */
  private generateCsvContent<T extends Record<string, string>>(rows: T[], headers: readonly string[]): string {
    const lines: string[] = [];

    // ヘッダー行
    if (this.config.hasHeader) {
      lines.push(headers.map((header) => this.formatCsvField(header)).join(this.config.delimiter));
    }

    // データ行
    rows.forEach((row) => {
      const line = headers.map((header) => this.formatCsvField(row[header] || "")).join(this.config.delimiter);
      lines.push(line);
    });

    return lines.join("\n") + "\n";
  }

  /**
   * CSVフィールドをフォーマット（必要に応じてクォートを追加）
   */
  private formatCsvField(value: string): string {
    // 改行、クォート、区切り文字が含まれている場合はクォートで囲む
    if (
      value.includes(this.config.delimiter) ||
      value.includes(this.config.quote) ||
      value.includes("\n") ||
      value.includes("\r")
    ) {
      // クォート文字をエスケープ
      const escaped = value.replace(new RegExp(this.config.quote, "g"), this.config.quote + this.config.quote);
      return this.config.quote + escaped + this.config.quote;
    }
    return value;
  }

  /**
   * CSV値をエスケープ
   */
  private escapeCsvValue(value: string): string {
    return value.replace(/"/g, '""').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  }

  /**
   * CSV値のエスケープを解除
   */
  private unescapeCsvValue(value: string): string {
    return value.replace(/""/g, '"').replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  }

  /**
   * タスクログCSV行を検証
   */
  private validateTaskLogCsvRow(row: TaskLogCsvRow, rowIndex?: number): void {
    for (const rule of TASK_LOG_CSV_VALIDATION_RULES) {
      const value = (row as Record<string, string>)[rule.field];

      // 必須チェック
      if (rule.required && (!value || value.trim().length === 0)) {
        throw new CsvParseError(
          `${rule.errorMessage || `Field '${rule.field}' is required`}`,
          rowIndex,
          rule.field,
          value
        );
      }

      // パターンチェック
      if (value && rule.pattern && !rule.pattern.test(value)) {
        throw new CsvParseError(
          `${rule.errorMessage || `Field '${rule.field}' has invalid format`}`,
          rowIndex,
          rule.field,
          value
        );
      }

      // カスタムバリデーター
      if (value && rule.validator && !rule.validator(value)) {
        throw new CsvParseError(
          `${rule.errorMessage || `Field '${rule.field}' validation failed`}`,
          rowIndex,
          rule.field,
          value
        );
      }
    }
  }

  /**
   * CSVファイルの統計情報を取得
   */
  async getCsvStats(filePath?: string): Promise<CsvStats> {
    const path = filePath || this.config.filePath;
    if (!path) {
      throw new CsvParseError("CSV file path is required");
    }

    try {
      const stats = await fs.stat(path);
      const content = await fs.readFile(path, this.config.encoding);
      const rows = this.parseCsvContent(content);

      const totalRows = rows.length - (this.config.hasHeader ? 1 : 0);

      return {
        totalRows,
        validRows: totalRows, // TODO: 実際の検証を実装
        errorRows: 0,
        fileSize: stats.size,
        lastModified: stats.mtime,
      };
    } catch (error) {
      throw new CsvParseError(
        `Failed to get CSV stats: ${error instanceof Error ? error.message : "Unknown error"}`,
        undefined,
        undefined,
        path
      );
    }
  }
}

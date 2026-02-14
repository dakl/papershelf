import type { ToolCallStats } from '../../shared/types';
import { generateId, getDb } from './connection';

export function logToolCall(
  toolName: string,
  inputArgs: string,
  durationMs: number,
  status: 'success' | 'error' | 'denied',
  errorMessage?: string,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO tool_call_log (id, tool_name, input_args, duration_ms, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(generateId(), toolName, inputArgs, durationMs, status, errorMessage ?? null);
}

export function getToolStats(): ToolCallStats[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT
        tool_name AS toolName,
        COUNT(*) AS totalCalls,
        MAX(called_at) AS lastCalledAt,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errorCount,
        CAST(AVG(duration_ms) AS INTEGER) AS averageDurationMs
      FROM tool_call_log
      GROUP BY tool_name
      ORDER BY totalCalls DESC`,
    )
    .all() as ToolCallStats[];
}

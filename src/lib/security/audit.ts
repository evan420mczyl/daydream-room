/**
 * ============================================================
 * 安全审计日志（尽力而为，绝不影响主流程）
 * ------------------------------------------------------------
 * - 整个函数 try/catch 吞错：审计写库失败时请求主流程照常进行，
 *   但绝不反转任何已做出的拒绝决定（拒绝发生在调用方，与这里无关）。
 * - detail 只允许白名单化的 reason 码 / result / tokenPrefix（哈希前
 *   8 位）等原语字段 —— 绝不写入密码、密码哈希、令牌 raw、CSRF raw。
 */

import { db } from "@/lib/db";

export type AuditDetail = Record<string, string | number | boolean | null>;

/**
 * detail 字段白名单（写入前逐字段过滤，任何未知键直接丢弃，
 * 防御上游误传敏感字段进日志）。
 */
const DETAIL_KEYS = new Set([
  "result",
  "reason",
  "tokenPrefix",
  "minutes",
  "blocks",
  "blockChars",
]);

export async function audit(
  event: string,
  fields: { slug?: string; ip?: string; detail?: AuditDetail } = {}
): Promise<void> {
  try {
    let detail: string | null = null;
    if (fields.detail) {
      const safe: AuditDetail = {};
      for (const [k, v] of Object.entries(fields.detail)) {
        if (DETAIL_KEYS.has(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null)) {
          safe[k] = v;
        }
      }
      detail = JSON.stringify(safe);
    }
    await db.auditLog.create({
      data: {
        event,
        slug: typeof fields.slug === "string" ? fields.slug : null,
        ip: typeof fields.ip === "string" ? fields.ip : null,
        detail,
      },
    });
  } catch {
    // 审计失败绝不影响请求主流程；同时绝不反转已做出的拒绝决定。
  }
}

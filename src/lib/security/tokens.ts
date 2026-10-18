/**
 * ============================================================
 * 编辑令牌 / CSRF 令牌材料（服务端 only）
 * ------------------------------------------------------------
 * 数据库只存 SHA-256 哈希 —— 数据库泄露也无法重放令牌。
 * 所有令牌比较一律走 timingSafeEqual（常量时间），防止时序侧信道。
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** SHA-256 → 小写 hex */
export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * 生成一枚 256 位令牌：raw（base64url，交给客户端）+ hash（hex，入库）。
 * 32 字节出自 crypto.randomBytes（操作系统 CSPRNG）。
 */
export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: sha256Hex(raw) };
}

/**
 * 常量时间比较两个 hex 哈希串（令牌 / CSRF）。
 * 长度不等直接 false；Buffer 解码异常（非法 hex）也 false —— fail-closed。
 */
export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

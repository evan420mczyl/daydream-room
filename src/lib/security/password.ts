/**
 * ============================================================
 * 密码哈希（argon2id）—— 单一编辑口令面
 * ------------------------------------------------------------
 * OWASP 推荐参数：memoryCost 19456 KiB / timeCost 2 / parallelism 1。
 * verify 永不抛异常：哈希损坏等一切异常一律返回 false（fail-closed）。
 * 绝不用 === 比较哈希 —— argon2 每次哈希带独立随机盐。
 *
 * 容错预案（按 edit-contract 安全设计）：若 Next 路由运行时因
 * Turbopack 无法加载原生模块，则 fallback 到 bcryptjs（bcrypt cost 12，
 * >72 字节先 SHA-256+base64 预哈希，哈希串加 $bcrypt$ 前缀标签）。
 * 当前实现为 argon2id 主路径 + 前缀分发兼容两种历史哈希。
 */

import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import type { Algorithm } from "@node-rs/argon2";

/** OWASP 2024 推荐的 argon2id 参数（19 MiB / 2 passes / 1 thread）
 *  （@node-rs/argon2 的 Algorithm 是 const enum，isolatedModules 下
 *   不能作值导入，故按类型 + 成员值字面量使用：Argon2id = 2） */
const ARGON2ID: Algorithm = 2;

const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** bcrypt 兼容标记前缀（仅当切换容错预案时出现的历史哈希） */
export const BCRYPT_PREFIX = "$bcrypt$";

/**
 * 对明文密码做 argon2id 慢哈希。
 * 失败时异常向上抛 —— 由调用方 fail-closed 拒绝，绝不静默降级。
 */
export async function hashPassword(pw: string): Promise<string> {
  return hash(pw, ARGON2_OPTIONS);
}

/**
 * 校验密码。哈希格式损坏 / 运行时异常 → 一律返回 false（fail-closed），
 * 绝不放行、绝不抛出中断调用方对错误码的统一处理。
 * 兼容带 $bcrypt$ 前缀标签的历史哈希 —— verify 按前缀分发；
 * 未安装 bcryptjs 时对该类哈希直接拒绝。
 */
export async function verifyPassword(hashStr: string, pw: string): Promise<boolean> {
  try {
    if (hashStr.startsWith(BCRYPT_PREFIX)) {
      // 容错预案路径：当前环境未启用 bcryptjs，fail-closed 拒绝。
      return false;
    }
    return await verify(hashStr, pw);
  } catch {
    // 哈希字符串损坏（非 PHC 格式）等 —— 拒绝，绝不放行
    return false;
  }
}

/**
 * 轻量检查哈希串是否疑似损坏（非 argon2 PHC 亦非 bcrypt 标签）。
 * 仅用于审计白名单 reason:"hash_corrupt" 的判定，不参与放行决策。
 */
export function looksLikeKnownHash(hashStr: string): boolean {
  return (
    typeof hashStr === "string" &&
    (hashStr.startsWith("$argon2") || hashStr.startsWith(BCRYPT_PREFIX))
  );
}

/**
 * 密码策略：长度优先于复杂度。12 ≤ len ≤ 128，且不含任何控制字符
 * （\x00-\x1F 与 \x7F 全部拒绝，避免存储层/日志层的控制字符注入）。
 */
export function passwordPolicyOk(pw: string): boolean {
  if (typeof pw !== "string") return false;
  if (pw.length < 12 || pw.length > 128) return false;
  if (/[\x00-\x1F\x7F]/.test(pw)) return false;
  return true;
}

/**
 * 生成随机密码：crypto.randomBytes → base64url → 剔除非字母数字 → 截取 len。
 * 只依赖操作系统 CSPRNG，输出仅含 [A-Za-z0-9]。
 */
export function generatePassword(len = 24): string {
  let out = "";
  while (out.length < len) {
    // 48 字节 base64url ≈ 64 字符，剔除 -_ 后平均仍 ~62，循环至多两轮
    out += randomBytes(48).toString("base64url").replace(/[^a-zA-Z0-9]/g, "");
  }
  return out.slice(0, len);
}

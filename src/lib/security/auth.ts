/**
 * ============================================================
 * 编辑会话授权（核心：对象级授权 / 防越权）
 * ------------------------------------------------------------
 * requireEditAuthz 十步检查链，任何一步不通过即抛 AuthzDenied：
 *   cookie → csrf 头 → 令牌哈希查库 → revoked → consumed →
 *   expired(顺手吊销) → idle(顺手吊销) → scope → slug 绑定(IDOR
 *   核心防线) → CSRF 哈希常量时间比对 → 更新 lastUsedAt。
 * 授权路径上的任何 DB 异常都会向上抛 → 路由外层 catch → 500 拒绝
 * （fail-closed：异常后绝无可能继续执行写操作）。
 */

import type { EditToken } from "@prisma/client";
import { db } from "@/lib/db";
import {
  CSRF_HEADER,
  EDIT_COOKIE,
  EDIT_IDLE_SEC,
  EDIT_TOKEN_TTL_SEC,
} from "@/lib/edit-contract";
import { generateToken, safeEqualHex, sha256Hex } from "./tokens";

/** 授权被拒（reason 仅进审计日志，绝不回给客户端） */
export class AuthzDenied {
  reason: string;
  constructor(reason: string) {
    this.reason = reason;
  }
}

/** 请求体不可读/不合法（content-type 错、超 100KB、JSON 解析失败） */
export class BadRequest {
  message: string;
  constructor(message: string) {
    this.message = message;
  }
}

/** 网关（Caddy）会透传 X-Real-IP / X-Forwarded-For；直连时回落 unknown */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real && real.trim() !== "") return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export function isHttps(req: Request): boolean {
  if (req.headers.get("x-forwarded-proto") === "https") return true;
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

/** 手动解析 cookie 头（不依赖 next/headers，路由处理器内零开销） */
export function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return part.slice(idx + 1).trim();
    }
  }
  return null;
}

/** 编辑令牌 Cookie 属性：HttpOnly + SameSite=Lax + Path=/ + 按协议 Secure */
export function editCookieOptions(req: Request, maxAgeSec: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
    secure: isHttps(req),
  };
}

/**
 * 对象级授权：确认「这枚令牌此刻有权编辑这篇 slug」。
 * 失败一律 throw AuthzDenied（reason 供审计），成功返回令牌行。
 */
export async function requireEditAuthz(slug: string, req: Request): Promise<EditToken> {
  // 1. cookie 与 CSRF 头必须都在
  const cookie = getCookie(req, EDIT_COOKIE);
  if (!cookie) throw new AuthzDenied("no_cookie");
  const csrfHeader = req.headers.get(CSRF_HEADER);
  if (!csrfHeader) throw new AuthzDenied("no_csrf_header");

  // 2. 只拿 cookie 的 SHA-256 哈希查库（库里无明文）
  const tokenHash = sha256Hex(cookie);
  const row = await db.editToken.findUnique({ where: { tokenHash } });
  if (!row) throw new AuthzDenied("bad_token");

  // 3. 吊销 / 已消费（保存成功即旋转消费旧令牌）
  if (row.revoked) throw new AuthzDenied("revoked");
  if (row.consumedAt) throw new AuthzDenied("consumed");

  // 4. 绝对 TTL 过期 —— 顺手把行标记吊销（update 失败则异常上抛 → 500 拒绝）
  const now = Date.now();
  if (now > row.expiresAt.getTime()) {
    await db.editToken.update({ where: { id: row.id }, data: { revoked: true } });
    throw new AuthzDenied("expired");
  }

  // 5. 空闲超时 —— 同样顺手吊销
  if (row.lastUsedAt && now - row.lastUsedAt.getTime() > EDIT_IDLE_SEC * 1000) {
    await db.editToken.update({ where: { id: row.id }, data: { revoked: true } });
    throw new AuthzDenied("idle");
  }

  // 6. 作用域必须是编辑（未来扩展作用域时的硬闸）
  if (row.scope !== "edit") throw new AuthzDenied("scope");

  // 7. 对象级绑定：令牌签发时绑定的 slug 必须等于目标 slug（防 IDOR）
  if (row.slug !== slug) throw new AuthzDenied("slug_mismatch");

  // 8. 双重提交 CSRF：请求头里的 raw 的哈希与库中哈希常量时间比对
  if (!safeEqualHex(sha256Hex(csrfHeader), row.csrfHash)) {
    throw new AuthzDenied("csrf_mismatch");
  }

  // 9. 刷新 lastUsedAt（空闲计时的「最近一次使用」）。更新失败 → 异常上抛
  //    → 外层 500 拒绝（fail-closed，绝不带着旧时间戳继续放行写操作）。
  await db.editToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });

  return row;
}

/**
 * 令牌旋转：消费旧行（revoked + consumedAt）→ 签发新行（继承 slug 与
 * "edit" 作用域、新的 TTL）。调用方在写操作成功之后调用 —— 旧的 raw/CSRF
 * 立即作废，新 raw/CSRF 随响应下发。
 */
export async function rotateToken(
  oldRow: EditToken,
  _req: Request
): Promise<{
  raw: string;
  hash: string;
  csrfRaw: string;
  csrfHash: string;
  expiresAt: Date;
}> {
  await db.editToken.update({
    where: { id: oldRow.id },
    data: { revoked: true, consumedAt: new Date() },
  });
  const token = generateToken();
  const csrf = generateToken();
  const expiresAt = new Date(Date.now() + EDIT_TOKEN_TTL_SEC * 1000);
  await db.editToken.create({
    data: {
      tokenHash: token.hash,
      csrfHash: csrf.hash,
      slug: oldRow.slug,
      scope: "edit",
      expiresAt,
    },
  });
  return {
    raw: token.raw,
    hash: token.hash,
    csrfRaw: csrf.raw,
    csrfHash: csrf.hash,
    expiresAt,
  };
}

/**
 * 读取并解析 JSON 请求体：
 * content-type 必须含 application/json；文本 > 100KB 拒绝；
 * JSON.parse 失败拒绝。三者均抛 BadRequest（→ 400 bad_request）。
 */
export async function readJsonBody(req: Request): Promise<unknown> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.includes("application/json")) {
    throw new BadRequest("content_type");
  }
  const text = await req.text();
  if (text.length > 100 * 1024) {
    throw new BadRequest("too_large");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new BadRequest("json_parse");
  }
}

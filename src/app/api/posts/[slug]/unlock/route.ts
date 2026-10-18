import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDIT_COOKIE, EDIT_TOKEN_TTL_SEC } from "@/lib/edit-contract";
import { getPost } from "@/lib/posts";
import { ensureSettingWithEnv } from "@/lib/editPosts";
import {
  audit,
} from "@/lib/security/audit";
import {
  BadRequest,
  clientIp,
  editCookieOptions,
  readJsonBody,
} from "@/lib/security/auth";
import { looksLikeKnownHash, verifyPassword } from "@/lib/security/password";
import { allowed, recordFailure, recordSuccess } from "@/lib/security/ratelimit";
import { generateToken } from "@/lib/security/tokens";

export const dynamic = "force-dynamic";

/**
 * POST /api/posts/[slug]/unlock —— 用编辑口令换取「编辑这一篇」的
 * 短时效令牌（HttpOnly cookie + CSRF raw 响应体下发）。
 *
 * 防枚举：未知 slug / 密码错 / 未配置口令 / 口令格式损坏 —— 一律
 * 401 unlock_failed 同码同文案。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = clientIp(req);
  try {
    // 1) 限速预检：IP 与 slug 双维度，任一锁定 → 429（不区分哪个维度）
    const ipKey = `ip:${ip}`;
    const slugKey = `slug:${slug}`;
    for (const key of [ipKey, slugKey]) {
      const check = allowed(key);
      if (!check.allowed) {
        await audit("unlock", {
          slug,
          ip,
          detail: { result: "fail", reason: "rate_limited" },
        });
        return NextResponse.json(
          { ok: false, error: "slow_down" },
          { status: 429, headers: { "retry-after": String(check.retryAfterSec) } },
        );
      }
    }

    // 2) 请求体：content-type / 体积 / JSON 语法
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      if (e instanceof BadRequest) {
        return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
      }
      throw e;
    }

    const rejectUnlock = async (reason: string) => {
      recordFailure(ipKey);
      recordFailure(slugKey);
      await audit("unlock", { slug, ip, detail: { result: "fail", reason } });
      return NextResponse.json({ ok: false, error: "unlock_failed" }, { status: 401 });
    };

    // 3) 密码字段必须是非空 string
    const password = (body as { password?: unknown } | null)?.password;
    if (typeof password !== "string" || password.length === 0) {
      return rejectUnlock("malformed");
    }
    // 4) 超长输入早拒：不给 argon2 喂巨串（DoS 防护），同样计入失败
    if (password.length > 512) {
      return rejectUnlock("malformed");
    }

    // 5) 口令配置必须存在（否则 fail-closed 拒绝）
    const setting = await ensureSettingWithEnv();
    if (!setting) {
      return rejectUnlock("no_hash");
    }
    if (!looksLikeKnownHash(setting.passwordHash)) {
      return rejectUnlock("hash_corrupt");
    }

    // 6) 慢哈希校验（内部吞异常 → false，fail-closed）
    const ok = await verifyPassword(setting.passwordHash, password);
    // 7) 静态文章表必须存在该 slug（未知 slug 与错密码同码同文案）
    const exists = !!getPost(slug);
    if (!ok || !exists) {
      return rejectUnlock(exists ? "bad_password" : "unknown_slug");
    }

    // ---- 成功路径 ----
    recordSuccess(ipKey);
    recordSuccess(slugKey);
    const token = generateToken();
    const csrf = generateToken();
    const expiresAt = new Date(Date.now() + EDIT_TOKEN_TTL_SEC * 1000);
    await db.editToken.create({
      data: {
        tokenHash: token.hash,
        csrfHash: csrf.hash,
        slug,
        scope: "edit",
        expiresAt,
      },
    });
    // 顺手清理：TTL 已过 1 小时以上的陈旧令牌行（fire-and-forget）
    void db.editToken
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 3_600_000) } } })
      .catch(() => {});
    await audit("unlock", {
      slug,
      ip,
      detail: { result: "success", tokenPrefix: token.hash.slice(0, 8) },
    });
    const res = NextResponse.json({
      ok: true,
      csrf: csrf.raw,
      expiresAt: expiresAt.toISOString(),
    });
    res.cookies.set(EDIT_COOKIE, token.raw, editCookieOptions(req, EDIT_TOKEN_TTL_SEC));
    return res;
  } catch {
    // fail-closed 兜底：DB 故障 / 任何未预期异常 → 拒绝
    await audit("unlock", {
      slug,
      ip,
      detail: { result: "fail", reason: "server_error" },
    });
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

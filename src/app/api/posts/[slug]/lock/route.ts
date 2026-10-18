import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDIT_COOKIE } from "@/lib/edit-contract";
import { audit } from "@/lib/security/audit";
import {
  AuthzDenied,
  clientIp,
  editCookieOptions,
  requireEditAuthz,
} from "@/lib/security/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/posts/[slug]/lock —— 主动锁定当前编辑会话。
 * 成功 → 吊销令牌行 + 清 cookie（Max-Age=0）。
 * 授权失败 → 也照样清 cookie（无害的防御动作）再返回 403。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = clientIp(req);
  try {
    try {
      const row = await requireEditAuthz(slug, req);
      await db.editToken.update({
        where: { id: row.id },
        data: { revoked: true },
      });
      await audit("lock", {
        slug,
        ip,
        detail: { result: "success" },
      });
      const res = NextResponse.json({ ok: true });
      res.cookies.set(EDIT_COOKIE, "", editCookieOptions(req, 0));
      return res;
    } catch (e) {
      if (e instanceof AuthzDenied) {
        await audit("lock", {
          slug,
          ip,
          detail: { result: "fail", reason: e.reason },
        });
        // 清 cookie 永远无害：令牌已不可用，cookie 也一并作废
        const res = NextResponse.json(
          { ok: false, error: "session_invalid" },
          { status: 403 },
        );
        res.cookies.set(EDIT_COOKIE, "", editCookieOptions(req, 0));
        return res;
      }
      throw e;
    }
  } catch {
    await audit("lock", {
      slug,
      ip,
      detail: { result: "fail", reason: "server_error" },
    });
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

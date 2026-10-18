import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDIT_COOKIE, EDIT_TOKEN_TTL_SEC } from "@/lib/edit-contract";
import { getPost } from "@/lib/posts";
import { mergePost } from "@/lib/editPosts";
import { audit } from "@/lib/security/audit";
import {
  AuthzDenied,
  clientIp,
  editCookieOptions,
  requireEditAuthz,
  rotateToken,
} from "@/lib/security/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/posts/[slug]/reset —— 撤销编辑层，恢复静态原文。
 * 授权链同 save；成功后旋转令牌。响应的 post 为静态原帖（无 editedAt）。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = clientIp(req);
  try {
    // 1) 对象级授权（无请求体，不做 readJsonBody）
    let row;
    try {
      row = await requireEditAuthz(slug, req);
    } catch (e) {
      if (e instanceof AuthzDenied) {
        await audit("reset", {
          slug,
          ip,
          detail: { result: "fail", reason: e.reason },
        });
        return NextResponse.json(
          { ok: false, error: "session_invalid" },
          { status: 403 },
        );
      }
      throw e;
    }

    // 2) 静态原帖必须存在（不存在则连编辑都不可能发生过）
    const staticPost = getPost(slug);
    if (!staticPost) {
      await audit("reset", {
        slug,
        ip,
        detail: { result: "fail", reason: "unknown_slug" },
      });
      return NextResponse.json(
        { ok: false, error: "session_invalid" },
        { status: 403 },
      );
    }

    // 3) 删除编辑覆盖层（没编辑过时 deleteMany 影响 0 行，同样成功）
    await db.postEdit.deleteMany({ where: { slug } });

    // 4) 令牌旋转
    const rotated = await rotateToken(row, req);

    await audit("reset", {
      slug,
      ip,
      detail: { result: "success", tokenPrefix: rotated.hash.slice(0, 8) },
    });

    const res = NextResponse.json({
      ok: true,
      csrf: rotated.csrfRaw,
      expiresAt: rotated.expiresAt.toISOString(),
      post: mergePost(staticPost),
    });
    res.cookies.set(EDIT_COOKIE, rotated.raw, editCookieOptions(req, EDIT_TOKEN_TTL_SEC));
    return res;
  } catch {
    await audit("reset", {
      slug,
      ip,
      detail: { result: "fail", reason: "server_error" },
    });
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

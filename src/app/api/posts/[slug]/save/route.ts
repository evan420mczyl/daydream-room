import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDIT_COOKIE, EDIT_TOKEN_TTL_SEC } from "@/lib/edit-contract";
import { getPost } from "@/lib/posts";
import {
  computeMinutes,
  getMergedPost,
  sanitizeText,
  saveSchema,
} from "@/lib/editPosts";
import { audit } from "@/lib/security/audit";
import {
  AuthzDenied,
  BadRequest,
  clientIp,
  editCookieOptions,
  readJsonBody,
  requireEditAuthz,
  rotateToken,
} from "@/lib/security/auth";
import type { EditBlock } from "@/lib/edit-contract";

export const dynamic = "force-dynamic";

/** zod issue → 安全化提示语（只按字段名映射，绝不回显用户原文） */
function saveErrorMessage(issuePaths: string[]): string {
  for (const field of issuePaths) {
    if (field === "title") return "标题需为 1-80 字的文本";
    if (field === "excerpt") return "导语需为 1-300 字的文本";
    if (field === "minutes") return "阅读时长需为 1-120 的整数（可不填，将自动估算）";
    if (field === "blocks") return "正文需为 1-100 个文本块，每块 1-5000 字，类型只支持 p/h2/quote";
  }
  return "内容格式有问题，请检查后再保存";
}

/**
 * POST /api/posts/[slug]/save —— 保存编辑。
 * 授权链（requireEditAuthz 十步）→ 白名单校验 → 净化 → upsert →
 * 令牌旋转（旧 raw/CSRF 立即作废，新材料随响应下发）。
 * 任何失败一律 session_invalid / bad_request / server_error，绝不区分
 * 「令牌过期 / 越权 / CSRF 失败」等具体原因（防探测）。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = clientIp(req);
  try {
    // 1) 对象级授权：令牌必须绑定这个 slug（防 IDOR 核心防线）
    let row;
    try {
      row = await requireEditAuthz(slug, req);
    } catch (e) {
      if (e instanceof AuthzDenied) {
        await audit("save", {
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

    // 2) 请求体
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      if (e instanceof BadRequest) {
        return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
      }
      throw e;
    }

    // 3) zod 白名单校验
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      const fields = parsed.error.issues.map(
        (i) => String((i.path as readonly unknown[])[0] ?? ""),
      );
      await audit("save", {
        slug,
        ip,
        detail: { result: "fail", reason: "validation" },
      });
      return NextResponse.json(
        { ok: false, error: "bad_request", message: saveErrorMessage(fields) },
        { status: 400 },
      );
    }

    // 4) 纵深防御：静态文章表必须存在该 slug（理论上 unlock 已挡，
    //    但保存路径独立再验一次，防「令牌签发后静态表变化」类边缘）
    if (!getPost(slug)) {
      await audit("save", {
        slug,
        ip,
        detail: { result: "fail", reason: "unknown_slug" },
      });
      return NextResponse.json(
        { ok: false, error: "session_invalid" },
        { status: 403 },
      );
    }

    // 5) 净化（控制字符剥离）+ 净化后防御性复检非空
    const title = sanitizeText(parsed.data.title);
    const excerpt = sanitizeText(parsed.data.excerpt);
    const blocks: EditBlock[] = parsed.data.blocks.map((b) => ({
      type: b.type,
      text: sanitizeText(b.text),
    }));
    if (title.length === 0 || excerpt.length === 0 || blocks.some((b) => b.text.length === 0)) {
      await audit("save", {
        slug,
        ip,
        detail: { result: "fail", reason: "validation" },
      });
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "内容不能只由控制字符组成" },
        { status: 400 },
      );
    }
    const minutes = parsed.data.minutes ?? computeMinutes(blocks);

    // 6) 落库（upsert：同 slug 覆盖编辑层）
    await db.postEdit.upsert({
      where: { slug },
      create: { slug, title, excerpt, minutes, blocks: JSON.stringify(blocks) },
      update: { title, excerpt, minutes, blocks: JSON.stringify(blocks) },
    });

    // 7) 令牌旋转：旧行 revoked+consumed，新行继承 slug/scope
    const rotated = await rotateToken(row, req);

    await audit("save", {
      slug,
      ip,
      detail: {
        result: "success",
        tokenPrefix: rotated.hash.slice(0, 8),
        minutes,
        blocks: blocks.length,
      },
    });

    // 8) 响应：新 CSRF raw + 新令牌 cookie + 合并后的这篇 LivePost
    const post = await getMergedPost(slug);
    if (!post) {
      // getPost 已确认存在，这里理论上不可达；fail-closed 兜底
      throw new Error("post_missing_after_save");
    }
    const res = NextResponse.json({
      ok: true,
      csrf: rotated.csrfRaw,
      expiresAt: rotated.expiresAt.toISOString(),
      post,
    });
    res.cookies.set(EDIT_COOKIE, rotated.raw, editCookieOptions(req, EDIT_TOKEN_TTL_SEC));
    return res;
  } catch {
    await audit("save", {
      slug,
      ip,
      detail: { result: "fail", reason: "server_error" },
    });
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

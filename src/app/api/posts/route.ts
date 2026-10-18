import { NextResponse } from "next/server";
import { getMergedPosts } from "@/lib/editPosts";

export const dynamic = "force-dynamic";

/**
 * GET /api/posts —— 静态原文 + 数据库编辑覆盖层的合并视图。
 * 任何异常 → 500 {ok:false,error:"server_error"}（fail-closed，绝不
 * 回退成「只给静态数据」的降级 —— 宁可让前端看到失败）。
 */
export async function GET() {
  try {
    const { posts, featured } = await getMergedPosts();
    return NextResponse.json(
      { ok: true, posts, featured },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

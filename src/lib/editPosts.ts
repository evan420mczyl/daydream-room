/**
 * ============================================================
 * 服务端数据合并 / 校验（「凭密码编辑文章」子系统，服务端 only）
 * ------------------------------------------------------------
 * - saveSchema：zod 白名单校验（结构化纯文本，非 HTML）
 * - getMergedPosts：静态原文（src/lib/posts.ts）+ PostEdit 覆盖层合并
 * - ensureSettingWithEnv：编辑口令缺失时尝试从 EDIT_PASSWORD 环境变量
 *   落库；任何不满足策略的情况都返回 null（fail-closed）
 */

import { z } from "zod";
import type { EditSetting, PostEdit } from "@prisma/client";
import { db } from "@/lib/db";
import { allPosts, getPost, type Post } from "@/lib/posts";
import {
  BLOCK_TYPES,
  MAX_BLOCK_LEN,
  MAX_BLOCKS,
  MAX_EXCERPT_LEN,
  MAX_TITLE_LEN,
  type EditBlock,
  type LivePost,
} from "@/lib/edit-contract";
import { hashPassword, passwordPolicyOk } from "@/lib/security/password";

/** 保存载荷白名单校验：未知键剥离、长度上限、类型枚举 */
export const saveSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_LEN),
  excerpt: z.string().trim().min(1).max(MAX_EXCERPT_LEN),
  minutes: z.number().int().min(1).max(120).optional(),
  blocks: z
    .array(
      z.object({
        type: z.enum(BLOCK_TYPES),
        text: z.string().trim().min(1).max(MAX_BLOCK_LEN),
      }),
    )
    .min(1)
    .max(MAX_BLOCKS),
});

export type SavePayload = z.infer<typeof saveSchema>;

/**
 * 文本净化：\r\n → \n；剥离除 \n(\x0A) 与 \t(\x09) 外的全部控制字符。
 * （zod 已做 trim —— 前后空白不会进入这里。）
 */
export function sanitizeText(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/** 阅读分钟：总字符数 ÷ 400 向上取整，夹在 1..60 */
export function computeMinutes(blocks: EditBlock[]): number {
  const totalChars = blocks.reduce((sum, b) => sum + b.text.length, 0);
  return Math.min(60, Math.max(1, Math.ceil(totalChars / 400)));
}

/** 读全站编辑口令配置（EditSetting 全局单行） */
export async function getSetting(): Promise<EditSetting | null> {
  return db.editSetting.findUnique({ where: { id: "global" } });
}

/**
 * 口令行不存在时尝试用 EDIT_PASSWORD 环境变量补建（哈希入库）。
 * 环境变量缺失 / 不满足密码策略 / DB 故障 → 返回 null，调用方一律
 * 按「无哈希」fail-closed 拒绝。
 */
export async function ensureSettingWithEnv(): Promise<EditSetting | null> {
  const existing = await getSetting();
  if (existing) return existing;
  const envPw = process.env.EDIT_PASSWORD;
  if (!envPw || !passwordPolicyOk(envPw)) return null;
  const passwordHash = await hashPassword(envPw);
  try {
    return await db.editSetting.create({
      data: { id: "global", passwordHash, algo: "argon2id" },
    });
  } catch {
    // 并发竞争（他请求已建行）或 DB 故障 —— 本次 fail-closed 拒绝，
    // 已存在行的场景下次请求 getSetting 即可命中。
    return null;
  }
}

/** PostEdit.blocks 的防御性解析：任何结构不符即回退 undefined（用静态原文） */
function parseBlocksSafe(raw: string): EditBlock[] | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const out: EditBlock[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) return undefined;
      const { type, text } = item as Record<string, unknown>;
      if (
        (type === "p" || type === "h2" || type === "quote") &&
        typeof text === "string"
      ) {
        out.push({ type, text });
      } else {
        return undefined;
      }
    }
    return out.length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

/** 单篇合并：静态元数据 + 编辑覆盖层；editedAt 存在即「已被编辑过」 */
export function mergePost(post: Post, edit?: PostEdit | null): LivePost {
  if (!edit) {
    return {
      slug: post.slug,
      title: post.title,
      category: post.category,
      date: post.date,
      accent: post.accent,
      excerpt: post.excerpt,
      minutes: post.minutes,
      blocks: post.blocks,
    };
  }
  const blocks = parseBlocksSafe(edit.blocks) ?? post.blocks;
  return {
    slug: post.slug,
    title: edit.title,
    category: post.category,
    date: post.date,
    accent: post.accent,
    excerpt: edit.excerpt,
    minutes: edit.minutes,
    blocks,
    editedAt: edit.updatedAt.toISOString(),
  };
}

/** 全量合并视图：GET /api/posts 的数据源（8 篇 + featured=首篇） */
export async function getMergedPosts(): Promise<{ posts: LivePost[]; featured: LivePost }> {
  const edits = await db.postEdit.findMany();
  const editMap = new Map(edits.map((e) => [e.slug, e]));
  const livePosts = allPosts.map((p) => mergePost(p, editMap.get(p.slug)));
  return { posts: livePosts, featured: livePosts[0] };
}

/** 单篇合并视图：save/reset 响应里 post 字段的数据源 */
export async function getMergedPost(slug: string): Promise<LivePost | null> {
  const post = getPost(slug);
  if (!post) return null;
  const edit = await db.postEdit.findUnique({ where: { slug } });
  return mergePost(post, edit);
}

"use client";

/**
 * ------------------------------------------------------------
 * 文章运行时仓库（zustand）
 * ------------------------------------------------------------
 * 初始值 = 构建期静态数据（@/lib/posts），服务端渲染与首屏
 * 与纯静态版完全一致；挂载后 refreshPosts() 尝试用后端
 * /api/posts（合并了编辑覆盖层的 LivePost 列表）覆盖之。
 * 任何失败都静默回退静态兜底——后端未就绪时站点照常工作。
 */

import { create } from "zustand";
import { allPosts, featuredPost } from "@/lib/posts";
import type { LivePost } from "@/lib/edit-contract";

type PostsState = {
  all: LivePost[];
  featured: LivePost;
  hydrated: boolean;
  setFromApi: (all: LivePost[], featured: LivePost) => void;
  /** 单篇就地替换（保存/恢复后的即时反馈，随后 refreshPosts 权威再同步） */
  patchPost: (post: LivePost) => void;
};

export const usePostsStore = create<PostsState>((set) => ({
  all: allPosts as LivePost[],
  featured: featuredPost as LivePost,
  hydrated: false,
  setFromApi: (all, featured) => set({ all, featured, hydrated: true }),
  patchPost: (post) =>
    set((s) => ({
      all: s.all.map((p) => (p.slug === post.slug ? post : p)),
      featured: s.featured.slug === post.slug ? post : s.featured,
    })),
}));

function isLivePost(v: unknown): v is LivePost {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Partial<LivePost>;
  return (
    typeof p.slug === "string" &&
    typeof p.title === "string" &&
    typeof p.excerpt === "string" &&
    typeof p.minutes === "number" &&
    Array.isArray(p.blocks)
  );
}

/**
 * 拉取后端文章列表并水合 store。
 * - 仅在 res.ok 且 data.ok 且 posts 为合法数组且 featured 合法时覆盖；
 * - 任何异常（404 / 网络失败 / 结构不对）都静默保持静态兜底。
 */
export async function refreshPosts(): Promise<void> {
  try {
    const res = await fetch("/api/posts", { cache: "no-store" });
    if (!res.ok) return;
    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null) return;
    const d = data as { ok?: unknown; posts?: unknown; featured?: unknown };
    if (d.ok !== true || !Array.isArray(d.posts) || !isLivePost(d.featured)) return;
    if (!d.posts.every(isLivePost)) return;
    usePostsStore.getState().setFromApi(d.posts as LivePost[], d.featured);
  } catch {
    // 静默回退：静态数据兜底（后端未就绪 / 网络抖动均属预期）
  }
}

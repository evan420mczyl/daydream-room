"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
import HomeView from "@/components/HomeView";
import PostView from "@/components/PostView";
import { getPost } from "@/lib/posts";
import { refreshPosts } from "@/lib/posts-store";

/**
 * 单页博客壳：所有文章都是域名下的独立链接（#/posts/<slug>），
 * hash 变化即切换视图——浏览器前进/后退、直链打开都走同一条路。
 */

function parseHash(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(/^#\/posts\/([a-z0-9-]+)/i);
  const slug = m?.[1];
  return slug && getPost(slug) ? slug : null;
}

function clearHash() {
  history.pushState(null, "", window.location.pathname + window.location.search);
}

export default function BlogShell() {
  const [slug, setSlug] = useState<string | null>(null);
  const view: "home" | "post" = slug ? "post" : "home";
  const pendingScroll = useRef<string | null>(null);

  // 挂载即水合一次：尝试用后端编辑覆盖层刷新文章数据（失败静默回退静态兜底）
  useEffect(() => {
    refreshPosts();
  }, []);

  // 地址栏 → 视图（hashchange 覆盖点击与浏览器历史两种来源）
  useEffect(() => {
    const sync = () => setSlug(parseHash());
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  // 视图 → 滚动安置：进文章回顶部；回家按需滚到指定区块
  useEffect(() => {
    if (view === "post") {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    const target = pendingScroll.current;
    pendingScroll.current = null;
    if (target) {
      const timer = setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 90);
      return () => clearTimeout(timer);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }, [view, slug]);

  // Header 的站内导航（品牌 / 主推 / 文章 / 关于）
  const handleNavSection = useCallback((id: string) => {
    if (id === "top") {
      if (parseHash() !== null) {
        pendingScroll.current = null;
        clearHash();
        setSlug(null);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    if (parseHash() !== null) {
      // 从文章里点导航：先回家，再滚到对应区块
      pendingScroll.current = id;
      clearHash();
      setSlug(null);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // 文章页的「回游乐场」：回家并滚到文章索引
  const handleBackToIndex = useCallback(() => {
    if (parseHash() !== null) {
      pendingScroll.current = "posts";
      clearHash();
      setSlug(null);
    }
  }, []);

  return (
    <>
      <Header onNavSection={handleNavSection} />
      <div key={view === "post" ? `post-${slug}` : "home"} className="view-swap">
        {view === "post" && slug ? <PostView slug={slug} onBackToIndex={handleBackToIndex} /> : <HomeView />}
      </div>
      <Footer />
      <BackToTop />
    </>
  );
}

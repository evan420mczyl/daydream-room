"use client";

import { ACCENT_HEX } from "@/lib/posts";
import { usePostsStore } from "@/lib/posts-store";
import { StickerStar } from "./dolls";
import Reveal from "./Reveal";

export default function ArticleIndex() {
  const all = usePostsStore((s) => s.all);

  return (
    <section id="posts" className="wrap" style={{ marginTop: "var(--section-gap)" }}>
      <Reveal>
        <div className="section-head">
          <h2>写过的东西</h2>
          <span className="mono">Index — {String(all.length).padStart(2, "0")} 篇</span>
        </div>
      </Reveal>
      <div className="post-list">
        {all.map((post, i) => (
          <Reveal key={post.slug} delay={Math.min(i * 70, 350)}>
            <a
              className="post-row"
              href={`#/posts/${post.slug}`}
              style={{ ["--row-accent" as string]: ACCENT_HEX[post.accent as keyof typeof ACCENT_HEX] ?? ACCENT_HEX.coral }}
            >
              <span className="num">{String(i + 1).padStart(2, "0")}</span>
              <span className="title">
                <StickerStar />
                {post.title}
              </span>
              <span className="tag mono">
                <i className="dot" style={{ ["--dot" as string]: ACCENT_HEX[post.accent as keyof typeof ACCENT_HEX] ?? ACCENT_HEX.coral }} />
                {post.category}
              </span>
              <span className="date">{post.date}</span>
              <span className="go" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 7h10M8 3l4 4-4 4" />
                </svg>
              </span>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

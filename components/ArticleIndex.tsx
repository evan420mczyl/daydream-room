import Link from "next/link";
import { allPosts, ACCENT_HEX } from "@/lib/posts";
import { StickerStar } from "./dolls";
import Reveal from "./Reveal";

export default function ArticleIndex() {
  return (
    <section id="posts" className="wrap" style={{ marginTop: "var(--section-gap)" }}>
      <Reveal>
        <div className="section-head">
          <h2>架上的东西</h2>
          <span className="mono">Index — {String(allPosts.length).padStart(2, "0")} 篇</span>
        </div>
      </Reveal>
      <div className="post-list">
        {allPosts.map((post, i) => (
          <Reveal key={post.slug} delay={Math.min(i * 70, 350)}>
            <Link
              className="post-row"
              href={`/posts/${post.slug}`}
              style={{ ["--row-accent" as string]: ACCENT_HEX[post.accent] }}
            >
              <span className="num">{String(i + 1).padStart(2, "0")}</span>
              <span className="title">
                <StickerStar />
                {post.title}
              </span>
              <span className="tag mono">
                <i className="dot" style={{ ["--dot" as string]: ACCENT_HEX[post.accent] }} />
                {post.category}
              </span>
              <span className="date">{post.date}</span>
              <span className="go" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#221D16" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 7h10M8 3l4 4-4 4" />
                </svg>
              </span>
            </Link>
            {post.branches && (
              <div className="post-branches">
                {post.branches.map((branch, idx) => (
                  <span key={idx} className="post-branch-tag">
                    {branch}
                  </span>
                ))}
              </div>
            )}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

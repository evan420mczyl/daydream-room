import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import ReadingProgress from "@/components/ReadingProgress";
import BackToTop from "@/components/BackToTop";
import AsideObserver from "@/components/AsideObserver";
import { DollStar, DollBlob, DollGhost, DollLong, DollCloud } from "@/components/dolls";
import { allPosts, getPost, ACCENT_HEX, type Post } from "@/lib/posts";
import ThemeToggle from "@/components/ThemeToggle";

export function generateStaticParams() {
  return allPosts.map((p) => ({ slug: p.slug }));
}

// 只有上面列出的 slug 才渲染，其余直接 404（保证纯静态、无运行时渲染）
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  return {
    title: post?.title,
    description: post?.excerpt,
    alternates: { canonical: `/posts/${slug}` },
  };
}

/** 颜色吉祥物：文章的点缀色是什么，迎客的就是什么颜色的住员 */
const ACCENT_DOLL: Record<Post["accent"], (p: { className?: string }) => React.ReactNode> = {
  coral: DollBlob,
  mustard: DollStar,
  indigo: DollLong,
  mint: DollGhost,
  lilac: DollCloud,
};

function NavCard({ post, direction }: { post?: Post; direction: "prev" | "next" }) {
  if (!post) {
    // 到头了：给一张回架子的卡片，不让布局塌掉
    return (
      <Link className={`nav-card nav-card--index ${direction}`} href="/#posts">
        <span className="mono">{direction === "prev" ? "← 到头啦" : "到头啦 →"}</span>
        <span className="nav-title">回架上逛逛</span>
      </Link>
    );
  }
  const accent = ACCENT_HEX[post.accent];
  return (
    <Link
      className={`nav-card ${direction}`}
      href={`/posts/${post.slug}`}
      style={{ ["--card-accent" as string]: accent }}
    >
      <span className="mono">{direction === "prev" ? "← 上一篇" : "下一篇 →"}</span>
      <span className="nav-title">{post.title}</span>
      <span className="nav-cat mono">
        <i className="dot" style={{ ["--dot" as string]: accent }} />
        {post.category} · 约 {post.minutes} 分钟
      </span>
    </Link>
  );
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const accent = ACCENT_HEX[post.accent];
  const index = allPosts.findIndex((p) => p.slug === post.slug);
  const prev = allPosts[index - 1];
  const next = allPosts[index + 1];
  const HostDoll = ACCENT_DOLL[post.accent] ?? DollBlob;

  return (
    <>
      <Header />
      <ReadingProgress color={accent} />

      <main className="post-accent" style={{ ["--accent" as string]: accent }}>
        <div className="wrap post-hero">
          <Link className="back-link" href="/#posts">
            <span className="arr">←</span> 回陈列室
          </Link>

          <div className="post-layout">
            {/* 陪读侧栏：从标题高度开始，一路陪到送别 */}
            <aside className="post-aside">
              <dl className="aside-meta mono">
                <div><dt>陈列位置</dt><dd>{post.category}</dd></div>
                <div><dt>上架日期</dt><dd>{post.date}</dd></div>
                <div><dt>阅读约需</dt><dd>{post.minutes} 分钟</dd></div>
              </dl>
              <div className="aside-doll" aria-hidden="true">
                <span className="float-b">
                  <HostDoll />
                </span>
              </div>
              <p className="aside-note mono">写在架子上 · No.{String(index + 1).padStart(3, "0")}</p>
            </aside>

            <div className="post-main">
              <Reveal>
                <div className="post-head">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                    <p className="kicker mono">
                      <i className="dot" style={{ ["--dot" as string]: accent }} />
                      {post.category} · {post.date} · 约 {post.minutes} 分钟
                    </p>
                    <ThemeToggle />
                  </div>
                  <h1 className="post-title">{post.title}</h1>
                  <p className="post-lead">{post.excerpt}</p>
                </div>
              </Reveal>

              {post.branches && post.branches.length > 0 && (
                <Reveal delay={80}>
                  <div className="post-branches" style={{ paddingLeft: 0, marginTop: "1.2rem" }}>
                    {post.branches.map((branch, idx) => (
                      <span key={idx} className="post-branch-tag">
                        {branch}
                      </span>
                    ))}
                  </div>
                </Reveal>
              )}

              <Reveal delay={100}>
                <div className="article-body">
                  {post.blocks.map((block, i) => {
                    if (block.type === "h2") return <h2 key={i}>{block.text}</h2>;
                    if (block.type === "quote") return <p key={i} className="pull">{block.text}</p>;
                    return <p key={i}>{block.text}</p>;
                  })}
                </div>
              </Reveal>

              <div className="post-end" aria-hidden="true">
                <span className="star">✳</span>
                <span className="mono">读完啦，喝口水吧</span>
                <span className="star">✳</span>
              </div>

              {/* 送别小队：全员到齐（此刻侧栏的迎宾已谢幕退场） */}
              <div className="post-dolls" aria-hidden="true">
                {[
                  { C: DollBlob, float: "float-a" },
                  { C: DollStar, float: "float-b" },
                  { C: DollLong, float: "float-c" },
                  { C: DollGhost, float: "sway" },
                  { C: DollCloud, float: "float-b" },
                ].map(({ C, float }, i) => (
                  <span key={i} className={`pd-${i + 1} ${float}`}>
                    <C />
                  </span>
                ))}
              </div>

              <AsideObserver />

              <nav className="post-nav" aria-label="上一篇 / 下一篇">
                <NavCard post={prev} direction="prev" />
                <NavCard post={next} direction="next" />
              </nav>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <BackToTop />
    </>
  );
}

import Reveal from "@/components/Reveal";
import ReadingProgress from "@/components/ReadingProgress";
import AsideObserver from "@/components/AsideObserver";
import PostEditPanel from "@/components/PostEditPanel";
import { DollStar, DollBlob, DollGhost, DollLong, DollCloud } from "@/components/dolls";
import { getPost, ACCENT_HEX, type Post } from "@/lib/posts";
import { usePostsStore } from "@/lib/posts-store";
import type { LivePost } from "@/lib/edit-contract";

/** 颜色吉祥物：文章的点缀色是什么，迎客的就是什么颜色的住员 */
const ACCENT_DOLL: Record<Post["accent"], (p: { className?: string }) => React.ReactNode> = {
  coral: DollBlob,
  mustard: DollStar,
  indigo: DollLong,
  mint: DollGhost,
  lilac: DollCloud,
};

/** LivePost.accent 是 string（后端合并层）：归一到站内五色，未知值回落珊瑚 */
const ACCENT_KEYS: Post["accent"][] = ["coral", "mustard", "indigo", "mint", "lilac"];
function accentKey(a: string): Post["accent"] {
  return ACCENT_KEYS.includes(a as Post["accent"]) ? (a as Post["accent"]) : "coral";
}

/** 最近编辑：YYYY.MM.DD HH:mm（本地时区，padStart 补零） */
function formatEditedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function NavCard({
  post,
  direction,
  onBackToIndex,
}: {
  post?: LivePost;
  direction: "prev" | "next";
  onBackToIndex: () => void;
}) {
  if (!post) {
    // 到头了：给一张回架子的卡片，不让布局塌掉
    return (
      <button type="button" className={`nav-card nav-card--index ${direction}`} onClick={onBackToIndex}>
        <span className="mono">{direction === "prev" ? "← 到头啦" : "到头啦 →"}</span>
        <span className="nav-title">回首页逛逛</span>
      </button>
    );
  }
  const accent = ACCENT_HEX[accentKey(post.accent)];
  return (
    <a
      className={`nav-card ${direction}`}
      href={`#/posts/${post.slug}`}
      style={{ ["--card-accent" as string]: accent }}
    >
      <span className="mono">{direction === "prev" ? "← 上一篇" : "下一篇 →"}</span>
      <span className="nav-title">{post.title}</span>
      <span className="nav-cat mono">
        <i className="dot" style={{ ["--dot" as string]: accent }} />
        {post.category} · 约 {post.minutes} 分钟
      </span>
    </a>
  );
}

export default function PostView({ slug, onBackToIndex }: { slug: string; onBackToIndex: () => void }) {
  const all = usePostsStore((s) => s.all);
  const post: LivePost | undefined = all.find((p) => p.slug === slug) ?? getPost(slug); // 静态兜底
  if (!post) return null;

  const accent = ACCENT_HEX[accentKey(post.accent)];
  const index = all.findIndex((p) => p.slug === post.slug);
  const prev = all[index - 1];
  const next = all[index + 1];
  const HostDoll = ACCENT_DOLL[accentKey(post.accent)] ?? DollBlob;

  return (
    <>
      <ReadingProgress color={accent} />

      <main id="top" className="post-accent" style={{ ["--accent" as string]: accent }}>
        <div className="wrap post-hero">
          <button type="button" className="back-link" onClick={onBackToIndex}>
            <span className="arr">←</span> 回游乐场
          </button>

          <div className="post-layout">
            {/* 陪读侧栏：从标题高度开始，一路陪到送别 */}
            <aside className="post-aside">
              <dl className="aside-meta mono">
                <div><dt>分类</dt><dd>{post.category}</dd></div>
                <div><dt>发布日期</dt><dd>{post.date}</dd></div>
                <div><dt>阅读约需</dt><dd>{post.minutes} 分钟</dd></div>
                {post.editedAt ? (
                  <div><dt>最近编辑</dt><dd>{formatEditedAt(post.editedAt)}</dd></div>
                ) : null}
              </dl>
              <div className="aside-doll" aria-hidden="true">
                <span className="float-b">
                  <HostDoll />
                </span>
              </div>
              <p className="aside-note mono">写在游乐场里 · No.{String(index + 1).padStart(3, "0")}</p>
            </aside>

            <div className="post-main">
              <Reveal>
                <div className="post-head">
                  <p className="kicker mono">
                    <i className="dot" style={{ ["--dot" as string]: accent }} />
                    {post.category} · {post.date} · 约 {post.minutes} 分钟
                  </p>
                  <h1 className="post-title">{post.title}</h1>
                  <p className="post-lead">{post.excerpt}</p>
                  <div className="post-edit-row">
                    <PostEditPanel post={post} />
                  </div>
                </div>
              </Reveal>

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
                <span className="mono">读完啦，去写点代码吧</span>
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
                <NavCard post={prev} direction="prev" onBackToIndex={onBackToIndex} />
                <NavCard post={next} direction="next" onBackToIndex={onBackToIndex} />
              </nav>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

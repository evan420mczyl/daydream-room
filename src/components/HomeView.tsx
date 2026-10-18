import dynamic from "next/dynamic";
import HollowText from "@/components/HollowText";
import HeroParallax from "@/components/HeroParallax";
import Marquee from "@/components/Marquee";
import ArticleIndex from "@/components/ArticleIndex";
import Reveal from "@/components/Reveal";
import { DollBlob, DollStar, DollLong, DollGhost, DollCloud } from "@/components/dolls";
import { featuredPost, ACCENT_HEX } from "@/lib/posts";
import { usePostsStore } from "@/lib/posts-store";

// three.js 只服务首屏装饰层，拆成独立 chunk 懒加载，不拖慢首屏 JS
const HeroCanvas = dynamic(() => import("@/components/HeroCanvas"));

// 3D 玩偶屋：团团的交互展台（真实光影 + 星尘粒子 + 拖拽旋转）
const ToyStage3D = dynamic(() => import("@/components/ToyStage3D"));

export default function HomeView() {
  const featured = usePostsStore((s) => s.featured);

  return (
    <main id="top">
      {/* ---------- Hero ---------- */}
      <section className="hero wrap">
        <div className="hero-meta mono">
          <span>Evan&apos;s Playground — 个人博客</span>
          <span>Vol.01 / 2026 秋</span>
        </div>

        <div className="hero-stage">
          <h1 className="hero-title" id="hero-title">
            <span className="line">Evan 的</span>
            <span className="line line-2">
              <HollowText text="游乐场" className="hollow-svg" />
            </span>
          </h1>
          <HeroCanvas className="hero-canvas-wrap" />

          {/* 左下负空间的水印大字：让空白是设计，不是事故 */}
          <span className="hero-watermark" aria-hidden="true">PLAYGROUND</span>

          <HeroParallax />

          <span className="hero-doll-1 float-a">
            <DollBlob />
          </span>
          <span className="hero-doll-2 float-b">
            <DollStar />
          </span>
          <span className="hero-doll-3 sway">
            <DollLong />
          </span>
        </div>

        <div className="hero-bottom">
          <p className="hero-intro">
            这里是我折腾<strong>代码和 AI</strong> 的地方：
            <span className="no-break">编程笔记、</span>
            <span className="no-break">工具踩坑、</span>
            <span className="no-break">和一些周末瞎做的小项目。</span>
            <span className="no-break">欢迎<strong>随便逛</strong>，</span>看到好玩的点个 star。
          </p>
          <span className="scroll-hint mono">
            往下逛逛
            <i className="bar" aria-hidden="true" />
          </span>
        </div>
      </section>

      <Marquee />

      {/* ---------- 本周主推 ---------- */}
      <section id="featured" className="wrap" style={{ marginTop: "var(--section-gap)" }}>
        <Reveal>
          <div className="section-head">
            <h2>本周主推</h2>
            <span className="mono">Featured — No.001</span>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <article className="featured">
            <i className="tape" style={{ ["--tape" as string]: ACCENT_HEX[featuredPost.accent] }} aria-hidden="true" />
            <div>
              <p className="featured-kicker mono">
                <i className="dot" style={{ ["--dot" as string]: ACCENT_HEX[featuredPost.accent] }} />
                {featured.category} · {featured.date} · 约 {featured.minutes} 分钟
              </p>
              <h3 className="featured-title">
                {featured.editedAt ? (
                  featured.title
                ) : (
                  <>
                    我的早晨仪式：和 AI <span className="hl hl-mustard">结对编程</span> 的第一小时
                  </>
                )}
              </h3>
              <p className="featured-excerpt">{featured.excerpt}</p>
              <div className="featured-meta">
                <a className="btn" href={`#/posts/${featuredPost.slug}`}>
                  开始阅读 <span className="arr">→</span>
                </a>
                <span className="mono">祝你写得开心</span>
              </div>
            </div>
            <div className="featured-stage" aria-hidden="true">
              <b className="charm" style={{ left: "8%", top: "12%", ["--charm" as string]: "#FF6A55" }}>✳</b>
              <b className="charm" style={{ right: "10%", top: "30%", ["--charm" as string]: "#9B7EDE", animationDelay: "-2s" }}>✦</b>
              <b className="charm" style={{ left: "18%", bottom: "26%", ["--charm" as string]: "#4C5BD6", animationDelay: "-4s" }}>✳</b>
              <i className="platform" />
              <span className="float-b">
                <DollGhost />
              </span>
            </div>
          </article>
        </Reveal>
      </section>

      {/* ---------- 文章索引 ---------- */}
      <ArticleIndex />

      {/* ---------- 3D 玩偶屋 ---------- */}
      <section id="toys" className="wrap" style={{ marginTop: "var(--section-gap)" }}>
        <Reveal>
          <div className="section-head">
            <h2>玩偶屋 · 3D</h2>
            <span className="mono">Toy Room — 新住客的玻璃展台</span>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="toy-shell">
            <div className="toy-stage">
              <ToyStage3D className="toy-canvas" />
              <span className="toy-tag mono" aria-hidden="true">3D · LIVE</span>
              <span className="toy-hint mono" aria-hidden="true">
                ✳ 按住拖动 · 滚轮缩放
              </span>
            </div>
            <aside className="toy-side">
              <p className="toy-side-kicker mono">Resident No.002</p>
              <h3 className="toy-side-title">小方<span className="toy-side-sub">CUBIE · GLASS BOT</span></h3>
              <p className="toy-side-text">
                游乐场的新住客：一只<strong>陶瓷与深色玻璃</strong>拼成的小方块机器人。
                眼睛是不眨的星子，天线顶着一点粉色信号灯；
                两圈金属轨道环、七颗巡游的彩色小方块，
                外加<strong>一千四百颗星尘</strong>绕着它慢慢飘——
                想看背面？拖住转一圈；滚轮往上一滚，还能凑近看玻璃上的反光。
              </p>
              <ul className="toy-feats mono">
                <li>
                  <i style={{ ["--c" as string]: "#FF6A55" }} />
                  陶瓷 × 深色玻璃 · 清漆高光真实反射
                </li>
                <li>
                  <i style={{ ["--c" as string]: "#F0B23E" }} />
                  星尘粒子 · 1400 颗环绕漂浮
                </li>
                <li>
                  <i style={{ ["--c" as string]: "#47C49A" }} />
                  自由视角 · 拖拽旋转 / 滚轮缩放
                </li>
              </ul>
              {/* 通向 /robot-toy/ 完整展示房的主入口 */}
              <div className="toy-more">
                <a className="btn toy-more-btn" href="/robot-toy/">
                  详细看看 <span className="arr">→</span>
                </a>
                <span className="toy-more-note mono">独立展示房 · 沉浸 3D</span>
              </div>
              <p className="toy-side-note mono">WebGL · three.js 实时渲染，非视频</p>
            </aside>
          </div>
        </Reveal>
      </section>

      {/* ---------- 关于 ---------- */}
      <section id="about" className="wrap" style={{ marginTop: "var(--section-gap)" }}>
        <Reveal>
          <div className="section-head">
            <h2>关于这个游乐场</h2>
            <span className="mono">About — 玩家须知</span>
          </div>
        </Reveal>
        <div className="about-grid">
          <Reveal delay={100}>
            <p className="about-text">
              我是 <span className="hl hl-coral">Evan</span>，一个
              <span className="hl hl-indigo">喜欢折腾 AI 编程的极客开发者</span>，
              平时写代码、周末撸小工具、
              偶尔参加黑客马拉松。
              <span className="hl hl-mint">性格开朗，</span>
              什么都想试一下。
              <span className="hl hl-lilac">这里就是我的试验场。</span>
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="about-side">
              <div>
                <p className="mono" style={{ marginBottom: "1.1rem" }}>游乐场用色 — 只涂在小地方</p>
                <div className="palette">
                  {[
                    ["#FF6A55", "珊瑚"],
                    ["#F0B23E", "芥末"],
                    ["#4C5BD6", "靛蓝"],
                    ["#47C49A", "薄荷"],
                    ["#9B7EDE", "雾紫"],
                  ].map(([hex, name]) => (
                    <span className="swatch" key={hex}>
                      <i style={{ ["--c" as string]: hex }} />
                      <span>{name}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mono" style={{ marginBottom: "1.1rem" }}>常驻嘉宾</p>
                <div className="doll-shelf" aria-hidden="true">
                  <span className="d1 float-a"><DollBlob /></span>
                  <span className="d2 float-b"><DollStar /></span>
                  <span className="d3 float-c"><DollLong /></span>
                  <span className="d4 sway"><DollGhost /></span>
                  <span className="d5 float-b"><DollCloud /></span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}

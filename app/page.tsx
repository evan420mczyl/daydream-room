import Link from "next/link";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import HollowText from "@/components/HollowText";
import HeroParallax from "@/components/HeroParallax";
import BackToTop from "@/components/BackToTop";
import Marquee from "@/components/Marquee";
import ArticleIndex from "@/components/ArticleIndex";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { DollBlob, DollStar, DollLong, DollGhost, DollCloud } from "@/components/dolls";
import { featuredPost, ACCENT_HEX } from "@/lib/posts";

// three.js 只服务首屏装饰层，拆成独立 chunk 懒加载，不拖慢首屏 JS
const HeroCanvas = dynamic(() => import("@/components/HeroCanvas"));

export default function Home() {
  return (
    <>
      <Header />

      <main id="top">
        {/* ---------- Hero ---------- */}
        <section className="hero wrap">
          <div className="hero-meta mono">
            <span>Daydream Room — Evan的个人博客</span>
            <span>Vol.01 / 2026 夏</span>
          </div>

          <div className="hero-stage">
            <h1 className="hero-title" id="hero-title">
              <span className="line">白日梦</span>
              <span className="line line-2">
                <HollowText text="陈列室" className="hollow-svg" />
              </span>
            </h1>
            <HeroCanvas className="hero-canvas-wrap" />

            {/* 左下负空间的水印大字：让空白是设计，不是事故 */}
            <span className="hero-watermark" aria-hidden="true">DAYDREAM</span>

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
              这里收留一些<strong>轻飘飘的念头</strong>：几页随笔、
              <span className="no-break">一点设计、</span>
              <span className="no-break">偶尔的手帐与代码。</span>
              <span className="no-break">都写在<strong>架子上</strong>，</span>你慢慢逛。
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
              <span className="mono">Featured — {featuredPost.title.slice(0, 20)}...</span>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <article className="featured">
              <i className="tape" style={{ ["--tape" as string]: ACCENT_HEX[featuredPost.accent] }} aria-hidden="true" />
              <div>
                <p className="featured-kicker mono">
                  <i className="dot" style={{ ["--dot" as string]: ACCENT_HEX[featuredPost.accent] }} />
                  {featuredPost.category} · {featuredPost.date} · 约 {featuredPost.minutes} 分钟
                </p>
                <h3 className="featured-title">
                  {featuredPost.title}
                </h3>
                <p className="featured-excerpt">{featuredPost.excerpt}</p>
                <div className="featured-meta">
                  <Link className="btn" href={`/posts/${featuredPost.slug}`}>
                    开始阅读 <span className="arr">→</span>
                  </Link>
                  <span className="mono">祝你读得慢一点</span>
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

        {/* ---------- 关于 ---------- */}
        <section id="about" className="wrap" style={{ marginTop: "var(--section-gap)" }}>
          <Reveal>
            <div className="section-head">
              <h2>关于这间陈列室</h2>
              <span className="mono">About — 陈列守则</span>
            </div>
          </Reveal>
          <div className="about-grid">
            <Reveal delay={100}>
              <p className="about-text">
                我喜欢<span className="hl hl-coral">毛茸茸的玩偶</span>、
                <span className="hl hl-indigo">留很多白的纸</span>， 和
                <span className="hl hl-mint">不着急的心情</span>。
                所以这个博客也一样：架子很大，东西不多，
                每一件都值得<span className="hl hl-lilac">拿起来看一看</span>再放回去。
              </p>
            </Reveal>
            <Reveal delay={200}>
              <div className="about-side">
                <div>
                  <p className="mono" style={{ marginBottom: "1.1rem" }}>陈列室用色 — 只涂在小地方</p>
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
                  <p className="mono" style={{ marginBottom: "1.1rem" }}>现任住员</p>
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

      <Footer />
      <BackToTop />
    </>
  );
}

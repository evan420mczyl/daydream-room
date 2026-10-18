import type { Metadata } from "next";
import dynamic from "next/dynamic";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { GITHUB_URL } from "@/lib/site";

/**
 * /robot-toy/ —— 「小方」3D 完整展示房。
 *
 * 由原先交付到公共网盘的独立展示页（standalone/index.html）移植进项目：
 * 左侧文案（住客铭牌 / 渐变大标题 / 特性清单 / GitHub 与回站按钮 / 统计卡）
 * + 右侧大画布 3D 展台。展台直接复用首页玩偶屋的 ToyStage3D——
 * 同一只机器人、同一套三主题光影感知，主题切换器沿用全站 ThemeSwitcher。
 * 风格全元素适配：浅色 = 暖纸展廊；暗夜 = 深空展馆；玻璃 = 极光夜橱窗。
 */

const ToyStage3D = dynamic(() => import("@/components/ToyStage3D"));

export const metadata: Metadata = {
  title: "小方 3D 展台 · 玩偶屋",
  description:
    "陶瓷 × 深色玻璃的小方块机器人「小方」：1400 颗星尘、双轨道环、真实光影，可自由旋转缩放的 WebGL 展台。",
  alternates: { canonical: "/robot-toy/" },
};

const GITHUB_PATH =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z";

const FEATS: Array<{ color: string; label: string; rest: string }> = [
  { color: "#FF6A55", label: "陶瓷 × 深色玻璃", rest: "清漆高光与真实反射" },
  { color: "#F0B23E", label: "星尘粒子", rest: "1400 颗环绕漂浮 + 近景尘埃" },
  { color: "#47C49A", label: "自由视角", rest: "拖拽旋转 / 滚轮缩放" },
];

export default function RobotToyRoute() {
  return (
    <div className="rt-page">
      {/* 展示房专属底色与细网格（三主题各异，盖在全站 body 背景之上） */}
      <div className="rt-bg" aria-hidden="true" />
      <div className="rt-grid" aria-hidden="true" />

      <header className="rt-nav rt-rise">
        <a className="rt-brand" href="/">
          <i className="rt-mark" aria-hidden="true" />
          <span>回游乐场</span>
        </a>

        <div className="rt-nav-right">
          <ThemeSwitcher />
          <a
            className="rt-gh"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="前往 Evan-420 的 GitHub"
          >
            <svg viewBox="0 0 16 16" width="19" height="19" fill="currentColor" aria-hidden="true">
              <path d={GITHUB_PATH} />
            </svg>
          </a>
        </div>
      </header>

      <main className="rt-stage">
        {/* ---------- 文案侧 ---------- */}
        <section className="rt-copy rt-rise rt-rise--1">
          <p className="rt-badge">
            <i className="rt-pulse" aria-hidden="true" />
            Resident No.002 · 小方已入住
          </p>

          <h1 className="rt-h1">
            把界面做成<span className="rt-grad">玻璃</span>，
            <span className="rt-thin">把想法做成</span>
            <span className="rt-grad">玩具</span>。
          </h1>

          <p className="rt-lede">
            游乐场的新住客「小方」：一只<b>陶瓷与深色玻璃</b>拼成的小方块机器人。
            眼睛是不眨的星子，天线顶着粉色信号灯；两圈金属轨道环、七颗巡游的彩色小方块，
            外加 <b>1400 颗星尘</b>绕着它慢慢飘。每一个像素，都该有它自己的重量。
          </p>

          <ul className="toy-feats rt-feats mono">
            {FEATS.map((f) => (
              <li key={f.label}>
                <i style={{ ["--c" as string]: f.color }} />
                <b>{f.label}</b>
                {" · "}
                {f.rest}
              </li>
            ))}
          </ul>

          <div className="rt-actions">
            <a
              className="rt-btn rt-btn-primary"
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d={GITHUB_PATH} />
              </svg>
              <span>GitHub</span>
            </a>
            <a className="rt-btn rt-btn-ghost" href="/">
              回游乐场逛逛
              <span className="rt-arr" aria-hidden="true">→</span>
            </a>
          </div>

          <div className="rt-stats">
            <div className="rt-stat"><b>1400</b><span>星尘</span></div>
            <div className="rt-stat"><b>2</b><span>轨道环</span></div>
            <div className="rt-stat"><b>∞</b><span>视角</span></div>
          </div>
        </section>

        {/* ---------- 3D 展台侧（复用首页玩偶屋的同一只小方） ---------- */}
        <section className="toy-stage rt-stagebox rt-rise rt-rise--2" aria-label="小方的 3D 交互展台">
          <ToyStage3D className="toy-canvas" />
          <span className="toy-tag mono" aria-hidden="true">3D · LIVE</span>
          <span className="toy-hint mono" aria-hidden="true">✳ 拖拽旋转 · 滚轮缩放</span>
        </section>
      </main>

      <footer className="rt-foot mono rt-rise rt-rise--3">
        <span>EVAN&apos;S PLAYGROUND · 玩偶屋 · 3D</span>
        <span>WEBGL · THREE.JS 实时渲染 · 非视频</span>
      </footer>
    </div>
  );
}

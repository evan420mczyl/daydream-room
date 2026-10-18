// make-og.mjs — generate public/og.png (1200x630) social share image for daydream-room
// Usage: node scripts/make-og.mjs <cjk|latin> ["<CJK serif font family>"] ["<CJK sans font family>"]
import sharp from "sharp";
import { statSync } from "node:fs";

const variant = process.argv[2] === "cjk" ? "cjk" : "latin";
const cjkSerif = process.argv[3] || "Noto Serif CJK SC";
const cjkSans = process.argv[4] || "WenQuanYi Zen Hei";

const W = 1200;
const H = 630;
const OUT = "/home/z/my-project/public/og.png";
const DOLL = "/home/z/my-project/public/dolls-v3/tuantuan-open.webp";

// --- text content per variant ---
const title = variant === "cjk" ? "Evan 的游乐场" : "Evan's Playground";
const subtitle =
  variant === "cjk" ? "AI 编程 · 效率工具 · 生活碎碎念" : "AI · CODE · TOOLS · LIFE";

// --- font stacks ---
const watermarkFont = "Liberation Serif, DejaVu Serif, serif";
const monoFont = "DejaVu Sans Mono, Liberation Mono, monospace";
const titleFont =
  variant === "cjk"
    ? `"${cjkSerif}", "Noto Serif SC", serif`
    : "Liberation Serif, DejaVu Serif, serif";
const subtitleFont =
  variant === "cjk"
    ? `"${cjkSans}", "WenQuanYi Zen Hei", sans-serif`
    : "DejaVu Sans Mono, Liberation Mono, monospace";

const titleSize = variant === "cjk" ? 112 : 120;
const subtitleSize = variant === "cjk" ? 30 : 26;
const subtitleSpacing = variant === "cjk" ? 0 : 4;

const dots = ["#FF6A55", "#F0B23E", "#4C5BD6", "#47C49A", "#9B7EDE"];
const dotCircles = dots
  .map(
    (fill, i) =>
      `<circle cx="${100 + i * 46}" cy="460" r="15" fill="${fill}"/>`
  )
  .join("\n  ");

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FF6A55"/>
      <stop offset="34%" stop-color="#F0B23E"/>
      <stop offset="67%" stop-color="#47C49A"/>
      <stop offset="100%" stop-color="#4C5BD6"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#faf7f1"/>
  <rect x="0" y="0" width="${W}" height="6" fill="url(#bar)"/>
  <text x="70" y="575" font-family="${watermarkFont}" font-size="170" font-weight="bold" fill="rgba(34,29,22,0.05)">PLAYGROUND</text>
  <text x="90" y="140" font-family="${monoFont}" font-size="24" letter-spacing="6" fill="rgba(34,29,22,0.55)">EVAN'S PLAYGROUND · VOL.01 / 2026</text>
  <text x="86" y="330" font-family='${titleFont}' font-size="${titleSize}" font-weight="bold" fill="#221d16">${title}</text>
  <text x="92" y="400" font-family='${subtitleFont}' font-size="${subtitleSize}" letter-spacing="${subtitleSpacing}" fill="rgba(34,29,22,0.62)">${subtitle}</text>
  ${dotCircles}
</svg>`;

async function main() {
  // resize mascot to 250px wide
  const doll = await sharp(DOLL).resize(250).toBuffer();

  await sharp(Buffer.from(svg))
    .composite([{ input: doll, left: 880, top: 250 }])
    .png()
    .toFile(OUT);

  const { size } = statSync(OUT);
  const meta = await sharp(OUT).metadata();
  console.log(
    `og.png written: ${meta.width}x${meta.height} ${meta.format}, ${(size / 1024).toFixed(1)} KB (variant: ${variant})`
  );
}

main().catch((err) => {
  console.error("make-og failed:", err);
  process.exit(1);
});

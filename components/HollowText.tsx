/**
 * 镂空描边文字 —— 内部透明、仅显示细线轮廓。
 *
 * 双层渲染原理（笔画相接处也干净）：
 * 1. 底层：墨色描边、圆角接头——一个字的所有笔画描边后
 *    融合成连续的外轮廓，凹口处外边缘天然圆滑；
 * 2. 上层：纸色实心字盖住描边的内半部分，
 *    只留外圈一圈宽度均匀的轮廓环。
 * 不腐蚀、不逐路径描边，相接处没有瘤结。
 */
export default function HollowText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const CHAR = 112; // 100 字号 + 12 字距
  const width = text.length * CHAR + 10;

  return (
    <svg className={className} viewBox={`0 0 ${width} 128`} role="img" aria-label={text}>
      <text
        x="5"
        y="98"
        fontSize="100"
        letterSpacing="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {text}
      </text>
      <text x="5" y="98" fontSize="100" letterSpacing="12" style={{ fill: "var(--paper)" }}>
        {text}
      </text>
    </svg>
  );
}

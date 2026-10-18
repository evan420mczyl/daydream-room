"use client";

import { useEffect, useRef } from "react";

/** 页面顶端的阅读进度条，颜色跟随文章点缀色 */
export default function ReadingProgress({ color }: { color: string }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      el.style.transform = `scaleX(${ratio})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      ref={barRef}
      className="reading-progress"
      style={{ ["--rp" as string]: color }}
      aria-hidden="true"
    />
  );
}

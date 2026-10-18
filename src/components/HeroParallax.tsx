"use client";

import { useEffect } from "react";

/**
 * 标题的指针微视差：3D 大幅、文字小幅（约 1/8）、水印不动——
 * 整个场景一起呼吸，但层级分明。
 */
export default function HeroParallax() {
  useEffect(() => {
    const el = document.getElementById("hero-title");
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const tick = () => {
      x += (tx - x) * 0.05;
      y += (ty - y) * 0.05;
      el.style.transform = `translate3d(${(x * 9).toFixed(2)}px, ${(y * 6).toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      el.style.transform = "";
    };
  }, []);

  return null;
}

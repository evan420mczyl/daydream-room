"use client";

import { useEffect } from "react";

/**
 * 陪读侧栏的谢幕逻辑：送别小队（展架）进入视口时，
 * 侧栏才淡出退场——底部只展示送别小队。往回滚它会回来。
 */
export default function AsideObserver() {
  useEffect(() => {
    const aside = document.querySelector(".post-aside");
    const squad = document.querySelector(".post-dolls");
    if (!aside || !squad) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        aside.classList.toggle("aside-gone", entry.isIntersecting);
      },
      // 展架要真正进入视野（露出一部分且过了底部安全线）才算数
      { threshold: 0.35, rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(squad);
    return () => io.disconnect();
  }, []);

  return null;
}

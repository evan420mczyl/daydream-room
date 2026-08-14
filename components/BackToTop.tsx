"use client";

import { useEffect, useState } from "react";
import { DollStar } from "./dolls";

/** 滚动一段距离后，星星仔在右下角出现，点它送你回顶部 */
export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      className={`back-top ${show ? "is-show" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="回到顶部"
      tabIndex={show ? 0 : -1}
    >
      <span className="back-top-doll float-b" aria-hidden="true">
        <DollStar />
      </span>
      <span className="back-top-label mono">回顶部</span>
      <span className="back-top-arrow" aria-hidden="true">↑</span>
    </button>
  );
}

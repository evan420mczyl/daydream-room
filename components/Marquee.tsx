"use client";

import { useEffect, useRef } from "react";

const ITEMS = ["写字", "做手工", "晒太阳", "收集可爱", "偶尔写代码", "发很长的呆", "给玩偶拍照"];
const COLORS = ["#FF6A55", "#F0B23E", "#4C5BD6", "#47C49A", "#9B7EDE"];
const DESKTOP_PIXELS_PER_SECOND = 42;
const MOBILE_PIXELS_PER_SECOND = 34;

// 无缝循环的硬条件：一个序列的宽度必须 ≥ 可视区宽度。
// 序列内容重复 4 份（约 4600px），超宽屏也不会露白。
const SEQ = [...ITEMS, ...ITEMS, ...ITEMS, ...ITEMS];

function Row() {
  return (
    <span className="marquee-row" aria-hidden="true">
      {SEQ.map((item, i) => (
        <span className="marquee-item" key={i}>
          {item}
          <b className="star" style={{ color: COLORS[i % COLORS.length], fontWeight: 400 }}>✳</b>
        </span>
      ))}
    </span>
  );
}

export default function Marquee() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const row = track?.querySelector<HTMLElement>(".marquee-row");
    if (!track || !row) return;

    const syncDuration = () => {
      const distance = row.getBoundingClientRect().width;
      const speed = window.matchMedia("(max-width: 720px)").matches
        ? MOBILE_PIXELS_PER_SECOND
        : DESKTOP_PIXELS_PER_SECOND;

      track.style.setProperty("--marquee-duration", `${distance / speed}s`);
    };

    syncDuration();
    document.fonts?.ready?.then(syncDuration);

    const observer = new ResizeObserver(syncDuration);
    observer.observe(row);
    window.addEventListener("resize", syncDuration, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncDuration);
    };
  }, []);

  return (
    <div className="marquee" role="marquee" aria-label="这里在做的事">
      <div className="marquee-track" ref={trackRef}>
        <Row />
        <Row />
      </div>
    </div>
  );
}

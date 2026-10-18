"use client";

import { useEffect, useState } from "react";

/**
 * 三帧 PNG 眨眼角色。静态棚拍素材不再做帧切换，避免不同生成帧之间的光色跳变。
 */
export default function BlinkingDoll({
  src,
  halfSrc,
  blinkSrc,
  alt = "",
  interval = 5200,
  className = "",
  staticFrame = false,
}: {
  src: string;
  halfSrc: string;
  blinkSrc: string;
  alt?: string;
  /** 平均眨眼间隔（毫秒），实际会加随机偏移，更自然 */
  interval?: number;
  className?: string;
  /** 棚拍素材保留原始光影时，使用单帧而非切换近似帧。 */
  staticFrame?: boolean;
}) {
  const [phase, setPhase] = useState<"open" | "half" | "closed">("open");

  useEffect(() => {
    if (staticFrame || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer: ReturnType<typeof setTimeout>;

    const loop = () => {
      timer = setTimeout(() => {
        setPhase("half");
        timer = setTimeout(() => {
          setPhase("closed");
          timer = setTimeout(() => {
            setPhase("half");
            timer = setTimeout(() => {
              setPhase("open");
              loop();
            }, 75);
          }, 105);
        }, 75);
      }, interval + Math.random() * 2400);
    };

    loop();
    return () => clearTimeout(timer);
  }, [interval, staticFrame]);

  if (staticFrame) {
    return (
      <span className={`blink-doll ${className}`}>
        <img
          className="doll-frame doll-frame--open"
          src={src}
          alt={alt}
          draggable={false}
          loading="eager"
          decoding="sync"
        />
      </span>
    );
  }

  return (
    <span className={`blink-doll ${className}`}>
      <img
        className="doll-frame doll-frame--open"
        src={src}
        alt={alt}
        draggable={false}
        loading="eager"
        decoding="sync"
        style={{
          opacity: phase === "open" ? 1 : 0,
          visibility: phase === "open" ? "visible" : "hidden",
        }}
      />
      <img
        className="doll-frame doll-frame--half"
        src={halfSrc}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="eager"
        decoding="sync"
        style={{
          opacity: phase === "half" ? 1 : 0,
          visibility: phase === "half" ? "visible" : "hidden",
        }}
      />
      <img
        className="doll-frame doll-frame--closed"
        src={blinkSrc}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="eager"
        decoding="sync"
        style={{
          opacity: phase === "closed" ? 1 : 0,
          visibility: phase === "closed" ? "visible" : "hidden",
        }}
      />
    </span>
  );
}

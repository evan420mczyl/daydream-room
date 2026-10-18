import type { SVGProps } from "react";
import BlinkingDoll from "./BlinkingDoll";

/**
 * 真实动物毛发版本的住员。三个眨眼帧始终使用同一张角色底图派生。
 */

type DollProps = {
  className?: string;
  alt?: string;
};

export function DollBlob({ className = "", alt = "团团" }: DollProps) {
  return (
    <BlinkingDoll
      src="/dolls-v3/tuantuan-open.webp"
      halfSrc="/dolls-v3/tuantuan-half.webp"
      blinkSrc="/dolls-v3/tuantuan-closed.webp"
      alt={alt}
      interval={5200}
      className={`doll ${className}`}
    />
  );
}

export function DollStar({ className = "", alt = "星星仔" }: DollProps) {
  return (
    <BlinkingDoll
      src="/dolls-v3/star-open.webp"
      halfSrc="/dolls-v3/star-half.webp"
      blinkSrc="/dolls-v3/star-closed.webp"
      alt={alt}
      interval={6800}
      className={`doll ${className}`}
    />
  );
}

export function DollLong({ className = "", alt = "长条君" }: DollProps) {
  return (
    <BlinkingDoll
      src="/dolls-v3/long-open.webp"
      halfSrc="/dolls-v3/long-half.webp"
      blinkSrc="/dolls-v3/long-closed.webp"
      alt={alt}
      interval={6100}
      className={`doll ${className}`}
    />
  );
}

export function DollGhost({ className = "", alt = "小幽" }: DollProps) {
  return (
    <BlinkingDoll
      src="/dolls/ghost-open.webp"
      halfSrc="/dolls/ghost-half.webp"
      blinkSrc="/dolls/ghost-closed.webp"
      alt={alt}
      interval={7400}
      className={`doll ${className}`}
    />
  );
}

export function DollCloud({ className = "", alt = "绵绵" }: DollProps) {
  // 绵绵 · 雾紫色小云，戴睡帽，负责做梦
  return (
    <BlinkingDoll
      src="/dolls-v3/cloud-open.webp"
      halfSrc="/dolls-v3/cloud-half.webp"
      blinkSrc="/dolls-v3/cloud-closed.webp"
      alt={alt}
      interval={6200}
      className={`doll ${className}`}
    />
  );
}

export function DollFace({ className = "", alt = "" }: DollProps) {
  return (
    <BlinkingDoll
      src="/dolls/face-open.webp"
      halfSrc="/dolls/face-half.webp"
      blinkSrc="/dolls/face-closed.webp"
      alt={alt}
      interval={5600}
      className={`doll doll-face ${className}`}
    />
  );
}

export function StickerStar(props: SVGProps<SVGSVGElement>) {
  // 列表 hover 时弹出的小贴纸
  return (
    <svg viewBox="0 0 24 24" className="sticker" aria-hidden="true" {...props}>
      <path
        d="M12 2 L14.4 8.6 L21.5 9.3 L16.2 13.8 L17.8 20.7 L12 17 L6.2 20.7 L7.8 13.8 L2.5 9.3 L9.6 8.6 Z"
        fill="currentColor"
      />
    </svg>
  );
}

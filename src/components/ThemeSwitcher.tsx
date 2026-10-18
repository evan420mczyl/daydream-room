"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sparkles, Sun } from "lucide-react";

export type Theme = "light" | "dark" | "glass";

const THEME_ORDER: Theme[] = ["light", "dark", "glass"];
const THEME_ATTR = "data-theme";

const THEME_META: Record<Theme, { label: string; hint: string; Icon: typeof Sun }> = {
  light: { label: "浅色", hint: "纸张暖白", Icon: Sun },
  dark: { label: "暗夜", hint: "深色模式", Icon: Moon },
  glass: { label: "玻璃", hint: "透明玻璃", Icon: Sparkles },
};

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "glass";
}

/**
 * <html data-theme> 是主题的唯一事实源：首帧由 <head> 内联脚本提前写入（避免闪白），
 * 之后只由本组件切换。用 useSyncExternalStore 订阅这个外部系统
 * （MutationObserver 监听属性变化），既不在 effect 里 setState，
 * 也让 SSR/水合阶段天然按默认浅色渲染、水合后自动对齐真实主题。
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [THEME_ATTR],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  const current = document.documentElement.getAttribute(THEME_ATTR);
  return isTheme(current) ? current : "light";
}

function getServerSnapshot(): Theme {
  // SSR 阶段拿不到 DOM，按默认浅色渲染；水合完成后自动对齐真实主题
  return "light";
}

/**
 * 右上角的三段式风格切换器：浅色 / 暗夜 / 玻璃。
 * 真正的着色靠 <html data-theme="..."> 上的设计令牌切换，
 * 这里只负责选中和持久化（localStorage）。
 */
export default function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const apply = (next: Theme) => {
    // 只写外部系统（DOM 属性 + localStorage），状态回流交给 MutationObserver
    document.documentElement.setAttribute(THEME_ATTR, next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // 隐私模式等场景下 localStorage 不可用，忽略即可
    }
  };

  const idx = Math.max(0, THEME_ORDER.indexOf(theme));

  return (
    <div className="theme-switcher" role="radiogroup" aria-label="页面风格切换">
      <span
        className="theme-switcher-thumb"
        aria-hidden="true"
        style={{ transform: `translateX(${idx * 100}%)` }}
      />
      {THEME_ORDER.map((id) => {
        const { label, hint, Icon } = THEME_META[id];
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`theme-option theme-option--${id}`}
            onClick={() => apply(id)}
            title={`风格：${label}（${hint}）`}
          >
            <Icon className="theme-option-icon" strokeWidth={2.2} aria-hidden="true" />
            <span className="theme-option-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "glass";

const THEME_ORDER: Theme[] = ["light", "dark", "glass"];

const THEME_LABELS: Record<Theme, string> = {
  light: "浅色",
  dark: "深色",
  glass: "玻璃",
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Theme) || "light";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
    setMounted(true);
  }, []);

  const cycle = () => {
    const idx = THEME_ORDER.indexOf(theme);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  if (!mounted) {
    return (
      <button className="theme-toggle" aria-label="切换主题" disabled>
        <span className="theme-toggle-icon" />
      </button>
    );
  }

  return (
    <button
      className="theme-toggle"
      onClick={cycle}
      aria-label={`当前：${THEME_LABELS[theme]}，点击切换`}
      title={`主题：${THEME_LABELS[theme]}`}
    >
      <span className={`theme-toggle-icon theme-${theme}`} />
    </button>
  );
}

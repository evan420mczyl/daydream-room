"use client";

import { useEffect, useState } from "react";

type Theme = "original" | "glass" | "vision";

const themes: Theme[] = ["original", "glass", "vision"];

const labels: Record<Theme, string> = {
  original: "原始",
  glass: "玻璃",
  vision: "未来",
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("original");

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as Theme | null;
    if (saved && themes.includes(saved)) {
      setTheme(saved);
    }
  }, []);

  const switchTheme = () => {
    const next = themes[(themes.indexOf(theme) + 1) % themes.length];
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("daydream-theme", next);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={switchTheme}
      aria-label={`切换风格，当前：${labels[theme]}`}
      title={`当前主题：${labels[theme]}，点击切换`}
    >
      <span className="theme-toggle__label mono">换形象</span>
      <span className="theme-toggle__name mono">{labels[theme]}</span>
    </button>
  );
}

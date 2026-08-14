"use client";

import { useEffect, useState } from "react";

type Theme = "original" | "glass" | "vision";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("original");

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as Theme | null;
    if (saved === "glass" || saved === "vision") {
      setTheme(saved);
    }
  }, []);

  const cycleTheme = () => {
    const themes: Theme[] = ["original", "glass", "vision"];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const next = themes[nextIndex];
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const getLabel = () => {
    switch (theme) {
      case "glass":
        return "Glass";
      case "vision":
        return "Vision";
      default:
        return "经典";
    }
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycleTheme}
      aria-label={`切换到${getLabel()}风格`}
      title={`切换到${getLabel()}风格`}
    >
      <span className="theme-toggle__label mono">
        {getLabel()}
      </span>
      <span className="theme-toggle__track">
        <span className="theme-toggle__thumb" />
      </span>
    </button>
  );
}

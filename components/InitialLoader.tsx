"use client";

import { useEffect, useState } from "react";

type LoaderStage = "showing" | "leaving" | "hidden";

const MIN_VISIBLE_MS = 1050;
const MAX_VISIBLE_MS = 2400;
const EXIT_MS = 900;

function waitForWindowLoad() {
  if (document.readyState === "complete") return Promise.resolve();

  return new Promise<void>((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

export default function InitialLoader() {
  const [stage, setStage] = useState<LoaderStage>("showing");

  useEffect(() => {
    document.documentElement.classList.add("is-loader-active", "is-loading");

    let cancelled = false;
    let minimumTimer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    const beginExit = () => {
      if (cancelled) return;

      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
      minimumTimer = setTimeout(() => {
        if (!cancelled) setStage("leaving");
      }, remaining);
    };

    const maximumTimer = setTimeout(() => {
      if (!cancelled) setStage("leaving");
    }, MAX_VISIBLE_MS);

    Promise.all([
      waitForWindowLoad(),
      document.fonts?.ready?.catch(() => undefined) ?? Promise.resolve(),
    ]).then(beginExit);

    return () => {
      cancelled = true;
      clearTimeout(minimumTimer);
      clearTimeout(maximumTimer);
      document.documentElement.classList.remove("is-loader-active", "is-loading");
    };
  }, []);

  useEffect(() => {
    if (stage !== "leaving") return;

    document.documentElement.classList.remove("is-loading");

    const timer = setTimeout(() => {
      setStage("hidden");
      document.documentElement.classList.remove("is-loader-active");
    }, EXIT_MS);

    return () => clearTimeout(timer);
  }, [stage]);

  if (stage === "hidden") return null;

  return (
    <div
      className={`initial-loader${stage === "leaving" ? " is-leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="正在摆放陈列品"
    >
      <div className="initial-loader__content">
        <div className="loader-mascot-wrap" aria-hidden="true">
          <span className="loader-mascot">
            <img className="loader-eye-open" src="/dolls-v3/tuantuan-open.webp" alt="" draggable={false} />
            <img className="loader-eye-half" src="/dolls-v3/tuantuan-half.webp" alt="" draggable={false} />
            <img className="loader-eye-closed" src="/dolls-v3/tuantuan-closed.webp" alt="" draggable={false} />
          </span>
          <i className="loader-shadow" />
        </div>

        <p className="initial-loader__copy">
          正在摆放陈列品
          <span className="loader-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </p>
        <p className="initial-loader__meta">DAYDREAM ROOM · OPENING</p>
      </div>
    </div>
  );
}

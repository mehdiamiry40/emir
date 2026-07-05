"use client";

import { useEffect, useState } from "react";
import { THEME_COLORS } from "./site";

function storedTheme() {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function currentTheme() {
  const domTheme = document.documentElement.dataset.theme;
  return (
    storedTheme() ??
    (domTheme === "light" || domTheme === "dark" ? domTheme : systemTheme())
  );
}

function applyTheme(next) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {}
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", THEME_COLORS[next]));
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(storedTheme() ?? (mq.matches ? "dark" : "light"));

    const onSystemChange = () => {
      if (!storedTheme()) setTheme(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, []);

  const toggle = (event) => {
    const activeTheme = theme ?? currentTheme();
    const next = activeTheme === "dark" ? "light" : "dark";
    setTheme(next);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (typeof document.startViewTransition !== "function" || reduceMotion) {
      applyTheme(next);
      return;
    }

    // circular reveal radiating from the toggle button
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const root = document.documentElement;
    root.classList.add("themeSnap");
    const vt = document.startViewTransition(() => applyTheme(next));
    vt.ready
      .then(() => {
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 480,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      })
      .catch(() => {});
    vt.finished.finally(() => root.classList.remove("themeSnap"));
  };

  return (
    <button
      type="button"
      className="themeToggle"
      onClick={toggle}
      aria-pressed={
        theme === "dark" ? true : theme === "light" ? false : undefined
      }
      aria-label={
        theme == null
          ? "Toggle theme"
          : theme === "dark"
            ? "Switch to light mode"
            : "Switch to dark mode"
      }
    >
      <svg
        className="iconSun"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4.4" />
        <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5" />
      </svg>
      <svg
        className="iconMoon"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.2 14.2A8.2 8.2 0 0 1 9.8 3.8a8.2 8.2 0 1 0 10.4 10.4Z" />
      </svg>
    </button>
  );
}

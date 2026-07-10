"use client";

import { useState } from "react";

export default function Eagle() {
  const [flapping, setFlapping] = useState(false);

  const flap = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFlapping(true);
  };

  return (
    <button
      className="eagleWrap"
      type="button"
      aria-label="Animate eagle"
      onClick={flap}
    >
      <img
        className={flapping ? "eagle flap" : "eagle"}
        src="/eagle-icon.svg"
        alt=""
        decoding="async"
        fetchPriority="high"
        onAnimationEnd={(e) => {
          if (e.animationName === "flap") setFlapping(false);
        }}
      />
    </button>
  );
}

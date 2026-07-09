"use client";

import { useState } from "react";

export default function Eagle() {
  const [flapping, setFlapping] = useState(false);

  const flap = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFlapping(true);
  };

  return (
    <div className="eagleWrap">
      <img
        className={flapping ? "eagle flap" : "eagle"}
        src="/eagle-icon.svg"
        alt="Gold eagle icon"
        decoding="async"
        fetchPriority="high"
        onClick={flap}
        onAnimationEnd={(e) => {
          if (e.animationName === "flap") setFlapping(false);
        }}
      />
    </div>
  );
}

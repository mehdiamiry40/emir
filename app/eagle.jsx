"use client";

import { useEffect, useRef, useState } from "react";

export default function Eagle() {
  const ref = useRef(null);
  const [flapping, setFlapping] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let raf = 0;
    const onMove = (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.style.transform = `translate3d(${(nx * 14).toFixed(1)}px, ${(ny * 10).toFixed(1)}px, 0)`;
        }
      });
    };
    const onLeave = () => {
      if (ref.current) ref.current.style.transform = "";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const flap = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFlapping(true);
  };

  return (
    <div className="parallax" ref={ref}>
      <div className="eagleWrap">
        <img
          className={flapping ? "eagle flap" : "eagle"}
          src="/eagle-icon.svg"
          alt="Black eagle icon"
          decoding="async"
          fetchPriority="high"
          onClick={flap}
          onAnimationEnd={(e) => {
            if (e.animationName === "flap") setFlapping(false);
          }}
        />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

function Eagle(props) {
  return (
    <svg
      viewBox="0 0 1000 560"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      role="img"
      aria-label="Eagle"
      {...props}
    >
      <defs>
        <pattern
          id="lattice"
          width="18"
          height="18"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path
            d="M0 9 H18 M9 0 V18"
            stroke="var(--bg, #f4f2ec)"
            strokeWidth="3"
            fill="none"
          />
        </pattern>

        <g id="side">
          {/* shoulder block above the wing root */}
          <path d="M536 126 L606 132 L602 154 L536 150 Z" />
          {/* wing layers, longest on top — straight top edge, stepped underside */}
          <path d="M548 150 L985 158 L975 196 L548 188 Z" />
          <path d="M548 194 L905 202 L895 238 L548 230 Z" />
          <path d="M548 236 L820 244 L810 278 L548 270 Z" />
          <path d="M548 276 L730 284 L722 314 L548 306 Z" />
          <path d="M548 312 L645 320 L639 346 L548 340 Z" />
          {/* leg */}
          <path d="M524 296 L550 290 L588 368 L556 380 Z" />
          {/* talons */}
          <path d="M552 372 L544 404 L562 382 L566 412 L577 384 L592 406 L588 376 Z" />
        </g>
      </defs>

      {/* right side + mirrored left side */}
      <use href="#side" />
      <use href="#side" transform="matrix(-1 0 0 1 1000 0)" />

      {/* body */}
      <path d="M500 108 C542 108 552 150 552 210 C552 268 534 320 500 336 C466 320 448 268 448 210 C448 150 458 108 500 108 Z" />
      {/* lattice texture over the chest */}
      <path
        d="M500 122 C534 122 542 158 542 210 C542 262 528 308 500 324 C472 308 458 262 458 210 C458 158 466 122 500 122 Z"
        fill="url(#lattice)"
      />

      {/* neck + head, turned to its right (viewer's left), hooked beak */}
      <path d="M516 112 L516 62 C516 46 505 38 490 38 C475 38 464 44 459 51 L444 54 C436 55 432 59 434 64 L439 72 L446 68 L456 73 C461 84 470 93 480 97 L480 112 Z" />
      {/* eye */}
      <circle cx="487" cy="55" r="4" fill="var(--bg, #f4f2ec)" />

      {/* tail — stacked stepped tiers */}
      <path d="M472 330 L528 330 L531 372 L469 372 Z" />
      <path d="M466 377 L534 377 L537 416 L463 416 Z" />
      <path d="M460 421 L540 421 L543 458 L457 458 Z" />
    </svg>
  );
}

export default function Home() {
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  return (
    <main className="stage">
      <Eagle className="eagle" />
      <p className="date">{today}</p>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

function Eagle(props) {
  return (
    <svg
      viewBox="0 0 1000 430"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      role="img"
      aria-label="Eagle"
      {...props}
    >
      <defs>
        <clipPath id="fanC">
          <path d="M548 150 L718 150 L548 318 Z" />
        </clipPath>

        <g id="side">
          {/* top wing band */}
          <path d="M545 118 L985 118 L960 146 L545 146 Z" />
          {/* feathered inner-wing fan: thick diagonal strokes with thin slits */}
          <g clipPath="url(#fanC)" stroke="currentColor" strokeWidth="8.5">
            <line x1="348" y1="350" x2="598" y2="100" />
            <line x1="365" y1="350" x2="615" y2="100" />
            <line x1="382" y1="350" x2="632" y2="100" />
            <line x1="399" y1="350" x2="649" y2="100" />
            <line x1="416" y1="350" x2="666" y2="100" />
            <line x1="433" y1="350" x2="683" y2="100" />
            <line x1="450" y1="350" x2="700" y2="100" />
            <line x1="467" y1="350" x2="717" y2="100" />
            <line x1="484" y1="350" x2="734" y2="100" />
            <line x1="501" y1="350" x2="751" y2="100" />
            <line x1="518" y1="350" x2="768" y2="100" />
          </g>
          {/* wing stripes, swept-back tips */}
          <path d="M720 156 L920 156 L897 180 L696 180 Z" />
          <path d="M686 190 L850 190 L829 212 L663 212 Z" />
          <path d="M653 222 L778 222 L759 242 L633 242 Z" />
          {/* leg */}
          <path d="M520 324 L542 320 L554 356 L530 362 Z" />
          {/* talons */}
          <path d="M530 358 L524 384 L536 366 L542 388 L550 368 L560 382 L556 358 Z" />
        </g>
      </defs>

      {/* right side + mirrored left side */}
      <use href="#side" />
      <use href="#side" transform="matrix(-1 0 0 1 1000 0)" />

      {/* body, notched between the legs */}
      <path d="M520 112 C536 122 540 150 540 200 C540 260 534 302 526 330 L500 314 L474 330 C466 302 460 260 460 200 C460 150 464 122 480 112 Z" />

      {/* head turned to its right (viewer's left): flat crown, brow, deep hooked beak, eye cut out */}
      <path
        fillRule="evenodd"
        d="M518 118 L518 76 Q518 56 495 54 L468 56 L462 62 L438 63 Q431 64 431 69 L436 84 L441 74 L450 70 L464 71 L468 78 Q476 84 482 86 L484 90 L484 118 Z M487 59.5 a3.5 3.5 0 1 0 0.01 0 Z"
      />
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

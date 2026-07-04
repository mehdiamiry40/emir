"use client";

import { useEffect, useState } from "react";

function formatToday(now) {
  return {
    label: new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(now),
    iso: [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-"),
  };
}

function millisecondsUntilNextDay(now) {
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 0, 0);
  return nextDay.getTime() - now.getTime();
}

export default function Home() {
  const [today, setToday] = useState(null);

  useEffect(() => {
    let timer;

    function refreshDate() {
      const now = new Date();
      setToday(formatToday(now));
      window.clearTimeout(timer);
      timer = window.setTimeout(refreshDate, millisecondsUntilNextDay(now) + 1000);
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        refreshDate();
      }
    }

    refreshDate();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <main className="home" aria-label="Eagle homepage">
      <div className="eagleWrap">
        <img
          className="eagle"
          src="/eagle-icon.svg"
          alt="Black eagle icon"
          decoding="async"
          fetchPriority="high"
        />
      </div>
      <time
        className={today ? "date isReady" : "date"}
        dateTime={today?.iso}
        aria-live="polite"
      >
        {today?.label}
      </time>
    </main>
  );
}

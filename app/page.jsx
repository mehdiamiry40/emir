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
    iso: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`,
  };
}

export default function Home() {
  const [today, setToday] = useState(null);

  useEffect(() => {
    let timer;

    const refresh = () => {
      const now = new Date();
      setToday(formatToday(now));
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      clearTimeout(timer);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 1000);
    };

    const onVisibilityChange = () => {
      if (!document.hidden) refresh();
    };

    refresh();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <main className="home" aria-label="Eagle homepage">
      <title>{today ? `Eagle — ${today.label}` : "Eagle"}</title>
      <div className="eagleWrap">
        <img className="eagle" src="/eagle-icon.svg" alt="Black eagle icon" />
      </div>
      <time className="date" dateTime={today?.iso} aria-live="polite">
        {today?.label}
      </time>
    </main>
  );
}

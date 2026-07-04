"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [today, setToday] = useState("");
  const [dateTime, setDateTime] = useState("");

  useEffect(() => {
    const now = new Date();
    setToday(new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(now));
    setDateTime(now.toISOString());
  }, []);

  return (
    <main className="home" aria-label="Eagle homepage">
      <div className="eagleWrap">
        <img className="eagle" src="/eagle-icon.svg" alt="Black eagle icon" />
      </div>
      <time className="date" dateTime={dateTime} aria-live="polite">
        {today}
      </time>
    </main>
  );
}

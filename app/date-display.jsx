"use client";

import { useEffect, useState } from "react";
import { formatToday, millisecondsUntilNextDay } from "./date-utils";

export default function DateDisplay({ initialDate }) {
  const [today, setToday] = useState(initialDate);

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
    <time
      className={today ? "date isReady" : "date"}
      dateTime={today?.iso}
      aria-label={today ? `Today is ${today.label}` : "Loading today's date"}
      aria-live="polite"
      suppressHydrationWarning
    >
      {today?.label}
    </time>
  );
}

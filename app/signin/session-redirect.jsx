"use client";

import { useEffect } from "react";
import { ADMIN_PATH } from "../site";

/** Sends an already-authenticated visitor from the static sign-in page to Notes. */
export default function SessionRedirect() {
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then((response) => {
        if (response.ok) window.location.assign(ADMIN_PATH);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return null;
}

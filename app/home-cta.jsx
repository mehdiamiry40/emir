"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ADMIN_PATH, SIGNIN_PATH } from "./site";

/**
 * @param {{ className: string }} props
 */
export default function HomeCta({ className }) {
  const [href, setHref] = useState(SIGNIN_PATH);
  const [label, setLabel] = useState("Sign in");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) return;
        setHref(ADMIN_PATH);
        setLabel("Notes");
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <Link className={className} href={href}>
      {label}
    </Link>
  );
}

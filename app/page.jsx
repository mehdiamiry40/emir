import Link from "next/link";
import Eagle from "./eagle";
import ThemeToggle from "./theme-toggle";
import { getDate } from "../lib/date";
import { SIGNIN_PATH, SITE_NAME, SOCIAL_DESCRIPTION } from "./site";

export const revalidate = 60;

export async function generateMetadata() {
  const date = await getDate();
  return {
    title: `${SITE_NAME} — ${date.label}`,
    openGraph: {
      title: `${SITE_NAME} — ${date.label}`,
      description: SOCIAL_DESCRIPTION,
      url: "/",
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE_NAME} — ${date.label}`,
      description: SOCIAL_DESCRIPTION,
    },
  };
}

export default async function Home() {
  const date = await getDate();

  return (
    <>
      <ThemeToggle />
      <main className="home" aria-label="Eagle homepage">
        <h1 className="srOnly">{SITE_NAME}</h1>
        <span className="cornerMark cornerTL" aria-hidden="true">
          {SITE_NAME}
        </span>
        <span className="cornerMark cornerBL" aria-hidden="true">
          emir.com.au
        </span>
        <span className="cornerMark cornerBR" aria-hidden="true">
          MMXXVI
        </span>
        <Eagle />
        <time className="date" dateTime={date.iso}>
          {date.label}
        </time>
        <Link className="signinCta" href={SIGNIN_PATH}>
          Sign in
        </Link>
      </main>
    </>
  );
}

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
  const [weekday, ...rest] = date.label.split(" ");

  return (
    <>
      <ThemeToggle />
      <main className="home homePoster" aria-label="Eagle homepage">
        <h1 className="srOnly">{SITE_NAME}</h1>
        <header className="topRow" aria-hidden="true">
          <span className="wordmark">{SITE_NAME}</span>
        </header>
        <div className="hero">
          <Eagle />
          <time className="date" dateTime={date.iso}>
            <span className="dateWeekday">{weekday}</span>{" "}
            <span className="dateRest">{rest.join(" ")}</span>
          </time>
          <Link className="signinCta" href={SIGNIN_PATH}>
            Sign in
          </Link>
        </div>
        <footer className="bottomRow" aria-hidden="true">
          <span>emir.com.au</span>
          <span>MMXXVI</span>
        </footer>
      </main>
    </>
  );
}

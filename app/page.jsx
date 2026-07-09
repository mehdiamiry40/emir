import Link from "next/link";
import Eagle from "./eagle";
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
      <main className="home homePoster" aria-label="Eagle homepage">
        <h1 className="srOnly">{SITE_NAME}</h1>
        <header className="topRow">
          <span className="wordmark">{SITE_NAME}</span>
          <Eagle />
          <Link className="signinCta topSignin" href={SIGNIN_PATH}>
            Sign in
          </Link>
        </header>
        <div className="hero">
          <p className="heroQuote">
            <span className="heroLight heroLead">Rise</span>
            <span className="heroGold">Above</span>
            <span className="heroLight heroTail">the noise.</span>
          </p>
        </div>
        <footer className="bottomRow">
          <span>emir.com.au</span>
          <time className="date footerDate" dateTime={date.iso}>
            {date.label}
          </time>
        </footer>
      </main>
    </>
  );
}

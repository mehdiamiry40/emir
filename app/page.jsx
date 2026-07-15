import Link from "next/link";
import Eagle from "./eagle";
import { getDate } from "../lib/date";
import {
  SIGNIN_PATH,
  SITE_NAME,
  SOCIAL_DESCRIPTION,
  TIME_24H,
  TIME_LABEL,
} from "./site";

const QUOTE_TEXT = "Rise above the noise.";

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
    <main className="home homePoster" aria-label={`${SITE_NAME} homepage`}>
      <h1 className="srOnly">{SITE_NAME}</h1>
      <header className="topRow">
        <span className="wordmark">{SITE_NAME}</span>
        <Eagle />
        <Link className="signinCta topSignin" href={SIGNIN_PATH}>
          Sign in
        </Link>
      </header>
      <div className="hero">
        <blockquote className="heroQuote" data-text={QUOTE_TEXT}>
          <p className="quoteText">
            <span className="quoteLine">Rise above</span>{" "}
            <span className="quoteLine">the noise.</span>
          </p>
        </blockquote>
      </div>
      <footer className="bottomRow">
        <span>emir.com.au</span>
        <time className="date footerDate" dateTime={`${date.iso}T${TIME_24H}`}>
          {`${date.label} · ${TIME_LABEL}`}
        </time>
      </footer>
    </main>
  );
}

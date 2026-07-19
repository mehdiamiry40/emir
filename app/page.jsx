import Link from "next/link";
import Eagle from "./eagle";
import { getDate } from "../lib/date";
import { SIGNIN_PATH, SITE_NAME, SOCIAL_DESCRIPTION } from "./site";

const QUOTE_TEXT = "Rise above the noise.";
const SIGNAL_RAYS = Array.from({ length: 96 }, (_, index) => index);

function SignalField() {
  return (
    <div className="signalField" aria-hidden="true">
      <div className="signalRays">
        {SIGNAL_RAYS.map((ray) => (
          <span
            className="signalRay"
            key={ray}
            style={{ transform: `rotate(${ray * 3.75}deg)` }}
          />
        ))}
      </div>
      <span className="signalRing signalRingOuter" />
      <span className="signalRing signalRingInner" />
      <span className="signalCore" />
    </div>
  );
}

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
    <main className="home signalHome" aria-label={`${SITE_NAME} homepage`}>
      <header className="topRow">
        <span className="wordmark" aria-label={SITE_NAME}>
          <span className="wordmarkMark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>{SITE_NAME}</span>
        </span>

        <div className="siteStatus" aria-label="Page status">
          <span className="siteStatusActive">Home</span>
          <time dateTime={date.iso}>20.07.26</time>
        </div>

        <Link className="signinCta topSignin" href={SIGNIN_PATH}>
          Sign in
        </Link>
      </header>

      <section className="signalStage" aria-label="Eagle signal">
        <SignalField />
        <Eagle />
      </section>

      <section className="hero" aria-labelledby="hero-title">
        <h1
          className="heroQuote"
          data-text={QUOTE_TEXT}
          id="hero-title"
          aria-label={QUOTE_TEXT}
        >
          <span>Rise above</span>
          <span>the noise.</span>
        </h1>
        <Link className="signinCta heroSignin" href={SIGNIN_PATH}>
          Sign in
        </Link>
      </section>

      <footer className="bottomRow">
        <span>emir.com.au</span>
        <time className="date footerDate" dateTime={date.iso}>
          {date.label}
        </time>
      </footer>
    </main>
  );
}

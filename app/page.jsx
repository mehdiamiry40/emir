import { Analytics } from "@vercel/analytics/react";
import Eagle from "./eagle";
import HomeCta from "./home-cta";
import SignalField from "./signal-field";
import { SITE_NAME, SOCIAL_DESCRIPTION } from "./site";

const QUOTE_TEXT = "Rise above the noise.";
const WORDMARK_PIXELS = [
  [4, 1],
  [3, 2],
  [4, 2],
  [5, 2],
  [1, 3],
  [2, 3],
  [4, 3],
  [6, 3],
  [7, 3],
  [2, 4],
  [3, 4],
  [4, 4],
  [5, 4],
  [6, 4],
  [3, 5],
  [5, 5],
];

export const metadata = {
  title: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_NAME,
    description: SOCIAL_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SOCIAL_DESCRIPTION,
  },
};

export default function Home() {
  return (
    <>
      <main className="home signalHome" aria-label={`${SITE_NAME} homepage`}>
        <header className="topRow">
          <span className="wordmark" aria-label={SITE_NAME}>
            <span className="wordmarkMark" aria-hidden="true">
              {WORDMARK_PIXELS.map(([column, row], index) => (
                <i
                  key={`${column}-${row}-${index}`}
                  style={{ gridColumn: column, gridRow: row }}
                />
              ))}
            </span>
            <span>{SITE_NAME}</span>
          </span>

          <div className="siteStatus" aria-label="Page status">
            <span className="siteStatusActive">Home</span>
          </div>

          <HomeCta className="signinCta topSignin" />
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
          <HomeCta className="signinCta heroSignin" />
        </section>

        <footer className="bottomRow">
          <span>emir.com.au</span>
        </footer>
      </main>
      <Analytics />
    </>
  );
}

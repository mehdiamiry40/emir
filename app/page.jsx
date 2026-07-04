import Link from "next/link";
import Eagle from "./eagle";
import ThemeToggle from "./theme-toggle";
import {
  DATE_ISO,
  DATE_LABEL,
  SIGNIN_PATH,
  SITE_NAME,
  SOCIAL_DESCRIPTION,
  SOCIAL_IMAGE,
} from "./site";

export const metadata = {
  title: `${SITE_NAME} — ${DATE_LABEL}`,
  openGraph: {
    title: `${SITE_NAME} — ${DATE_LABEL}`,
    description: SOCIAL_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${DATE_LABEL}`,
    description: SOCIAL_DESCRIPTION,
    images: [SOCIAL_IMAGE.url],
  },
};

export default function Home() {
  return (
    <>
      <Link className="loginButton" href={SIGNIN_PATH}>
        Sign in
      </Link>
      <ThemeToggle />
      <main className="home" aria-label="Eagle homepage">
        <h1 className="srOnly">{SITE_NAME}</h1>
        <Eagle />
        <time className="date" dateTime={DATE_ISO}>
          {DATE_LABEL}
        </time>
      </main>
    </>
  );
}

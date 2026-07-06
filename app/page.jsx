import Link from "next/link";
import Eagle from "./eagle";
import ThemeToggle from "./theme-toggle";
import { getDate } from "../lib/date";
import {
  SIGNIN_PATH,
  SITE_NAME,
  SOCIAL_DESCRIPTION,
  SOCIAL_IMAGE,
} from "./site";

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
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE_NAME} — ${date.label}`,
      description: SOCIAL_DESCRIPTION,
      images: [SOCIAL_IMAGE.url],
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

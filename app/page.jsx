import Eagle from "./eagle";
import ThemeToggle from "./theme-toggle";

const DATE_LABEL = "Sunday, July 5, 2026";
const DATE_ISO = "2026-07-05";
const DESCRIPTION = "One eagle. One date.";

export const metadata = {
  title: `Eagle — ${DATE_LABEL}`,
  openGraph: {
    title: `Eagle — ${DATE_LABEL}`,
    description: DESCRIPTION,
    url: "/",
    siteName: "Eagle",
    type: "website",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: `Black eagle above the date ${DATE_LABEL}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Eagle — ${DATE_LABEL}`,
    description: DESCRIPTION,
    images: ["/og.jpg"],
  },
};

export default function Home() {
  return (
    <>
      <ThemeToggle />
      <main className="home" aria-label="Eagle homepage">
        <h1 className="srOnly">Eagle</h1>
        <Eagle />
        <time className="date" dateTime={DATE_ISO}>
          {DATE_LABEL}
        </time>
      </main>
    </>
  );
}

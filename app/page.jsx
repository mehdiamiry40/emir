import Eagle from "./eagle";
import DateDisplay from "./date-display";
import { formatToday } from "./date-utils";
import ThemeToggle from "./theme-toggle";

const DESCRIPTION = "One eagle. One date.";

export const metadata = {
  title: "Eagle",
  openGraph: {
    title: "Eagle",
    description: DESCRIPTION,
    url: "/",
    siteName: "Eagle",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Black eagle above today's date",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Eagle",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export const dynamic = "force-dynamic";

export default function Home() {
  const initialDate = formatToday(new Date());

  return (
    <main className="home" aria-label="Eagle homepage">
      <ThemeToggle />
      <Eagle />
      <DateDisplay initialDate={initialDate} />
    </main>
  );
}

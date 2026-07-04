import Eagle from "./eagle";
import ThemeToggle from "./theme-toggle";

const DATE_LABEL = "Saturday, July 4, 2026";
const DATE_ISO = "2026-07-04";

export const metadata = {
  title: `Eagle — ${DATE_LABEL}`,
};

export default function Home() {
  return (
    <main className="home" aria-label="Eagle homepage">
      <ThemeToggle />
      <Eagle />
      <time className="date" dateTime={DATE_ISO}>
        {DATE_LABEL}
      </time>
    </main>
  );
}

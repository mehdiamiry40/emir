import Link from "next/link";
import ThemeToggle from "./theme-toggle";

export default function NotFound() {
  return (
    <main className="home" aria-label="Page not found">
      <title>Eagle — Not found</title>
      <ThemeToggle />
      <p className="notFoundCode">404</p>
      <p className="date notFoundText">This page has flown away.</p>
      <Link className="homeLink" href="/">
        Return to the eagle
      </Link>
    </main>
  );
}

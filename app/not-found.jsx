import Link from "next/link";
import ThemeToggle from "./theme-toggle";

export const metadata = {
  title: "Eagle — Not found",
};

export default function NotFound() {
  return (
    <>
      <ThemeToggle />
      <main className="home" aria-label="Page not found">
        <h1 className="notFoundCode">404</h1>
        <p className="date notFoundText">This page has flown away.</p>
        <Link className="homeLink" href="/">
          Return to the eagle
        </Link>
      </main>
    </>
  );
}

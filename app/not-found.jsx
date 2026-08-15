import Link from "next/link";

export const metadata = {
  title: "EMIR — Not found",
};

export default function NotFound() {
  return (
    <>
      <main className="home" aria-label="Page not found">
        <h1 className="notFoundCode">404</h1>
        <p className="notFoundText">This page has flown away.</p>
        <Link className="homeLink" href="/">
          Return to the eagle
        </Link>
      </main>
    </>
  );
}

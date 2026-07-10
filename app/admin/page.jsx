import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "../../lib/session";
import { getDate } from "../../lib/date";
import { SITE_NAME } from "../site";
import { signOut } from "../signin/actions";

export const metadata = {
  title: `${SITE_NAME} — Admin`,
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) {
    redirect("/signin");
  }

  const date = await getDate();

  return (
    <>
      <Link className="loginButton" href="/">
        Home
      </Link>
      <main className="home signinHome" aria-label="Admin">
        <section className="signinPanel" aria-labelledby="admin-title">
          <p className="signinEyebrow">{SITE_NAME}</p>
          <h1 className="signinTitle" id="admin-title">
            Admin
          </h1>
          <div className="adminSummary">
            <span className="signinField">Frozen date</span>
            <time className="adminPreview" dateTime={date.iso}>
              {date.label}
            </time>
          </div>
          <form action={signOut}>
            <button className="adminSignout" type="submit">
              Sign out
            </button>
          </form>
        </section>
      </main>
    </>
  );
}

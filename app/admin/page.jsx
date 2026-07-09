import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ThemeToggle from "../theme-toggle";
import { SESSION_COOKIE, verifySessionToken } from "../../lib/session";
import { getDate } from "../../lib/date";
import { SITE_NAME } from "../site";
import { signOut } from "../signin/actions";
import AdminPanel from "./admin-panel";

export const metadata = {
  title: `${SITE_NAME} — Admin`,
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) {
    redirect("/signin");
  }

  const date = await getDate();
  const storageConfigured = Boolean(
    process.env.ENABLE_DATE_OVERRIDE === "true" &&
      process.env.EDGE_CONFIG &&
      process.env.EDGE_CONFIG_ID &&
      process.env.VERCEL_API_TOKEN
  );

  return (
    <>
      <Link className="loginButton" href="/">
        Home
      </Link>
      <ThemeToggle />
      <main className="home signinHome" aria-label="Admin">
        <section className="signinPanel" aria-labelledby="admin-title">
          <p className="signinEyebrow">{SITE_NAME}</p>
          <h1 className="signinTitle" id="admin-title">
            Admin
          </h1>
          <AdminPanel initialDate={date} storageConfigured={storageConfigured} />
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

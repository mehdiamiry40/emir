import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isPasskeyConfigured } from "../../lib/passkeys";
import { SESSION_COOKIE, verifySessionToken } from "../../lib/session";
import SignalField from "../signal-field";
import { SITE_NAME } from "../site";
import SignInForm from "./signin-form";

export const metadata = {
  title: `${SITE_NAME} — Sign in`,
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const jar = await cookies();
  if (await verifySessionToken(jar.get(SESSION_COOKIE)?.value)) {
    redirect("/admin");
  }

  return (
    <>
      <Link className="loginButton" href="/">
        Home
      </Link>
      <main className="home signinHome" aria-label="Sign in">
        <div className="signinStage">
          <SignalField className="signinSignalField" />
        </div>
        <section className="signinPanel" aria-labelledby="signin-title">
          <div className="signinMark" aria-hidden="true">
            <img src="/eagle-icon.svg" alt="" decoding="async" />
          </div>
          <p className="signinEyebrow">{SITE_NAME}</p>
          <h1 className="signinTitle" id="signin-title">
            Sign in
          </h1>
          <SignInForm passkeyEnabled={isPasskeyConfigured()} />
        </section>
      </main>
    </>
  );
}

import Link from "next/link";
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

export default function SignInPage() {
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
          <SignInForm />
        </section>
      </main>
    </>
  );
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "../../../lib/session";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request) {
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const iso = body?.iso;
  if (typeof iso !== "string" || !ISO_RE.test(iso)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        "Date changes are disabled. Update DATE_LABEL and DATE_ISO in app/site.js to change the frozen date.",
    },
    { status: 501 }
  );
}

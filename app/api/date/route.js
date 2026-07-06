import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "../../../lib/session";
import { formatDate } from "../../../lib/date";

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

  const id = process.env.EDGE_CONFIG_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (!id || !token) {
    return NextResponse.json(
      {
        error:
          "Storage is not configured — set EDGE_CONFIG_ID and VERCEL_API_TOKEN.",
      },
      { status: 501 }
    );
  }

  const teamId = process.env.VERCEL_TEAM_ID;
  const res = await fetch(
    `https://api.vercel.com/v1/edge-config/${id}/items${teamId ? `?teamId=${teamId}` : ""}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ operation: "upsert", key: "date", value: iso }],
      }),
    }
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: `Edge Config update failed (${res.status}).` },
      { status: 502 }
    );
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true, date: formatDate(iso) });
}

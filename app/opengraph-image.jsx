import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getDate } from "../lib/date";
import { SITE_NAME } from "./site";

export const alt = "Black eagle and monochrome quote on a white background";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [date, eagle, font] = await Promise.all([
    getDate(),
    readFile(join(process.cwd(), "public/eagle-icon.svg")),
    readFile(join(process.cwd(), "assets/inter-700.ttf")),
  ]);

  const eagleSrc = `data:image/svg+xml;base64,${eagle.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "space-between",
          background: "#fafafa",
          padding: "64px 72px",
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 20,
            borderBottom: "2px solid rgba(17, 17, 17, 0.18)",
            fontSize: 28,
            fontWeight: 700,
            color: "#111111",
          }}
        >
          <div style={{ display: "flex" }}>{SITE_NAME}</div>
          <div style={{ display: "flex", color: "#5c5c5c", fontSize: 22 }}>
            {date.label}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 34,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={eagleSrc} width={440} height={106} alt="" />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              color: "#111111",
              fontSize: 78,
              fontWeight: 700,
              letterSpacing: 0,
              lineHeight: 0.98,
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex" }}>RISE ABOVE</div>
            <div style={{ display: "flex" }}>THE NOISE.</div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            paddingTop: 20,
            borderTop: "2px solid rgba(17, 17, 17, 0.18)",
            color: "#5c5c5c",
            fontSize: 20,
          }}
        >
          EMIR.COM.AU
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: font,
          weight: 700,
          style: "normal",
        },
      ],
    }
  );
}

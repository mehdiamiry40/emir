import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getDate } from "../lib/date";
import { SITE_NAME } from "./site";

export const alt = "Gold eagle and engraved gold quote on a burgundy background";
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
          background:
            "radial-gradient(circle at 58% 48%, rgba(142, 0, 48, 0.72), transparent 34%), linear-gradient(145deg, #080003, #2a0010 48%, #52001c)",
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
            borderBottom: "2px solid rgba(248, 214, 128, 0.34)",
            fontSize: 28,
            fontWeight: 700,
            color: "#fff8eb",
          }}
        >
          <div style={{ display: "flex" }}>{SITE_NAME}</div>
          <div style={{ display: "flex", color: "#e1bf68", fontSize: 22 }}>
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
          <img
            src={eagleSrc}
            width={440}
            height={106}
            alt=""
            style={{
              filter:
                "invert(78%) sepia(43%) saturate(565%) hue-rotate(3deg) brightness(104%) contrast(92%)",
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              color: "#e8d189",
              fontSize: 78,
              fontWeight: 700,
              letterSpacing: 0,
              lineHeight: 0.98,
              textAlign: "center",
              textShadow: "0 5px 0 #4a3510, 0 14px 24px rgba(0,0,0,0.55)",
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
            borderTop: "2px solid rgba(248, 214, 128, 0.34)",
            color: "rgba(255, 248, 235, 0.68)",
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

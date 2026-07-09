import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getDate } from "../lib/date";

export const revalidate = 60;
export const alt = "Black eagle above the site's date";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [date, eagle, font] = await Promise.all([
    getDate(),
    readFile(join(process.cwd(), "public/eagle-icon.svg")),
    readFile(join(process.cwd(), "assets/inter-700.ttf")),
  ]);

  const eagleSrc = `data:image/svg+xml;base64,${eagle.toString("base64")}`;
  const [weekday, ...rest] = date.label.split(" ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
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
            paddingBottom: 20,
            borderBottom: "2px solid rgba(248, 214, 128, 0.34)",
            fontSize: 28,
            fontWeight: 700,
            color: "#fff8eb",
          }}
        >
          Eagle
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={eagleSrc}
          width={640}
          height={154}
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
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: 0,
            lineHeight: 1.05,
          }}
        >
          <div style={{ color: "#fff8eb", display: "flex" }}>{weekday}</div>
          <div style={{ color: "#e1bf68", display: "flex" }}>
            {rest.join(" ")}
          </div>
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

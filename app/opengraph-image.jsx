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
    readFile(join(process.cwd(), "assets/space-grotesk-600.ttf")),
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
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(180deg, #fdfdfb 0%, #f6f7f2 55%, #e5e8df 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={eagleSrc} width={860} height={207} alt="" />
        <div
          style={{
            marginTop: 44,
            paddingTop: 28,
            borderTop: "1px solid rgba(7, 7, 7, 0.22)",
            fontSize: 42,
            fontFamily: "Space Grotesk",
            color: "rgba(7, 7, 7, 0.78)",
          }}
        >
          {date.label}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Space Grotesk",
          data: font,
          weight: 600,
          style: "normal",
        },
      ],
    }
  );
}

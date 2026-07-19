import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getDate } from "../lib/date";
import { SITE_NAME } from "./site";

export const alt = "White eagle signal and statement on a cobalt background";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const RAYS = Array.from({ length: 72 }, (_, index) => {
  const angle = (index / 72) * Math.PI * 2;
  return {
    angle: index * 5,
    x: 50 + Math.cos(angle) * 48,
    y: 50 + Math.sin(angle) * 48,
  };
});

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
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#2f64c7",
          color: "#ffffff",
          fontFamily: "Inter",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 600,
            width: 1,
            display: "flex",
            background: "rgba(255,255,255,0.14)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 275,
            right: 0,
            left: 0,
            height: 1,
            display: "flex",
            background: "rgba(255,255,255,0.14)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 36,
            right: 48,
            left: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex" }}>{SITE_NAME}</div>
          <div
            style={{
              display: "flex",
              padding: "12px 16px",
              border: "1px solid rgba(255,255,255,0.32)",
              borderRadius: 4,
              background: "#123d8f",
              fontSize: 17,
            }}
          >
            {date.label}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            top: 76,
            left: 390,
            width: 420,
            height: 420,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 210,
          }}
        >
          {RAYS.map((ray) => (
            <div
              key={`dot-${ray.angle}`}
              style={{
                position: "absolute",
                left: `${ray.x}%`,
                top: `${ray.y}%`,
                width: 5,
                height: 5,
                display: "flex",
                borderRadius: 3,
                background: "#ffffff",
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              width: 126,
              height: 126,
              display: "flex",
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 63,
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={eagleSrc}
            width={330}
            height={80}
            alt=""
            style={{
              position: "absolute",
              filter: "brightness(0) invert(1)",
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 52,
            left: 48,
            display: "flex",
            flexDirection: "column",
            fontSize: 65,
            fontWeight: 700,
            letterSpacing: 0,
            lineHeight: 0.94,
          }}
        >
          <div style={{ display: "flex" }}>RISE ABOVE</div>
          <div style={{ display: "flex" }}>THE NOISE.</div>
        </div>

        <div
          style={{
            position: "absolute",
            right: 48,
            bottom: 38,
            display: "flex",
            color: "#edf4ff",
            fontSize: 16,
            fontWeight: 700,
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
    },
  );
}

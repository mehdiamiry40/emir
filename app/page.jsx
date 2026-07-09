import Link from "next/link";
import Eagle from "./eagle";
import { getDate } from "../lib/date";
import { SIGNIN_PATH, SITE_NAME, SOCIAL_DESCRIPTION } from "./site";

export const revalidate = 60;

const QUOTE_TEXT = "Rise above the noise.";
const EXTRUSION_STEPS = [12, 10, 8, 6, 4, 2];
const DESKTOP_QUOTE_LINES = [
  { text: "RISE ABOVE", y: 152 },
  { text: "THE NOISE.", y: 318 },
];
const MOBILE_QUOTE_LINES = [
  { text: "RISE", y: 150 },
  { text: "ABOVE", y: 334 },
  { text: "THE", y: 518 },
  { text: "NOISE.", y: 702 },
];

function QuoteLine({ line, centerX, xScale }) {
  return (
    <text
      x={centerX}
      y={line.y}
      textAnchor="middle"
      transform={`translate(${centerX} 0) scale(${xScale} 1) translate(${-centerX} 0)`}
    >
      {line.text}
    </text>
  );
}

function QuoteSvg({ className, id, lines, viewBox, centerX, xScale }) {
  const gold = `quoteGold-${id}`;
  const sheen = `quoteSheen-${id}`;
  const edge = `quoteEdge-${id}`;
  const rim = `quoteRim-${id}`;
  const inner = `quoteInner-${id}`;
  const shadow = `quoteShadow-${id}`;
  const texture = `quoteTexture-${id}`;
  const facetShade = `quoteFacetShade-${id}`;
  const facetHighlight = `quoteFacetHighlight-${id}`;
  const bevel = `quoteBevel-${id}`;
  const brushed = `quoteBrushed-${id}`;

  return (
    <svg
      className={className}
      viewBox={viewBox}
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gold} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#44350f" />
          <stop offset="7%" stopColor="#fff3bf" />
          <stop offset="15%" stopColor="#ead78d" />
          <stop offset="25%" stopColor="#b89535" />
          <stop offset="36%" stopColor="#5b4716" />
          <stop offset="48%" stopColor="#fff7cf" />
          <stop offset="58%" stopColor="#d7bd62" />
          <stop offset="68%" stopColor="#8a6f25" />
          <stop offset="78%" stopColor="#3d310f" />
          <stop offset="90%" stopColor="#e8d69a" />
          <stop offset="100%" stopColor="#fff0b6" />
        </linearGradient>
        <linearGradient id={sheen} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fffada" stopOpacity="0" />
          <stop offset="15%" stopColor="#fff8d4" stopOpacity="0.82" />
          <stop offset="29%" stopColor="#fff4c6" stopOpacity="0.1" />
          <stop offset="48%" stopColor="#fffada" stopOpacity="0.78" />
          <stop offset="61%" stopColor="#ffeea6" stopOpacity="0.2" />
          <stop offset="78%" stopColor="#5f4e25" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#fff8d6" stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id={rim} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff2b5" />
          <stop offset="22%" stopColor="#6c571d" />
          <stop offset="44%" stopColor="#d4b858" />
          <stop offset="64%" stopColor="#312509" />
          <stop offset="83%" stopColor="#fff4c6" />
          <stop offset="100%" stopColor="#8f7429" />
        </linearGradient>
        <linearGradient id={inner} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff9d7" />
          <stop offset="18%" stopColor="#fff0b6" />
          <stop offset="35%" stopColor="#92752a" />
          <stop offset="55%" stopColor="#fff7cf" />
          <stop offset="76%" stopColor="#5b4716" />
          <stop offset="100%" stopColor="#d5bd6d" />
        </linearGradient>
        <linearGradient id={edge} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff6cf" />
          <stop offset="12%" stopColor="#fff0b6" />
          <stop offset="34%" stopColor="#aa8d37" />
          <stop offset="53%" stopColor="#fff7cf" />
          <stop offset="76%" stopColor="#5a4717" />
          <stop offset="100%" stopColor="#d7bd62" />
        </linearGradient>
        <linearGradient id={facetShade} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2d220d" stopOpacity="0.14" />
          <stop offset="19%" stopColor="#2d220d" stopOpacity="0" />
          <stop offset="31%" stopColor="#31250d" stopOpacity="0.48" />
          <stop offset="44%" stopColor="#31250d" stopOpacity="0.3" />
          <stop offset="55%" stopColor="#2b210d" stopOpacity="0" />
          <stop offset="70%" stopColor="#2b210d" stopOpacity="0.52" />
          <stop offset="88%" stopColor="#2b210d" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#2b210d" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={facetHighlight} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff6d5" stopOpacity="0.58" />
          <stop offset="11%" stopColor="#fff6d5" stopOpacity="0.2" />
          <stop offset="25%" stopColor="#fff6d5" stopOpacity="0" />
          <stop offset="43%" stopColor="#fff3bf" stopOpacity="0.52" />
          <stop offset="51%" stopColor="#fff3bf" stopOpacity="0.12" />
          <stop offset="66%" stopColor="#fff3bf" stopOpacity="0" />
          <stop offset="90%" stopColor="#f2e5c5" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#f2e5c5" stopOpacity="0.06" />
        </linearGradient>
        <pattern id={brushed} width="1" height="10" patternUnits="userSpaceOnUse">
          <rect width="1" height="10" fill="transparent" />
          <rect y="1" width="1" height="1" fill="#fff2bf" opacity="0.26" />
          <rect y="4" width="1" height="1" fill="#5d5028" opacity="0.18" />
          <rect y="7" width="1" height="1" fill="#f2e5c5" opacity="0.16" />
        </pattern>
        <filter id={shadow} x="-8%" y="-8%" width="116%" height="124%">
          <feDropShadow dx="8" dy="10" stdDeviation="2.4" floodColor="#090505" floodOpacity="0.52" />
        </filter>
        <filter
          id={bevel}
          x="-6%"
          y="-6%"
          width="112%"
          height="112%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="softAlpha" />
          <feSpecularLighting
            in="softAlpha"
            surfaceScale="4.8"
            specularConstant="0.85"
            specularExponent="28"
            lightingColor="#fff4c7"
            result="specular"
          >
            <feDistantLight azimuth="235" elevation="48" />
          </feSpecularLighting>
          <feComposite in="specular" in2="SourceAlpha" operator="in" result="specularClip" />
          <feBlend in="SourceGraphic" in2="specularClip" mode="screen" />
        </filter>
        <filter
          id={texture}
          x="-4%"
          y="-4%"
          width="108%"
          height="108%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.018 0.34"
            numOctaves="2"
            seed="9"
            result="grain"
          />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 0.84 0 0 0 0 0.73 0 0 0 0 0.36 0 0 0 0.16 0"
            result="goldGrain"
          />
          <feComposite in="goldGrain" in2="SourceAlpha" operator="in" result="clippedGrain" />
          <feBlend in="SourceGraphic" in2="clippedGrain" mode="overlay" />
        </filter>
      </defs>
      <g className="quoteText quoteExtrusion" filter={`url(#${shadow})`}>
        {EXTRUSION_STEPS.map((offset) => (
          <g key={offset} transform={`translate(${offset} ${offset * 0.82})`}>
            {lines.map((line) => (
              <QuoteLine
                key={`${offset}-${line.text}`}
                line={line}
                centerX={centerX}
                xScale={xScale}
              />
            ))}
          </g>
        ))}
      </g>
      <g className="quoteText quoteBlackRim">
        {lines.map((line) => (
          <QuoteLine key={`black-rim-${line.text}`} line={line} centerX={centerX} xScale={xScale} />
        ))}
      </g>
      <g className="quoteText quoteWideBevel" stroke={`url(#${rim})`}>
        {lines.map((line) => (
          <QuoteLine key={`wide-bevel-${line.text}`} line={line} centerX={centerX} xScale={xScale} />
        ))}
      </g>
      <g className="quoteText quoteOuterRim">
        {lines.map((line) => (
          <QuoteLine key={`rim-${line.text}`} line={line} centerX={centerX} xScale={xScale} />
        ))}
      </g>
      <g className="quoteText quoteFace" fill={`url(#${gold})`} filter={`url(#${texture})`}>
        {lines.map((line) => (
          <QuoteLine key={`face-${line.text}`} line={line} centerX={centerX} xScale={xScale} />
        ))}
      </g>
      <g className="quoteText quoteFacetShade" fill={`url(#${facetShade})`}>
        {lines.map((line) => (
          <QuoteLine key={`facet-shade-${line.text}`} line={line} centerX={centerX} xScale={xScale} />
        ))}
      </g>
      <g className="quoteText quoteFacetHighlight" fill={`url(#${facetHighlight})`}>
        {lines.map((line) => (
          <QuoteLine
            key={`facet-highlight-${line.text}`}
            line={line}
            centerX={centerX}
            xScale={xScale}
          />
        ))}
      </g>
      <g className="quoteText quoteBrushed" fill={`url(#${brushed})`}>
        {lines.map((line) => (
          <QuoteLine
            key={`brushed-${line.text}`}
            line={line}
            centerX={centerX}
            xScale={xScale}
          />
        ))}
      </g>
      <g className="quoteText quoteSpecular" fill="#fff4c7" filter={`url(#${bevel})`}>
        {lines.map((line) => (
          <QuoteLine
            key={`specular-${line.text}`}
            line={line}
            centerX={centerX}
            xScale={xScale}
          />
        ))}
      </g>
      <g className="quoteText quoteSheen" fill={`url(#${sheen})`}>
        {lines.map((line) => (
          <QuoteLine key={`sheen-${line.text}`} line={line} centerX={centerX} xScale={xScale} />
        ))}
      </g>
      <g className="quoteText quoteEdgeLight" stroke={`url(#${edge})`}>
        {lines.map((line) => (
          <QuoteLine key={`edge-${line.text}`} line={line} centerX={centerX} xScale={xScale} />
        ))}
      </g>
      <g className="quoteText quoteInnerEdge" stroke={`url(#${inner})`}>
        {lines.map((line) => (
          <QuoteLine key={`inner-edge-${line.text}`} line={line} centerX={centerX} xScale={xScale} />
        ))}
      </g>
    </svg>
  );
}

export async function generateMetadata() {
  const date = await getDate();
  return {
    title: `${SITE_NAME} — ${date.label}`,
    openGraph: {
      title: `${SITE_NAME} — ${date.label}`,
      description: SOCIAL_DESCRIPTION,
      url: "/",
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE_NAME} — ${date.label}`,
      description: SOCIAL_DESCRIPTION,
    },
  };
}

export default async function Home() {
  const date = await getDate();

  return (
    <>
      <main className="home homePoster" aria-label={`${SITE_NAME} homepage`}>
        <h1 className="srOnly">{SITE_NAME}</h1>
        <header className="topRow">
          <span className="wordmark">{SITE_NAME}</span>
          <Eagle />
          <Link className="signinCta topSignin" href={SIGNIN_PATH}>
            Sign in
          </Link>
        </header>
        <div className="hero">
          <blockquote className="heroQuote" data-text={QUOTE_TEXT}>
            <span className="srOnly">{QUOTE_TEXT}</span>
            <QuoteSvg
              className="quoteSvg quoteSvgDesktop"
              id="desktop"
              lines={DESKTOP_QUOTE_LINES}
              viewBox="0 0 1200 390"
              centerX={600}
              xScale={1.3}
            />
            <QuoteSvg
              className="quoteSvg quoteSvgMobile"
              id="mobile"
              lines={MOBILE_QUOTE_LINES}
              viewBox="0 0 720 840"
              centerX={360}
              xScale={1.15}
            />
          </blockquote>
        </div>
        <footer className="bottomRow">
          <span>emir.com.au</span>
          <time className="date footerDate" dateTime={date.iso}>
            {date.label}
          </time>
        </footer>
      </main>
    </>
  );
}

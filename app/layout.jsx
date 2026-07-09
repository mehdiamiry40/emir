import "./globals.css";
import { Cinzel, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { DESCRIPTION, SITE_NAME, SITE_URL, THEME_COLOR } from "./site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-quote",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  description: DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
};

export const viewport = {
  themeColor: THEME_COLOR,
};

/** @param {{ children: import("react").ReactNode }} props */
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${cinzel.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

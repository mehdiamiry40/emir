import "./globals.css";
import { Inter } from "next/font/google";
import { DESCRIPTION, SITE_NAME, SITE_URL, THEME_COLOR } from "./site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  description: DESCRIPTION,
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: THEME_COLOR,
  viewportFit: "cover",
};

/** @param {{ children: import("react").ReactNode }} props */
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}

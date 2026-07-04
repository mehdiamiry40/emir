import "./globals.css";

export const metadata = {
  title: "Eagle",
  description: "Personal eagle homepage",
  icons: {
    icon: "/eagle-icon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

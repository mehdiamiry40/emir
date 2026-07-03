import "./globals.css";

export const metadata = {
  title: "Eagle",
  description: "One page. One eagle. Today's date.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "../public/css/base.css";
import "../public/css/layout.css";
import "../public/css/components.css";
import "../public/css/themes.css";

export const metadata: Metadata = {
  title: "ebola arcade",
  icons: {
    icon: "/assets/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

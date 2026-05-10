import type { Metadata } from "next";
import "../public/css/base.css";
import "../public/css/layout.css";
import "../public/css/components.css";
import "../public/css/themes.css";

export const metadata: Metadata = {
  title: "ebola",
  icons: {
    icon: "/assets/flaticon.svg",
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
      </body>
    </html>
  );
}

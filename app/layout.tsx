import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react"
import "./globals.css";

export const metadata: Metadata = {
  title: "Adrian Axenie — Portfolio",
  description: "Product engineer & founder. I design, build, and ship products end-to-end.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-theme="forest">
        <Analytics/>
        <body>
          {children}
        </body>
    </html>
  );
}

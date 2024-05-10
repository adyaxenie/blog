import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react"
import "./globals.css";
import { getServerSession } from "next-auth"
import SessionProvider from "./components/SessionProvider";
import NavMenu from "./components/Login";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "My personal portfolio website",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession();
  return (
    <html data-theme="forest">
        <Analytics/>
        <body>
          <SessionProvider session={session}>
            {children}
          </SessionProvider>
        </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexAuthProvider } from "@/components/providers/convex-auth-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "webhooks.cc - Inspect webhooks instantly",
  description:
    "The fastest way to debug webhooks. Get a URL in one click, inspect requests in real-time, forward to localhost.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConvexAuthProvider>{children}</ConvexAuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: {
    default: "AIBridge — AI readiness & RAG for SMBs",
    template: "%s · AIBridge",
  },
  description:
    "A local AI microservice that crawls your website, indexes your documents, answers questions in your voice, and scores your AI readiness.",
  metadataBase: new URL("http://localhost:3000"),
  openGraph: {
    title: "AIBridge",
    description:
      "A local AI microservice that crawls your website, indexes your documents, answers questions in your voice, and scores your AI readiness.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Github } from "lucide-react";

const NAV = [
  { href: "/", label: "Product" },
  { href: "/install", label: "Install" },
  { href: "/console", label: "Console" },
  { href: "/chat-widget-demo", label: "Widget" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-white/70 border-b border-ink-200/70">
      <div className="container-prose flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Logo />
          <span className="font-semibold tracking-tight text-ink-900">AIBridge</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-sm transition-colors",
                  active ? "text-ink-900 bg-ink-100" : "text-ink-500 hover:text-ink-900 hover:bg-ink-50"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/Someshwar-prox/edumoon-innovation-challenge"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-sm"
          >
            <Github size={15} strokeWidth={2} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <Link href="/console" className="btn-primary text-sm">Open console</Link>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="6" fill="#0a0a0c" />
      <path
        d="M7.5 12.5L10.5 15.5L16.5 8.5"
        stroke="#5b8cff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

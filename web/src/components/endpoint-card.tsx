import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

interface Props {
  method: "POST" | "GET";
  path: string;
  title: string;
  body: string;
  icon: LucideIcon;
}

export function EndpointCard({ method, path, title, body, icon: Icon }: Props) {
  return (
    <Link href="/console" className="card card-hover p-6 block group">
      <div className="flex items-start justify-between">
        <div className="inline-flex items-center gap-2 font-mono text-xs">
          <span
            className={
              "px-2 py-0.5 rounded-md font-medium " +
              (method === "POST"
                ? "bg-accent-50 text-accent-700"
                : "bg-ink-100 text-ink-700")
            }
          >
            {method}
          </span>
          <span className="text-ink-700">{path}</span>
        </div>
        <ArrowUpRight
          size={18}
          strokeWidth={2}
          className="text-ink-400 group-hover:text-ink-900 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform"
        />
      </div>
      <div className="mt-6 flex items-center gap-3">
        <div className="size-9 rounded-xl bg-ink-900 text-white flex items-center justify-center">
          <Icon size={17} strokeWidth={2} />
        </div>
        <h3 className="font-semibold text-ink-900 tracking-tight">{title}</h3>
      </div>
      <p className="mt-4 text-sm text-ink-500 text-pretty leading-relaxed">{body}</p>
    </Link>
  );
}

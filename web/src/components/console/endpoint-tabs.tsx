"use client";

import { ENDPOINTS, type EndpointId } from "./types";

interface Props {
  active: EndpointId;
  onChange: (id: EndpointId) => void;
}

export function EndpointTabs({ active, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-ink-100/80 p-1 ring-1 ring-ink-200/60 overflow-x-auto max-w-full">
      {ENDPOINTS.map((e) => {
        const isActive = active === e.id;
        return (
          <button
            key={e.id}
            onClick={() => onChange(e.id)}
            className={
              "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all " +
              (isActive
                ? "bg-white text-ink-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-ink-500 hover:text-ink-900")
            }
          >
            <e.icon size={14} strokeWidth={2} />
            {e.title}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function InfoTooltip({
  content,
  children,
}: {
  content: string[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [touchMode, setTouchMode] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setTouchMode(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open || !touchMode) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, touchMode]);

  return (
    <span
      ref={rootRef}
      className="relative inline-flex"
      onMouseEnter={() => {
        if (!touchMode) setOpen(true);
      }}
      onMouseLeave={() => {
        if (!touchMode) setOpen(false);
      }}
    >
      <button
        type="button"
        className="inline-flex cursor-help items-center gap-0.5 border-0 bg-transparent p-0"
        aria-expanded={open}
        aria-describedby={open ? "info-tooltip-content" : undefined}
        onClick={() => {
          if (touchMode) setOpen((value) => !value);
        }}
      >
        {children}
      </button>
      {open ? (
        <span
          id="info-tooltip-content"
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-left text-xs leading-relaxed text-slate-700 shadow-lg sm:w-56"
        >
          {content.map((line, index) => (
            <span key={line} className={index > 0 ? "mt-1 block" : "block"}>
              {line}
            </span>
          ))}
          <span
            className="absolute left-1/2 top-full -mt-px -translate-x-1/2 border-4 border-transparent border-t-white"
            aria-hidden
          />
        </span>
      ) : null}
    </span>
  );
}

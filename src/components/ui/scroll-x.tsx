"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal slider for wide tables: swipe, scroll, arrow keys, or the ◀ ▶ buttons that appear
 * whenever columns are hidden on that side. The page itself never scrolls sideways.
 */
export function ScrollX({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [update]);

  const slide = (dir: -1 | 1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        onScroll={update}
        tabIndex={edges.left || edges.right ? 0 : undefined}
        role={edges.left || edges.right ? "region" : undefined}
        aria-label={edges.left || edges.right ? label ?? t("scrollTable") : undefined}
        className="scroll-x overflow-x-auto overscroll-x-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 print:overflow-visible"
      >
        {children}
      </div>
      {edges.left && (
        <button
          type="button"
          onClick={() => slide(-1)}
          aria-label={t("scrollLeft")}
          className="absolute left-1 top-1 flex size-9 items-center justify-center rounded-full border border-primary-200 bg-white/95 text-primary-800 shadow-md hover:bg-primary-50 print:hidden"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
      )}
      {edges.right && (
        <button
          type="button"
          onClick={() => slide(1)}
          aria-label={t("scrollRight")}
          className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full border border-primary-200 bg-white/95 text-primary-800 shadow-md hover:bg-primary-50 print:hidden"
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      )}
    </div>
  );
}

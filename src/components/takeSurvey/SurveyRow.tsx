import React, { useEffect, useRef, useState } from "react";

const MIN_CARD = 260;
const GAP = 16;
/** How much of the next card shows when there are more than fit (a cut, faded card). */
const PEEK = 0.35;

/**
 * One horizontal row of cards. When everything fits, the cards fill the row. When there are more
 * cards than fit, the last visible card is cut and faded, and clicking it opens "See all".
 */
export function SurveyRow({ items, onSeeAll }: { items: React.ReactNode[]; onSeeAll: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fit = width > 0 ? Math.max(1, Math.floor((width + GAP) / (MIN_CARD + GAP))) : 3;
  const more = items.length > fit;
  const cardWidth =
    width > 0
      ? more
        ? (width - GAP * fit) / (fit + PEEK)
        : (width - GAP * (fit - 1)) / fit
      : undefined;
  const shown = more ? items.slice(0, fit + 1) : items;

  return (
    <div ref={ref} className="relative overflow-hidden">
      <div className="flex gap-4">
        {shown.map((item, i) => {
          const peek = more && i === fit;
          return (
            <div
              key={i}
              className={`shrink-0 flex ${peek ? "pointer-events-none select-none" : ""}`}
              style={{ width: cardWidth ?? `calc((100% - ${GAP * 2}px) / 3)` }}
              aria-hidden={peek || undefined}
              inert={peek || undefined}
            >
              <div className="w-full flex [&>*]:w-full">{item}</div>
            </div>
          );
        })}
      </div>
      {more && cardWidth !== undefined && (
        <button
          type="button"
          onClick={onSeeAll}
          className="absolute inset-y-0 right-0 bg-gradient-to-r from-transparent via-slate-50/80 to-slate-50 cursor-pointer"
          style={{ width: cardWidth * PEEK + GAP + 24 }}
          aria-label={`See all ${items.length}`}
          title="See all"
        />
      )}
    </div>
  );
}

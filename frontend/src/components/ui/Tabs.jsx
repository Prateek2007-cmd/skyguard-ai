import { useRef } from "react";

/**
 * Tabs — keyboard-operable tab strip (arrow keys move between tabs,
 * Home/End jump). Tabs are real <button role="tab"> elements with
 * aria-selected; panels carry role="tabpanel".
 *
 * items: [{id, label, count?}]
 */
export default function Tabs({ items, value, onChange, label, className = "" }) {
  const tabRefs = useRef([]);

  function handleKeyDown(event, index) {
    let next = null;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next !== null) {
      event.preventDefault();
      onChange(items[next].id);
      tabRefs.current[next]?.focus();
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex gap-1 overflow-x-auto border-b border-line ${className}`}
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={[
              "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-2 text-sm font-medium",
              "transition-colors duration-150",
              selected
                ? "border-instrument text-ink"
                : "border-transparent text-muted hover:border-line-strong hover:text-ink",
            ].join(" ")}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span className="tnum rounded-full bg-mist px-1.5 py-0.5 text-xs font-semibold leading-none text-ink-soft">
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

import { SCENARIOS } from "./scenarios";

/**
 * ScenarioPicker — the six fault scenarios as a real radiogroup, so the
 * choice is keyboard-operable and announced. Cards are <label>s bound to
 * visually-hidden radio inputs.
 */
export default function ScenarioPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Fault scenario" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {SCENARIOS.map((scenario) => {
        const Icon = scenario.icon;
        const selected = scenario.id === value;
        return (
          <label
            key={scenario.id}
            className={[
              "cursor-pointer rounded-xl border p-3",
              "transition-[border-color,background-color] duration-150",
              selected
                ? "border-vermilion bg-white shadow-[var(--shadow-whisper)]"
                : "border-line bg-white hover:border-line-strong",
            ].join(" ")}
          >
            <input
              type="radio"
              name="scenario"
              value={scenario.id}
              checked={selected}
              onChange={() => onChange(scenario.id)}
              className="sr-only"
            />
            <span className="flex items-start gap-2.5">
              <span
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  selected ? "bg-vermilion text-white" : "bg-mist text-ink-soft",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug text-ink">
                  {scenario.name}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">
                  {scenario.tagline}
                </span>
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

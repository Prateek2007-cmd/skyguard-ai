import { NavLink } from "react-router-dom";
import { Radar, X } from "lucide-react";
import { NAV_ITEMS } from "../../app/navigation";

export function SidebarContent({ onNavigate, onClose }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <NavLink
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg"
          aria-label="SkyGuard AI home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-white">
            <Radar className="h-5 w-5" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-[17px] font-semibold tracking-tight text-ink">
              SkyGuard AI
            </span>
            <span className="block text-xs text-muted">SIH26073 · MoES / IMD</span>
          </span>
        </NavLink>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-mist hover:text-ink lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      "transition-[background-color,color,box-shadow] duration-150",
                      isActive
                        ? "bg-vermilion-wash text-ink shadow-[inset_3px_0_0_var(--color-vermilion)]"
                        : "text-ink-soft hover:bg-ink/5 hover:text-ink",
                    ].join(" ")
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-vermilion-deep" : ""}`}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line px-5 py-4">
        <p className="text-xs leading-relaxed text-muted">
          Anomaly detection for automatic weather stations. Six virtual nodes
          on live Open-Meteo data.
        </p>
      </div>
    </div>
  );
}

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Desktop: fixed 264px frosted rail over the mesh band. */}
      <aside className="glass-strong fixed inset-y-0 left-0 z-30 hidden w-[264px] lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile: overlay drawer, slides in on the iOS drawer curve. */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="sg-scrim absolute inset-0 h-full w-full cursor-default bg-ink/40"
          />
          <aside className="glass-strong sg-drawer absolute inset-y-0 left-0 w-[280px] max-w-[85vw]">
            <SidebarContent onNavigate={onClose} onClose={onClose} />
          </aside>
        </div>
      ) : null}
    </>
  );
}

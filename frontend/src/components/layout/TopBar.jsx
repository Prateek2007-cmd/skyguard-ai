import { useLocation } from "react-router-dom";
import { Menu, RefreshCw } from "lucide-react";
import { useLive } from "../../app/live-context";
import { PAGE_TITLES } from "../../app/navigation";
import { relativeTime } from "../../utils/time";
import Badge from "../ui/Badge";

/**
 * TopBar — page title, live connection status (from /health + last poll
 * state) and a manual refresh. The status pill is honest: Live only when
 * the last poll succeeded; "Live feed down" when the backend is up but
 * Open-Meteo failed; "Backend offline" when nothing answers.
 */
export default function TopBar({ onMenuClick }) {
  const { connection, lastPollAt, lastSuccessAt, refresh, liveStatus } =
    useLive();
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || "SkyGuard AI";

  const tone =
    connection.state === "live"
      ? "healthy"
      : connection.state === "degraded"
        ? "alert"
        : connection.state === "offline"
          ? "alert"
          : "neutral";

  return (
    <header className="glass-strong sticky top-0 z-20">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-ink transition-colors hover:bg-ink/5 lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <p className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-ink sm:text-xl">
          {title}
        </p>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden text-[13px] text-muted md:block">
            {lastSuccessAt
              ? `Updated ${relativeTime(lastSuccessAt)}`
              : lastPollAt
                ? `Last poll ${relativeTime(lastPollAt)}`
                : "Connecting…"}
          </span>
          <Badge tone={tone}>{connection.label}</Badge>
          <button
            type="button"
            onClick={refresh}
            disabled={liveStatus === "loading"}
            aria-label="Refresh live data"
            className="rounded-lg border border-line-strong bg-white p-2 text-ink transition-[background-color,transform] duration-150 hover:bg-mist active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}

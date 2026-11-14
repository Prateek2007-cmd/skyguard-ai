import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MeshField from "../ui/MeshField";

/**
 * AppShell — collapsible sidebar (264px desktop, overlay drawer on mobile)
 * + top bar + full-width page content. Shared by every /app/* route.
 *
 * A fixed liquid-mesh band sits behind the top of every app page so the
 * glass shell and glass cards have something to refract. Route changes
 * crossfade the page content (sg-page, keyed by pathname).
 */
export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  // Lock body scroll while the mobile drawer is open, and close it on
  // Escape. The drawer closes via the sidebar links themselves (onNavigate)
  // or the scrim/close button.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[520px]"
      >
        <MeshField variant="page" />
      </div>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="relative z-10 lg:pl-[264px]">
        <TopBar onMenuClick={() => setDrawerOpen(true)} />
        <main id="main-content" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <div key={pathname} className="sg-page">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

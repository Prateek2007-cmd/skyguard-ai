import { Suspense, lazy } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Skeleton from "../components/ui/Skeleton";
import LandingPage from "../pages/LandingPage";
import NotFoundPage from "../pages/NotFoundPage";

// App pages load on demand so the landing page's first paint stays light.
const CommandCenterPage = lazy(() => import("../pages/CommandCenterPage"));
const AnomaliesPage = lazy(() => import("../pages/AnomaliesPage"));
const SimulationPage = lazy(() => import("../pages/SimulationPage"));
const HealthPage = lazy(() => import("../pages/HealthPage"));
const EvaluationPage = lazy(() => import("../pages/EvaluationPage"));
const ArchitecturePage = lazy(() => import("../pages/ArchitecturePage"));

function PageFallback() {
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function withSuspense(element) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

/**
 * Routes. Pages are registered as their phase lands — the sidebar only
 * links to routes that exist, so there are no dead links at any commit.
 *
 * The app is deployed under a sub-path (/skyguard-app/); the router must
 * strip that prefix before matching routes. BASE_URL follows Vite's --base,
 * so local dev ("/") keeps working unchanged.
 */
const basename = import.meta.env.BASE_URL.replace(/\/$/, "");
const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  {
    path: "/app",
    element: <AppShell />,
    children: [
      { index: true, element: withSuspense(<CommandCenterPage />) },
      { path: "anomalies", element: withSuspense(<AnomaliesPage />) },
      { path: "simulate", element: withSuspense(<SimulationPage />) },
      { path: "health", element: withSuspense(<HealthPage />) },
      { path: "evaluation", element: withSuspense(<EvaluationPage />) },
      { path: "architecture", element: withSuspense(<ArchitecturePage />) },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
], { basename });

export default function AppRouter() {
  return <RouterProvider router={router} />;
}

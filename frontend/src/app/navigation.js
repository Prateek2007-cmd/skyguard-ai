import {
  Activity,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  Network,
  TriangleAlert,
} from "lucide-react";

/** Sidebar navigation — every route exists, so every item is a live link. */
export const NAV_ITEMS = [
  { to: "/app", label: "Command Center", icon: LayoutDashboard, end: true },
  { to: "/app/anomalies", label: "Anomaly Intelligence", icon: TriangleAlert },
  { to: "/app/simulate", label: "Simulation Lab", icon: FlaskConical },
  { to: "/app/health", label: "Sensor Health", icon: HeartPulse },
  { to: "/app/evaluation", label: "Model Performance", icon: Activity },
  { to: "/app/architecture", label: "System Architecture", icon: Network },
];

export const PAGE_TITLES = {
  "/app": "Command Center",
  "/app/anomalies": "Anomaly Intelligence",
  "/app/simulate": "Simulation Lab",
  "/app/health": "Sensor Health",
  "/app/evaluation": "Model Performance",
  "/app/architecture": "System Architecture",
};

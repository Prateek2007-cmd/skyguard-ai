# SkyGuard AI — Frontend

React 19 + Vite dashboard for SkyGuard AI (SIH 2026, problem statement
SIH26073, MoES / IMD): anomaly detection and intelligent repair for
automatic weather stations.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000, /api proxied to the FastAPI backend
npm run build      # production build into dist/
npm run lint       # oxlint — must be 0 warnings
```

The backend must be running on `http://127.0.0.1:8000` (see the repo
README). In production, set `VITE_API_BASE_URL` to the backend origin +
`/api/v1`.

## Pages

| Route | Page | Data |
| --- | --- | --- |
| `/` | Landing — story, pipeline, live hero trace | `GET /stations/{id}/history` |
| `/app` | Command Center — map, stations, telemetry, activity | live poll + history + alerts |
| `/app/anomalies` | Anomaly Intelligence — alert record + detail | `GET /alerts`, `GET /alerts/{id}` |
| `/app/simulate` | Simulation Lab — inject faults through the real pipeline | `POST /simulate` |
| `/app/health` | Sensor Health — scores, freshness, maintenance priority | `GET /health/summary` |
| `/app/architecture` | System Architecture — the pipeline, stage by stage | `GET /evaluation` (live figures) |

## Architecture

- `src/app/` — router (route-level code splitting), `LiveProvider`
- `src/components/ui/` — Button, Card, Badge, MetricCard, EmptyState,
  ErrorState, Skeleton, Tabs, Toast, Eyebrow, PrimaryLink, MeshField
- `src/components/layout/` — AppShell, TopBar, Sidebar
- `src/components/dashboard/` — WeatherMap, StationCard, TelemetryChart,
  ActivityFeed, SignalStrip
- `src/components/anomalies/` — AlertList, AlertDetail
- `src/components/simulation/` — ScenarioPicker, SimulationResults
- `src/services/api.js` — the typed API client (see
  `docs/api-contract.md`, the source of truth for every call)
- `src/hooks/` — `useStationHistories`, `useAnimatedNumber`
- `src/utils/` — formatting, time, station geometry

**One polling loop.** `LiveProvider` is the only place that polls: every
30s it fetches `/health`, `/live-surrounding-stations` and `/alerts`
independently (allSettled, so a 502 on the live feed does not hide a
healthy backend). On repeated live-feed failure the interval backs off
30s → 60s → 120s and resets on success. No component polls on its own.

**Live vs stored data.** When the live feed is down (Open-Meteo
unreachable or rate-limited — the free tier is per egress IP), the
Command Center falls back to the latest *stored* observation per station
and says so everywhere: a banner, "stored data" labels, grey map markers.
Nothing is ever faked. Charts are fed by the history endpoint, so they
survive refresh; live polls are appended when the feed is up.

**Station geometry.** The six stations are virtual nodes in a 40 km ring
around Hyderabad (17.385, 78.4866). `utils/stations.js` replicates the
backend's ring formula exactly (verified against the Python), so the map
knows where stations sit even when the live endpoint is down. Live
coordinates, when available, take precedence.

## Design system

Light-first, no dark mode. Tokens live in `src/index.css` (`@theme`):
Ink `#101D2B`, Mist `#F1F5F4`, Instrument Blue `#267DA8`, Coral `#E87565`
(anomalies/alerts/destructive only), Healthy Green `#4A9D85`, Muted Slate
`#5B6B7F`. **Vermilion `#E4572E` is the loud 10%** (60/30/10): it appears
only on primary CTAs, the active nav indicator, selected states, one focal
number per view, the hero accent word, and section eyebrows. Small text
and button backgrounds use Vermilion Deep `#B93E19` (5.58:1 on white,
5.07:1 on mist); the bright vermilion is large text, fills and rings only
(3.68:1 on white). Inter for UI, Instrument Serif for the landing hero
headline only, ui-monospace for timestamps and IDs, tabular figures on
every changing number. Depth is borders-first (1px low-opacity borders,
whisper shadows only on overlays), with frosted glass on cards, shells
and overlays — never behind dense data. The signature element is the
telemetry trace — a thin ink instrument line with coral anomaly flags.

## Photography

Real photographs only, bundled under `src/assets/` (never hotlinked).
All three are from Pexels (free licence, no attribution required;
credited in the landing footer anyway):

| File | Subject | Pexels photo | Used in |
| --- | --- | --- | --- |
| `hero-mast.webp` | Automatic weather station mast (wind vane, anemometer, solar panel) | 15523101 | Landing hero |
| `storm-lightning.webp` | Lightning over open land at dusk | 34310687 | Landing problem section |
| `city-fog.webp` | City skyline above morning fog | 33678824 | Landing architecture section |

## Honesty rules (do not break these)

- The six stations are **virtual nodes on live Open-Meteo data**, not real
  IMD stations. The UI says so on the landing page, the sidebar and the
  architecture page.
- The LSTM was **trained on synthetic data**. Evaluation scores measure
  the checkers against synthetic faults, not field performance.
- Evidence scores are labelled **"Heuristic evidence score — not a model
  probability"**, everywhere they appear.
- Evaluation numbers are **fetched live** from `GET /evaluation`, never
  hardcoded — including the figures cited on the architecture page.
- Simulated observations are labelled **Simulated** and **Not persisted
  to live records**.
- Every data view has loading, empty and error states; every interactive
  element has hover, active, focus-visible and disabled states.

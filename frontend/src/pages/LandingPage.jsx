import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Radar } from "lucide-react";
import SignalStrip from "../components/dashboard/SignalStrip";
import Eyebrow from "../components/ui/Eyebrow";
import MeshField from "../components/ui/MeshField";
import PrimaryLink from "../components/ui/PrimaryLink";
import Skeleton from "../components/ui/Skeleton";
import heroMast from "../assets/hero-mast.webp";
import stormLightning from "../assets/storm-lightning.webp";
import cityFog from "../assets/city-fog.webp";
import { getStationHistory, normalizeApiError } from "../services/api";
import { CENTER_STATION_ID } from "../utils/stations";
import { formatDateRange } from "../utils/time";

/**
 * Landing page — standalone, no sidebar.
 *
 * Hero (headline + one sentence + CTAs + the real telemetry trace),
 * problem statement, How SkyGuard Works, features, architecture summary,
 * demo section, final CTA. The hero trace is drawn from REAL stored
 * history (Central AWS Node) when the backend is up — with honest
 * loading/empty/error states — never a hardcoded fake trace.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNav />
      <main>
        <Hero />
        <HonestyStrip />
        <ProblemSection />
        <HowItWorks />
        <Features />
        <ArchitectureSummary />
        <DemoSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}

function LandingNav() {
  return (
    <header className="glass-strong sticky top-0 z-20">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 rounded-lg" aria-label="SkyGuard AI home">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-white">
            <Radar className="h-5 w-5" aria-hidden />
          </span>
          <span className="whitespace-nowrap text-base font-semibold tracking-tight text-ink sm:text-[17px]">
            SkyGuard AI
          </span>
        </Link>
        <nav aria-label="Landing" className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/app/architecture"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-mist hover:text-ink sm:block"
          >
            Architecture
          </Link>
          <PrimaryLink to="/app" size="md">
            <span className="hidden sm:inline">Launch Command Center</span>
            <span className="sm:hidden">Launch</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </PrimaryLink>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <MeshField variant="hero" />
      <div className="relative mx-auto grid w-full max-w-[1200px] gap-10 px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-12 lg:gap-8">
        <div className="flex flex-col justify-center lg:col-span-7">
          <Eyebrow>Live anomaly detection</Eyebrow>
          <h1 className="mt-4 font-display text-[44px] leading-[1.08] tracking-tight text-ink sm:text-[56px]">
            Weather Intelligence. Without{" "}
            <span className="relative inline-block whitespace-nowrap text-vermilion">
              Blind Spots
              <svg
                aria-hidden
                className="absolute -bottom-1 left-0 h-[0.16em] w-full"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 9 C 50 3, 150 3, 198 8"
                  fill="none"
                  stroke="var(--color-vermilion)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            .
          </h1>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">
            SkyGuard watches automatic weather stations, catches faulty readings
            the moment they appear, and repairs them — so forecasts and warnings
            never rest on a broken sensor.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryLink to="/app" size="lg">
              Launch Command Center
              <ArrowRight className="h-4 w-4" aria-hidden />
            </PrimaryLink>
            <Link
              to="/app/architecture"
              className="glass glass-hover inline-flex h-12 items-center rounded-lg px-5 text-base font-medium text-ink"
            >
              Explore Architecture
            </Link>
          </div>
        </div>

        <div className="relative lg:col-span-5">
          <figure className="overflow-hidden rounded-2xl shadow-[var(--shadow-lift)]">
            <img
              src={heroMast}
              alt="An automatic weather station mast with a wind vane, anemometer and solar panel against a blue sky"
              className="aspect-[4/3] w-full object-cover object-top lg:aspect-[4/5] lg:max-h-[560px]"
              loading="eager"
            />
          </figure>
          <HeroTrace />
        </div>
      </div>
    </section>
  );
}

function HeroTrace() {
  const [state, setState] = useState({ status: "loading", points: [], error: null, meta: null });

  useEffect(() => {
    let active = true;
    getStationHistory(CENTER_STATION_ID, 120)
      .then((data) => {
        if (!active) return;
        const observations = data.observations || [];
        setState({
          status: observations.length ? "ready" : "empty",
          points: observations.map((o) => ({
            value: o.temperature,
            anomaly: o.has_anomaly,
          })),
          error: null,
          meta: observations.length
            ? {
                count: observations.length,
                from: observations[0].observed_at || observations[0].timestamp,
                to: observations[observations.length - 1].observed_at ||
                  observations[observations.length - 1].timestamp,
              }
            : null,
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({ status: "error", points: [], error: normalizeApiError(error), meta: null });
      });
    return () => {
      active = false;
    };
  }, []);

  // A single dot is not a trace: fewer than two points gets the
  // warming-up state, not a sparse chart with a lonely legend.
  const hasTrace = state.status === "ready" && state.points.length >= 2;
  const warmingUp =
    state.status === "empty" ||
    (state.status === "ready" && state.points.length < 2);

  return (
    <figure className="glass relative z-10 mt-4 rounded-2xl p-5 sm:p-6 lg:absolute lg:inset-x-6 lg:-bottom-6 lg:mt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption className="text-sm font-medium text-ink">
          Temperature trace · Central AWS Node
        </figcaption>
        {hasTrace && state.meta ? (
          <span className="tnum whitespace-nowrap font-mono text-xs text-muted">
            {state.meta.count} observations ·{" "}
            {formatDateRange(state.meta.from, state.meta.to)}
          </span>
        ) : null}
      </div>
      <div className="mt-4">
        {state.status === "loading" ? (
          <Skeleton className="h-[120px] w-full" />
        ) : hasTrace ? (
          <SignalStrip
            points={state.points}
            height={120}
            label={`Temperature trace for the Central AWS Node, ${state.meta.count} stored observations`}
          />
        ) : warmingUp ? (
          <div className="flex flex-col items-center px-2 py-5 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-instrument-wash text-instrument-deep">
              <Radar className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">Warming up</p>
            <p className="mt-1 max-w-[42ch] text-[13px] leading-relaxed text-muted">
              The trace appears once the backend has recorded a few
              observations — about a minute after the first poll.
            </p>
            <span
              aria-hidden
              className="mt-4 h-1.5 w-32 animate-pulse rounded-full bg-mist-deep"
            />
          </div>
        ) : (
          <p role="alert" className="py-10 text-center text-sm text-muted">
            The live trace is unavailable right now ({state.error?.message}).
            Stored history will appear here once the backend answers.
          </p>
        )}
      </div>
      {hasTrace ? (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-5 bg-ink" aria-hidden /> Temperature
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-coral" aria-hidden /> Flagged anomaly
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-instrument" aria-hidden /> Latest reading
          </span>
        </div>
      ) : null}
    </figure>
  );
}

function HonestyStrip() {
  return (
    <section className="border-y border-line bg-mist">
      <div className="mx-auto grid w-full max-w-[1200px] gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6">
        <p className="text-sm leading-relaxed text-ink-soft">
          <strong className="font-semibold text-ink">Virtual stations.</strong>{" "}
          The six stations are virtual nodes reading live Open-Meteo data in a
          40&nbsp;km ring around Hyderabad — not real IMD stations.
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          <strong className="font-semibold text-ink">Synthetic training.</strong>{" "}
          The LSTM was trained on synthetic data, not real AWS fault records.
          Evaluation scores measure the checkers against synthetic faults.
        </p>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="bg-white">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-muted">
          SkyGuard AI · Smart India Hackathon 2026 · Problem statement SIH26073
        </p>
        <p className="text-sm text-muted">
          Ministry of Earth Sciences / India Meteorological Department
        </p>
      </div>
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-8 sm:px-6">
        <p className="text-xs leading-relaxed text-muted">
          Photography:{" "}
          <a
            href="https://www.pexels.com"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-ink-soft underline decoration-line-strong underline-offset-2 hover:text-ink"
          >
            Pexels
          </a>{" "}
          — weather station mast, storm lightning, city in morning fog.
        </p>
      </div>
    </footer>
  );
}

function Section({ id, children, tone = "white" }) {
  return (
    <section
      id={id}
      className={tone === "mist" ? "border-y border-line bg-mist" : "bg-white"}
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 sm:py-20">
        {children}
      </div>
    </section>
  );
}

function SectionHeading({ title, description, eyebrow }) {
  return (
    <div className="max-w-[640px]">
      {eyebrow ? <Eyebrow className="mb-3">{eyebrow}</Eyebrow> : null}
      <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-base leading-relaxed text-muted">{description}</p>
      ) : null}
    </div>
  );
}

function ProblemSection() {
  return (
    <Section>
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-12">
        <div>
          <SectionHeading
            eyebrow="The problem"
            title="A broken sensor looks exactly like calm weather."
            description="Automatic weather stations feed forecasts, cyclone warnings and farm advisories. When a sensor sticks, drifts or drops out, the bad readings flow straight into those decisions — and nothing in the chain notices, because a frozen 31.4°C looks like a perfectly ordinary afternoon."
          />
          <div className="mt-10 flex flex-col gap-6">
            {[
              {
                title: "Forecasts inherit the fault",
                body: "Models cannot tell a stuck sensor from a stable sky. One bad station bends the local forecast until someone spots it by hand.",
              },
              {
                title: "Warnings arrive late — or wrong",
                body: "A drifting temperature sensor hides a heatwave's edge; a dead station hides a storm's landfall. The gap is measured in hours, not minutes.",
              },
              {
                title: "Nobody watches the watchers",
                body: "Networks grow faster than the teams maintaining them. Sensor health is checked on a schedule, not when it actually degrades.",
              },
            ].map((item) => (
              <div key={item.title} className="border-t-2 border-ink pt-4">
                <h3 className="text-base font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
        <figure className="lg:sticky lg:top-24">
          <img
            src={stormLightning}
            alt="Lightning striking over open land under a dark storm sky at dusk"
            className="aspect-[4/5] w-full rounded-2xl object-cover shadow-[var(--shadow-lift)]"
            loading="lazy"
          />
          <figcaption className="mt-3 text-[13px] leading-relaxed text-muted">
            A storm front moving over open land — the kind of weather a stuck
            sensor hides. Photograph: Pexels.
          </figcaption>
        </figure>
      </div>
    </Section>
  );
}

const PIPELINE_STEPS = [
  {
    name: "Weather Data",
    body: "Live readings from six virtual stations in a 40 km ring, fetched from Open-Meteo every 30 seconds.",
  },
  {
    name: "Validation",
    body: "Physical range checks on temperature, pressure and humidity, plus a flatline rule for stuck sensors.",
  },
  {
    name: "Anomaly Detection",
    body: "Rule results are combined into a verdict: good, suspect or faulty — with a reason, not just a flag.",
  },
  {
    name: "Spatial Verification",
    body: "Each reading is checked against its neighbours. A lone 55°C among normal stations is a sensor fault, not a heatwave.",
  },
  {
    name: "Intelligent Repair",
    body: "Flagged readings are repaired — spatial average first, LSTM inference next, physical clamp as a last resort — with the raw value kept alongside.",
  },
  {
    name: "Monitoring Dashboard",
    body: "Maps, telemetry, alerts, health scores and evaluation — the whole record, live, in the Command Center.",
  },
];

function HowItWorks() {
  return (
    <Section tone="mist">
      <SectionHeading
        eyebrow="How it works"
        title="How SkyGuard works"
        description="Six stages, one pass, every thirty seconds. Each stage explains itself — open any alert to see the rules, the spatial evidence and the repair."
      />
      <ol className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {PIPELINE_STEPS.map((step, i) => (
          <li key={step.name} className="flex gap-4">
            <span className="tnum flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-white text-[13px] font-semibold text-ink">
              {i + 1}
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-ink">{step.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Features() {
  const features = [
    {
      title: "Live station map",
      body: "All six stations on one map, fitted to the ring, with readings and status per marker.",
      to: "/app",
    },
    {
      title: "Anomaly intelligence",
      body: "Every flagged reading with severity, root cause, rule breakdown and before/after repair values.",
      to: "/app/anomalies",
    },
    {
      title: "Simulation Lab",
      body: "Inject spikes, frozen sensors, drift, dropouts and the official 55°C example through the real pipeline.",
      to: "/app/simulate",
    },
    {
      title: "Sensor health",
      body: "Per-station health scores and maintenance priority from the stored record — with the formula shown.",
      to: "/app/health",
    },
    {
      title: "Honest evaluation",
      body: "Precision, recall and confusion matrix computed live on a labelled synthetic set, limitations included.",
      to: "/app/evaluation",
    },
    {
      title: "Open architecture",
      body: "The full pipeline, stage by stage — including the drift gap and the synthetic LSTM training data.",
      to: "/app/architecture",
    },
  ];
  return (
    <Section>
      <SectionHeading
        eyebrow="Six views, one record"
        title="Everything a judge — or a maintainer — needs to see"
        description="Six views of the same record. No page is a mock: every number is fetched from the backend when you open it."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Link
            key={feature.title}
            to={feature.to}
            className="glass glass-hover group rounded-2xl p-5"
          >
            <h3 className="flex items-center justify-between gap-2 text-base font-semibold text-ink">
              {feature.title}
              <ArrowRight
                className="h-4 w-4 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink"
                aria-hidden
              />
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function ArchitectureSummary() {
  return (
    <Section tone="mist">
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="The architecture"
            title="Built like infrastructure, not a demo"
            description="Open-Meteo ingestion, virtual stations, a FastAPI backend, a rule engine, spatial KNN verification, an ONNX LSTM, a repair engine, SQLite storage and this React dashboard — nine stages, each doing one job."
          />
          <figure className="mt-10">
            <img
              src={cityFog}
              alt="A city skyline rising above a blanket of morning fog"
              className="aspect-[16/10] w-full rounded-2xl object-cover shadow-[var(--shadow-lift)]"
              loading="lazy"
            />
            <figcaption className="mt-3 text-[13px] leading-relaxed text-muted">
              A city under morning fog — the network SkyGuard watches over.
              Photograph: Pexels.
            </figcaption>
          </figure>
        </div>
        <div className="flex flex-col gap-3">
          <p className="glass rounded-xl px-4 py-3 text-sm leading-relaxed text-ink-soft">
            <strong className="font-semibold text-ink">Detection is layered.</strong>{" "}
            Range rules catch the impossible; the spatial check catches the
            implausible; the LSTM repairs what both flag.
          </p>
          <p className="glass rounded-xl px-4 py-3 text-sm leading-relaxed text-ink-soft">
            <strong className="font-semibold text-ink">Repair is ordered.</strong>{" "}
            Neighbour average first, model inference second, physical clamp
            last — and the raw value is always kept.
          </p>
          <p className="glass rounded-xl px-4 py-3 text-sm leading-relaxed text-ink-soft">
            <strong className="font-semibold text-ink">Limits are stated.</strong>{" "}
            Virtual stations, synthetic LSTM training, no drift detector yet —
            all documented on the architecture page.
          </p>
          <Link
            to="/app/architecture"
            className="glass glass-hover mt-1 inline-flex h-10 w-fit items-center gap-2 rounded-lg px-4 text-sm font-medium text-ink"
          >
            Explore Architecture
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </Section>
  );
}

function DemoSection() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Try it"
        title="Two ways to see it work"
        description="Live data shows the system watching; simulations show the system catching. They are kept strictly apart."
      />
      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-ink">Live observations</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Real Open-Meteo readings from the six virtual stations, polled
            every 30 seconds and stored with their QC flags. Anomalies are
            rare in live weather — most of the time the dashboard shows a
            healthy network, and that is the honest answer.
          </p>
          <PrimaryLink to="/app" size="md" className="mt-4">
            Open Command Center
            <ArrowRight className="h-4 w-4" aria-hidden />
          </PrimaryLink>
        </div>
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-ink">Controlled simulations</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Inject a spike, a frozen sensor, drift, a dropout or the official
            55°C example and watch the same pipeline judge it — rules,
            spatial evidence, LSTM, repair — step by step. Every simulated
            observation is labelled Simulated and is never persisted to live
            records.
          </p>
          <Link
            to="/app/simulate"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-mist"
          >
            Open Simulation Lab
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-line bg-mist">
      <MeshField variant="band" />
      <div className="relative mx-auto flex w-full max-w-[1200px] flex-col items-start gap-6 px-4 py-16 sm:px-6">
        <h2 className="max-w-[640px] font-display text-[36px] leading-[1.1] tracking-tight text-ink sm:text-[48px]">
          See the network the way SkyGuard sees it.
        </h2>
        <p className="max-w-[56ch] text-base leading-relaxed text-muted">
          Live stations, real alerts, honest scores — open the Command Center
          and start with the map.
        </p>
        <PrimaryLink to="/app" size="lg">
          Launch Command Center
          <ArrowRight className="h-4 w-4" aria-hidden />
        </PrimaryLink>
      </div>
    </section>
  );
}

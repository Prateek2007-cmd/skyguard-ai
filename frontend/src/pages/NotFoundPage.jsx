import { Link } from "react-router-dom";
import { Radar } from "lucide-react";
import Eyebrow from "../components/ui/Eyebrow";
import PrimaryLink from "../components/ui/PrimaryLink";

/** 404 — plain, with a way back. */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-white">
        <Radar className="h-6 w-6" aria-hidden />
      </span>
      <Eyebrow className="mt-6 justify-center">Page not found</Eyebrow>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-muted">
        The link may be wrong, or the page may have moved. The Command Center
        is the best place to start.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <PrimaryLink to="/app" size="md">
          Open Command Center
        </PrimaryLink>
        <Link
          to="/"
          className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-mist"
        >
          Back to the landing page
        </Link>
      </div>
    </div>
  );
}

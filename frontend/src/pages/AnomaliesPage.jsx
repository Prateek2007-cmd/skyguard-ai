import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Eyebrow from "../components/ui/Eyebrow";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import Skeleton from "../components/ui/Skeleton";
import AlertList from "../components/anomalies/AlertList";
import AlertDetail from "../components/anomalies/AlertDetail";
import { getAlertDetail, getAlerts, normalizeApiError } from "../services/api";
import { KNOWN_STATIONS } from "../utils/stations";

const PAGE_SIZE = 50;

/**
 * Anomaly Intelligence — the alert record with severity + station filters
 * and a full detail panel per alert. `?alert=<id>` preselects an alert
 * (used by the Command Center activity feed).
 */
export default function AnomaliesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [severity, setSeverity] = useState("");
  const [stationId, setStationId] = useState("");
  const [listState, setListState] = useState({
    status: "loading",
    alerts: [],
    total: 0,
    error: null,
  });
  const [selectedId, setSelectedId] = useState(
    () => searchParams.get("alert") || null,
  );
  const [detailState, setDetailState] = useState({
    status: "idle", // idle | loading | ready | error
    detail: null,
    error: null,
  });

  const fetchList = useCallback(async (sev, stn) => {
    setListState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const data = await getAlerts({
        severity: sev || undefined,
        stationId: stn || undefined,
        limit: PAGE_SIZE,
      });
      setListState({
        status: "ready",
        alerts: data.alerts || [],
        total: data.total || 0,
        error: null,
      });
      return data.alerts || [];
    } catch (error) {
      setListState((s) => ({
        ...s,
        status: "error",
        error: normalizeApiError(error),
      }));
      return null;
    }
  }, []);

  // Refetch the list when a filter changes; keep the selection if it is
  // still in the filtered list, else select the first alert.
  useEffect(() => {
    let active = true;
    // Data-fetching effect: refetching the alert list when a filter changes.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    fetchList(severity, stationId).then((alerts) => {
      if (!active || !alerts) return;
      setSelectedId((current) => {
        if (current && alerts.some((a) => a.id === current)) return current;
        return alerts[0]?.id || null;
      });
    });
    return () => {
      active = false;
    };
  }, [fetchList, severity, stationId]);

  // Fetch the detail for the selected alert. When nothing is selected the
  // panel derives its empty state from selectedId (see render), so no
  // state reset is needed here.
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    setDetailState({ status: "loading", detail: null, error: null });
    getAlertDetail(selectedId)
      .then((detail) => {
        if (!active) return;
        setDetailState({ status: "ready", detail, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setDetailState({
          status: "error",
          detail: null,
          error: normalizeApiError(error),
        });
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  function handleSelect(id) {
    setSelectedId(id);
    setSearchParams(id ? { alert: id } : {}, { replace: true });
  }

  function handleRetryDetail() {
    if (!selectedId) return;
    setDetailState({ status: "loading", detail: null, error: null });
    getAlertDetail(selectedId)
      .then((detail) =>
        setDetailState({ status: "ready", detail, error: null }),
      )
      .catch((error) =>
        setDetailState({
          status: "error",
          detail: null,
          error: normalizeApiError(error),
        }),
      );
  }

  const hasActiveFilter = Boolean(severity || stationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow className="mb-2">Alert record</Eyebrow>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Anomaly Intelligence
        </h1>
        <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted">
          Every reading the pipeline flagged, newest first — with what was
          detected, why it looked suspicious, and how it was repaired.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="filter-severity"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Severity
          </label>
          <select
            id="filter-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="h-10 rounded-lg border border-line-strong bg-white px-3 text-sm font-medium text-ink"
          >
            <option value="">All severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="filter-station"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Station
          </label>
          <select
            id="filter-station"
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            className="h-10 rounded-lg border border-line-strong bg-white px-3 text-sm font-medium text-ink"
          >
            <option value="">All stations</option>
            {KNOWN_STATIONS.map((s) => (
              <option key={s.station_id} value={s.station_id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {hasActiveFilter ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSeverity("");
              setStationId("");
            }}
          >
            Clear filters
          </Button>
        ) : null}
        <p className="tnum pb-2 text-[13px] text-muted">
          {listState.status === "ready" ? (
            <>
              <span className="text-base font-semibold text-vermilion-deep">
                {listState.total}
              </span>{" "}
              alert{listState.total === 1 ? "" : "s"} in the record
            </>
          ) : (
            ""
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-2" padding="p-0">
          {listState.status === "loading" ? (
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : listState.status === "error" ? (
            <ErrorState
              title="Could not load alerts"
              message={listState.error?.message}
              onRetry={() => fetchList(severity, stationId)}
            />
          ) : listState.alerts.length === 0 ? (
            <EmptyState
              icon={TriangleAlert}
              title={
                hasActiveFilter ? "No alerts match these filters" : "No alerts yet"
              }
              description={
                hasActiveFilter
                  ? "Try a different severity or station — or clear the filters to see the full record."
                  : "No readings have been flagged. When the pipeline catches a faulty sensor, it appears here."
              }
              actionLabel={hasActiveFilter ? "Clear filters" : undefined}
              onAction={
                hasActiveFilter
                  ? () => {
                      setSeverity("");
                      setStationId("");
                    }
                  : undefined
              }
            />
          ) : (
            <AlertList
              alerts={listState.alerts}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          )}
        </Card>

        <div className="min-w-0 lg:col-span-3">
          <AlertDetail
            detail={selectedId ? detailState.detail : null}
            status={selectedId ? detailState.status : "idle"}
            error={detailState.error}
            onRetry={handleRetryDetail}
          />
        </div>
      </div>
    </div>
  );
}

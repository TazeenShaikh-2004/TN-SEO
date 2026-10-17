import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { PILL, VIEW_ALL } from "../data/ui.js";
import { formatCompact } from "../data/compute.js";
import {
  DEFAULT_DATE_RANGE,
  DEFAULT_PERIOD,
  DELTA_LABEL,
  DASHBOARD_HEADER,
  INSIGHTS,
  KEYWORD_RANKINGS,
  KPIS,
  PERIODS,
  TOP_PAGES,
  TRAFFIC_TREND,
  UPGRADE_CTA,
} from "../data/dashboard.js";
import { ALERTS } from "../data/site.js";
import auditService from "../services/auditService";

function formatAuditDate(date) {
  if (!date) return "Not available";

  const parsed = new Date(date);

  return Number.isNaN(parsed.getTime())
    ? "Not available"
    : parsed.toLocaleString();
}

function getScoreStyle(score) {
  if (score >= 80) {
    return {
      text: "text-emerald-700",
      ring: "text-emerald-500",
      label: "Good",
      bg: "bg-emerald-50",
    };
  }

  if (score >= 50) {
    return {
      text: "text-amber-700",
      ring: "text-amber-500",
      label: "Needs improvement",
      bg: "bg-amber-50",
    };
  }

  return {
    text: "text-red-700",
    ring: "text-red-500",
    label: "Needs attention",
    bg: "bg-red-50",
  };
}

function getCheckStyle(status) {
  if (status === "passed") {
    return {
      label: "Passed",
      badge: "bg-emerald-50 text-emerald-700",
      icon: "text-emerald-600",
      symbol: "✓",
    };
  }

  if (status === "warning") {
    return {
      label: "Warning",
      badge: "bg-amber-50 text-amber-700",
      icon: "text-amber-600",
      symbol: "!",
    };
  }

  return {
    label: "Failed",
    badge: "bg-red-50 text-red-700",
    icon: "text-red-600",
    symbol: "!",
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [dateRange, setDateRange] = useState(DEFAULT_DATE_RANGE);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);

  const [audit, setAudit] = useState(null);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditMessage, setAuditMessage] = useState("");
  const [showAllChecks, setShowAllChecks] = useState(false);

  const pickDateRange = () => {
    const selected = prompt("Enter date range:", dateRange);

    if (selected && selected.trim()) {
      setDateRange(selected.trim());
    }
  };

  const pickPeriod = () => {
    const selected = prompt(
      "Choose period:\n\n" +
        PERIODS.map((item, index) => `${index + 1}. ${item}`).join("\n"),
      String(PERIODS.indexOf(period) + 1),
    );

    const index = parseInt(selected, 10) - 1;

    if (!Number.isNaN(index) && PERIODS[index]) {
      setPeriod(PERIODS[index]);
    }
  };

  // Load the latest real audit for the selected project.
  const loadLatestAudit = useCallback(async () => {
    if (!projectId) {
      setAudit(null);
      setAuditLoading(false);
      setAuditError("");
      return;
    }

    setAuditLoading(true);
    setAuditError("");
    setAuditMessage("");

    try {
      const result = await auditService.getLatestAudit(projectId);
      setAudit(result.audit ?? null);
    } catch (error) {
      if (error.status === 404) {
        setAudit(null);
      } else {
        setAuditError(error.message || "Unable to load the latest SEO audit.");
        setAudit(null);
      }
    } finally {
      setAuditLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadLatestAudit();
  }, [loadLatestAudit]);

  // Run a new audit using the backend.
  const handleRunAudit = async () => {
    if (!projectId || auditRunning) return;

    setAuditRunning(true);
    setAuditError("");
    setAuditMessage("");

    try {
      const result = await auditService.runAudit(projectId);

      setAudit(result.audit ?? null);
      setAuditMessage(result.message || "SEO audit completed successfully.");
      setShowAllChecks(false);
    } catch (error) {
      setAuditError(error.message || "Unable to run the SEO audit.");

      // A failed audit is also saved by the backend.
      // Reload it so the latest status can be displayed.
      try {
        const latest = await auditService.getLatestAudit(projectId);
        setAudit(latest.audit ?? null);
      } catch (loadError) {
        if (loadError.status === 404) {
          setAudit(null);
        }
      }
    } finally {
      setAuditRunning(false);
    }
  };

  const score = Number(audit?.seoScore ?? 0);
  const scoreStyle = getScoreStyle(score);
  const checks = audit?.checks ?? [];

  const failedCount = checks.filter(
    (check) => check.status === "failed",
  ).length;

  const warningCount = checks.filter(
    (check) => check.status === "warning",
  ).length;

  const passedCount = checks.filter(
    (check) => check.status === "passed",
  ).length;

  const visibleChecks = showAllChecks ? checks : checks.slice(0, 5);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2 [scrollbar-width:thin]">
      {/* PAGE HEADING */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold leading-7">
            {DASHBOARD_HEADER.title}
          </h1>
          <p className="text-xs text-muted">{DASHBOARD_HEADER.subtitle}</p>
        </div>

        <button
          onClick={pickDateRange}
          className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3.5 text-xs font-medium text-gray-700 transition hover:border-primary/50"
        >
          <CalendarDays className="h-4 w-4 text-primary" />
          {dateRange}
          <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
        </button>
      </div>

      {/* REAL SEO AUDIT */}
      <section className="shrink-0 overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>

            <div>
              <h2 className="text-sm font-bold">Website SEO Audit</h2>
              <p className="mt-0.5 text-xs text-muted">
                Real on-page SEO checks from your saved project
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunAudit}
            disabled={!projectId || auditRunning || auditLoading}
            className="flex h-9 items-center justify-center gap-2 rounded-lg bg-primary-dark px-4 text-xs font-semibold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${auditRunning ? "animate-spin" : ""}`}
            />
            {auditRunning ? "Running audit..." : "Run Audit"}
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {!projectId ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center">
              <ShieldCheck className="mb-3 h-9 w-9 text-gray-300" />
              <h3 className="text-sm font-semibold">
                Select a project to get started
              </h3>
              <p className="mt-1 max-w-md text-xs leading-5 text-muted">
                Open one of your saved projects to run an SEO audit and view its
                real results here.
              </p>
              <button
                type="button"
                onClick={() => navigate("/projects")}
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-dark"
              >
                Go to Projects
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : auditLoading ? (
            <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-muted">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              Loading audit results...
            </div>
          ) : (
            <>
              {auditError && (
                <div
                  role="alert"
                  className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700"
                >
                  {auditError}
                </div>
              )}

              {auditMessage && !auditError && (
                <div
                  role="status"
                  className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700"
                >
                  {auditMessage}
                </div>
              )}

              {!audit ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center">
                  <Clock3 className="mb-3 h-8 w-8 text-gray-300" />
                  <h3 className="text-sm font-semibold">
                    No audit results yet
                  </h3>
                  <p className="mt-1 max-w-md text-xs leading-5 text-muted">
                    Run your first audit to check the website title, meta
                    description, headings, images, and other on-page SEO
                    signals.
                  </p>
                </div>
              ) : (
                <>
                  {/* SCORE AND SUMMARY */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <div className="flex items-center gap-4 rounded-xl border border-gray-100 p-4">
                      <div
                        className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: `conic-gradient(#0bb568 ${
                            Math.min(100, Math.max(0, score)) * 3.6
                          }deg, #e4ecec 0deg)`,
                        }}
                      >
                        <div className="flex h-[68px] w-[68px] flex-col items-center justify-center rounded-full bg-white">
                          <strong
                            className={`text-xl leading-6 ${scoreStyle.text}`}
                          >
                            {score}
                          </strong>
                          <span className="text-[10px] text-muted">
                            out of 100
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-muted">Overall SEO score</p>
                        <p
                          className={`mt-1 text-sm font-bold ${scoreStyle.text}`}
                        >
                          {scoreStyle.label}
                        </p>
                        <span className="mt-2 inline-flex rounded-md bg-gray-100 px-2 py-1 text-[10px] font-medium capitalize text-gray-600">
                          {audit.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-gray-100 p-4">
                        <p className="text-xs text-muted">Passed</p>
                        <p className="mt-2 text-2xl font-bold text-emerald-600">
                          {passedCount}
                        </p>
                        <p className="mt-1 text-[11px] text-muted">
                          Checks passed
                        </p>
                      </div>

                      <div className="rounded-xl border border-gray-100 p-4">
                        <p className="text-xs text-muted">Warnings</p>
                        <p className="mt-2 text-2xl font-bold text-amber-600">
                          {warningCount}
                        </p>
                        <p className="mt-1 text-[11px] text-muted">
                          Need review
                        </p>
                      </div>

                      <div className="rounded-xl border border-gray-100 p-4">
                        <p className="text-xs text-muted">Failed</p>
                        <p className="mt-2 text-2xl font-bold text-red-600">
                          {failedCount}
                        </p>
                        <p className="mt-1 text-[11px] text-muted">
                          Issues found
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* AUDIT DETAILS */}
                  <div className="mt-4 grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-3 text-xs sm:grid-cols-2">
                    <div className="min-w-0">
                      <span className="text-muted">Website</span>
                      <p className="mt-1 break-all font-medium text-gray-700">
                        {audit.websiteUrl}
                      </p>
                    </div>

                    <div>
                      <span className="text-muted">Last audited</span>
                      <p className="mt-1 font-medium text-gray-700">
                        {formatAuditDate(audit.completedAt || audit.createdAt)}
                      </p>
                    </div>

                    <div>
                      <span className="text-muted">Pages analyzed</span>
                      <p className="mt-1 font-medium text-gray-700">
                        {audit.pagesCrawled ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* REAL SEO CHECKS */}
                  <div className="mt-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">
                          SEO Check Results
                        </h3>
                        <p className="mt-0.5 text-[11px] text-muted">
                          Findings from the latest audit
                        </p>
                      </div>

                      <span className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600">
                        {checks.length} checks
                      </span>
                    </div>

                    {checks.length === 0 ? (
                      <p className="rounded-lg bg-gray-50 p-4 text-xs text-muted">
                        No checks are available for this audit.
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                        {visibleChecks.map((check, index) => {
                          const style = getCheckStyle(check.status);

                          return (
                            <div
                              key={`${check.name}-${index}`}
                              className="flex items-start justify-between gap-3 p-3 transition hover:bg-gray-50/70"
                            >
                              <div className="flex min-w-0 items-start gap-3">
                                <span
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-50 text-sm font-bold ${style.icon}`}
                                >
                                  {style.symbol}
                                </span>

                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-gray-800">
                                    {check.name}
                                  </p>
                                  <p className="mt-1 break-words text-xs leading-5 text-muted">
                                    {check.message}
                                  </p>
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-col items-end gap-2">
                                <span
                                  className={`rounded-md px-2 py-1 text-[10px] font-semibold ${style.badge}`}
                                >
                                  {style.label}
                                </span>
                                <span className="text-[10px] text-muted">
                                  {check.points ?? 0}/{check.maxPoints ?? 0}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {checks.length > 5 && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowAllChecks((previous) => !previous)
                        }
                        className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark"
                      >
                        {showAllChecks
                          ? "Show fewer checks"
                          : `View all ${checks.length} checks`}
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition ${
                            showAllChecks ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      {/* KPI CARDS — existing mock data for now */}
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((kpi) => (
          <button
            key={kpi.id}
            onClick={() => console.log(`Selected metric: ${kpi.title}`)}
            className="flex items-start justify-between gap-3 rounded-xl border border-line bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{kpi.title}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <strong className="text-2xl leading-7">{kpi.value}</strong>
                {kpi.unit && (
                  <small className="text-xs text-muted">{kpi.unit}</small>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary">
                {kpi.deltaDir === "up" ? "↑" : "↓"} {kpi.delta}
                <span className="text-[11px] font-normal text-muted">
                  {DELTA_LABEL}
                </span>
              </div>
              <small className="mt-1 block text-[11px] text-gray-400">
                {kpi.sub}
              </small>
            </div>

            {kpi.viz.type === "ring" ? (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#0bb568 0deg ${
                    kpi.viz.value * 3.6
                  }deg, #e4ecec ${kpi.viz.value * 3.6}deg 360deg)`,
                }}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold">
                  {kpi.viz.value}
                </div>
              </div>
            ) : (
              <svg viewBox="0 0 100 50" className="h-12 w-20 shrink-0 self-end">
                <polyline
                  fill="none"
                  stroke={kpi.viz.color}
                  strokeWidth="2.5"
                  points={kpi.viz.points.map(([x, y]) => `${x},${y}`).join(" ")}
                />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* TRAFFIC + AI INSIGHTS — existing data sources */}
      <div className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-[1.9fr_1.15fr]">
        {/* TRAFFIC TREND */}
        <div className="flex flex-col rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Organic Traffic Trend</h2>
            <button
              onClick={pickPeriod}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-700 hover:border-primary/50"
            >
              {period}
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-3 flex min-h-[150px] flex-1 gap-3">
            <div className="flex w-9 flex-col justify-between pb-6 text-[10px] text-gray-400">
              {TRAFFIC_TREND.yLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="relative min-h-0 flex-1">
              <div className="absolute left-0 top-0 w-full border-t border-dashed border-gray-200" />
              <div className="absolute left-0 top-1/3 w-full border-t border-dashed border-gray-200" />
              <div className="absolute left-0 top-2/3 w-full border-t border-dashed border-gray-200" />
              <div className="absolute bottom-2 left-0 w-full border-t border-dashed border-gray-200" />

              <svg
                className="h-full max-h-[160px] w-full overflow-visible"
                viewBox={`0 0 ${TRAFFIC_TREND.width} ${TRAFFIC_TREND.height}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient
                    id="trafficGradient"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={TRAFFIC_TREND.fill}
                      stopOpacity=".28"
                    />
                    <stop
                      offset="100%"
                      stopColor={TRAFFIC_TREND.fill}
                      stopOpacity=".03"
                    />
                  </linearGradient>
                </defs>

                <path
                  fill="url(#trafficGradient)"
                  d={
                    `M${TRAFFIC_TREND.points
                      .map(([x, y]) => `${x} ${y}`)
                      .join(" L")} ` +
                    `L${TRAFFIC_TREND.width} ${
                      TRAFFIC_TREND.points.at(-1)[1]
                    } ` +
                    `L${TRAFFIC_TREND.width} ${TRAFFIC_TREND.height} L0 ${TRAFFIC_TREND.height} Z`
                  }
                />

                <polyline
                  fill="none"
                  stroke={TRAFFIC_TREND.stroke}
                  strokeWidth="2.3"
                  points={TRAFFIC_TREND.points
                    .map(([x, y]) => `${x},${y}`)
                    .join(" ")}
                />

                {TRAFFIC_TREND.points.map(([x, y], index, all) => (
                  <circle
                    key={`${x}-${y}`}
                    cx={x}
                    cy={y}
                    r={index === all.length - 1 ? 4.5 : 3.5}
                    fill={TRAFFIC_TREND.dot}
                  />
                ))}
              </svg>

              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-gray-400">
                {TRAFFIC_TREND.xLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI INSIGHTS */}
        <div className="flex flex-col rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex min-h-[30px] items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold">AI Insights</h2>
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-[9px] text-muted">
                i
              </span>
            </div>

            <button onClick={() => alert(ALERTS.viewAll)} className={VIEW_ALL}>
              View All <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 flex flex-1 flex-col justify-between rounded-lg bg-[#effcf7] p-3">
            {INSIGHTS.map((insight) => (
              <div
                className="mb-2.5 flex items-start gap-2.5 text-[13px] leading-5 last:mb-0"
                key={insight.text}
              >
                <span
                  className={
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] " +
                    (insight.done
                      ? "bg-primary text-white"
                      : "border-2 border-[#0caf6a] text-transparent")
                  }
                >
                  ✓
                </span>
                <span>{insight.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM GRID */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-3">
        {/* TOP PAGES */}
        <div className="flex min-h-0 flex-col rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="whitespace-nowrap text-sm font-semibold">
              Top Performing Pages
            </h2>
            <button onClick={() => alert(ALERTS.viewAll)} className={VIEW_ALL}>
              View All <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
            <table className="h-full w-full border-collapse">
              <thead>
                <tr>
                  <th className="whitespace-nowrap bg-gray-50 px-2 py-1.5 text-left text-[11px] font-medium text-muted">
                    Page
                  </th>
                  <th className="whitespace-nowrap bg-gray-50 px-2 py-1.5 text-left text-[11px] font-medium text-muted">
                    Traffic
                  </th>
                  <th className="whitespace-nowrap bg-gray-50 px-2 py-1.5 text-left text-[11px] font-medium text-muted">
                    Kw
                  </th>
                  <th className="whitespace-nowrap bg-gray-50 px-2 py-1.5 text-left text-[11px] font-medium text-muted" />
                </tr>
              </thead>
              <tbody>
                {TOP_PAGES.map((row) => (
                  <tr key={row.page} className="hover:bg-gray-50/60">
                    <td className="max-w-[110px] truncate border-t border-gray-100 px-2 py-1.5 text-[13px] text-gray-700">
                      {row.page}
                    </td>
                    <td className="whitespace-nowrap border-t border-gray-100 px-2 py-1.5 text-[13px] text-gray-700">
                      {formatCompact(row.traffic)}
                    </td>
                    <td className="whitespace-nowrap border-t border-gray-100 px-2 py-1.5 text-[13px] text-gray-700">
                      {row.keywords}
                    </td>
                    <td className="border-t border-gray-100 px-2 py-1 text-right text-muted">
                      <ArrowUpRight className="inline h-3.5 w-3.5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* KEYWORD RANKINGS */}
        <div className="flex min-h-0 flex-col rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="whitespace-nowrap text-sm font-semibold">
              Keyword Rankings
            </h2>
            <button onClick={() => alert(ALERTS.viewAll)} className={VIEW_ALL}>
              View All <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
            <table className="h-full w-full border-collapse">
              <thead>
                <tr>
                  <th className="whitespace-nowrap bg-gray-50 px-2 py-1.5 text-left text-[11px] font-medium text-muted">
                    Keyword
                  </th>
                  <th className="whitespace-nowrap bg-gray-50 px-2 py-1.5 text-left text-[11px] font-medium text-muted">
                    Pos
                  </th>
                  <th className="whitespace-nowrap bg-gray-50 px-2 py-1.5 text-left text-[11px] font-medium text-muted">
                    Chg
                  </th>
                </tr>
              </thead>
              <tbody>
                {KEYWORD_RANKINGS.map((row) => (
                  <tr key={row.keyword} className="hover:bg-gray-50/60">
                    <td className="max-w-[110px] truncate border-t border-gray-100 px-2 py-1.5 text-[13px] text-gray-700">
                      {row.keyword}
                    </td>
                    <td className="whitespace-nowrap border-t border-gray-100 px-2 py-1.5 text-[13px] text-gray-700">
                      {row.position}
                    </td>
                    <td className="border-t border-gray-100 px-2 py-1">
                      {row.change ? (
                        <span
                          className={
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium " +
                            (row.change.dir === "up" ? PILL.good : PILL.bad)
                          }
                        >
                          {row.change.dir === "up" ? "↑" : "↓"}{" "}
                          {row.change.value}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SEO ISSUES — REAL AUDIT DATA */}
        <div className="flex min-h-0 flex-col rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="whitespace-nowrap text-sm font-semibold">
              SEO Issues
            </h2>

            {audit?.status === "completed" && (
              <span className="text-[11px] text-muted">
                {failedCount + warningCount} found
              </span>
            )}
          </div>

          <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto">
            {!projectId ? (
              <p className="py-6 text-center text-xs leading-5 text-muted">
                Select a project to see its SEO issues.
              </p>
            ) : auditLoading ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Loading SEO issues...
              </div>
            ) : audit?.status !== "completed" ? (
              <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
                <ShieldCheck className="mb-2 h-7 w-7 text-gray-300" />
                <p className="text-xs font-medium text-gray-700">
                  No completed audit
                </p>
                <p className="mt-1 text-[11px] leading-5 text-muted">
                  Run an audit to find real on-page SEO issues.
                </p>
              </div>
            ) : failedCount + warningCount === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
                <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-lg text-emerald-600">
                  ✓
                </span>
                <p className="text-xs font-semibold text-gray-700">
                  No issues found
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  All current checks passed.
                </p>
              </div>
            ) : (
              checks
                .filter(
                  (check) =>
                    check.status === "failed" || check.status === "warning",
                )
                .slice(0, 8)
                .map((issue, index) => {
                  const style = getCheckStyle(issue.status);

                  return (
                    <div
                      key={`${issue.name}-${index}`}
                      className="flex items-center gap-2.5 border-b border-gray-100 px-1 py-2.5 last:border-b-0"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${style.badge}`}
                      >
                        {style.symbol}
                      </span>

                      <span className="flex min-w-0 flex-1 flex-col">
                        <strong className="truncate text-[13px]">
                          {issue.name}
                        </strong>
                        <span className="truncate text-xs text-muted">
                          {issue.message}
                        </span>
                      </span>

                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${style.badge}`}
                      >
                        {style.label}
                      </span>
                    </div>
                  );
                })
            )}

            {audit?.status === "completed" &&
              failedCount + warningCount > 8 && (
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("seo-audit-results")
                      ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                  }
                  className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark"
                >
                  View all issues
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
          </div>
        </div>
      </div>

      {/* BOTTOM CTA */}
      <div className="relative shrink-0 overflow-hidden rounded-xl border border-line bg-[radial-gradient(120%_160%_at_85%_0%,#d8f8e9_0%,#f2fbf7_45%,#ffffff_100%)] p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-primary/10" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold">{UPGRADE_CTA.title}</h2>
              <p className="mt-0.5 text-xs text-muted">{UPGRADE_CTA.text}</p>
            </div>
          </div>

          <button
            onClick={() => navigate("/upgrade")}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary-dark px-4 text-xs font-semibold text-white transition hover:bg-primary"
          >
            {UPGRADE_CTA.button}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

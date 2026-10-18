import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { PILL, VIEW_ALL } from "../data/ui.js";
import { formatCompact } from "../data/compute.js";
import {
  DEFAULT_DATE_RANGE,
  DEFAULT_PERIOD,
  DELTA_LABEL,
  DASHBOARD_HEADER,
  PERIODS,
  UPGRADE_CTA,
} from "../data/dashboard.js";
import { ALERTS } from "../data/site.js";
import { apiRequest } from "../services/api.js";
import { auditService } from "../services/auditService.js";

const ACTIVE_PROJECT_KEY = "tn-seo-active-project-id";

function getErrorMessage(error) {
  if (error?.status === 401) {
    return "Your session has expired. Please log in again.";
  }

  return error?.message || "Something went wrong. Please try again.";
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getCheckCounts(checks = []) {
  return checks.reduce(
    (counts, check) => {
      if (check.status === "passed") counts.passed += 1;
      else if (check.status === "warning") counts.warning += 1;
      else if (check.status === "failed") counts.failed += 1;

      return counts;
    },
    { passed: 0, warning: 0, failed: 0 },
  );
}

function getCheckTone(status) {
  if (status === "passed") return "good";
  if (status === "warning") return "warn";
  return "bad";
}

function getCheckLabel(status) {
  if (status === "passed") return "Passed";
  if (status === "warning") return "Warning";
  return "Failed";
}

function getAuditInsights(checks = []) {
  const failed = checks.filter((check) => check.status === "failed");
  const warnings = checks.filter((check) => check.status === "warning");
  const passed = checks.filter((check) => check.status === "passed");

  const insights = [];

  if (failed.length > 0) {
    insights.push({
      text: `${failed.length} SEO check${failed.length === 1 ? "" : "s"} need attention. Start with: ${failed[0].name}.`,
      done: false,
    });
  }

  if (warnings.length > 0) {
    insights.push({
      text: `${warnings.length} check${warnings.length === 1 ? "" : "s"} could be improved.`,
      done: false,
    });
  }

  if (passed.length > 0) {
    insights.push({
      text: `${passed.length} SEO check${passed.length === 1 ? "" : "s"} passed successfully.`,
      done: true,
    });
  }

  if (insights.length === 0) {
    insights.push({
      text: "Run an audit to get recommendations based on your website.",
      done: false,
    });
  }

  return insights;
}

function EmptyState({ children }) {
  return (
    <div className="flex min-h-[110px] flex-1 items-center justify-center px-3 py-6 text-center text-xs leading-5 text-muted">
      {children}
    </div>
  );
}

function MetricCard({ title, value, unit, sub, viz }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-white p-4 text-left shadow-sm">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>

        <div className="mt-2 flex items-baseline gap-1">
          <strong className="text-2xl leading-7">{value}</strong>
          {unit && <small className="text-xs text-muted">{unit}</small>}
        </div>

        <div className="mt-1 text-xs font-medium text-muted">{sub}</div>
      </div>

      {viz?.type === "ring" && (
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(#0bb568 0deg ${viz.value * 3.6}deg, #e4ecec ${viz.value * 3.6}deg 360deg)`,
          }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold">
            {viz.value}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [dateRange, setDateRange] = useState(DEFAULT_DATE_RANGE);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);

  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [audit, setAudit] = useState(null);

  const [projectsLoading, setProjectsLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);

  const [pageError, setPageError] = useState("");
  const [auditError, setAuditError] = useState("");

  const projectIdFromUrl = searchParams.get("projectId");

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

    const index = Number.parseInt(selected, 10) - 1;

    if (!Number.isNaN(index) && PERIODS[index]) {
      setPeriod(PERIODS[index]);
    }
  };

  // Load the user's saved projects and restore their previous selection.
  useEffect(() => {
    let active = true;

    async function loadProjects() {
      setProjectsLoading(true);
      setPageError("");

      try {
        const data = await apiRequest("/projects");
        const savedProjects = data.projects || [];

        if (!active) return;

        setProjects(savedProjects);

        if (savedProjects.length === 0) {
          setProject(null);
          setAudit(null);
          localStorage.removeItem(ACTIVE_PROJECT_KEY);
          return;
        }

        const savedProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY);

        const selectedProject =
          savedProjects.find((item) => item._id === projectIdFromUrl) ||
          savedProjects.find((item) => item._id === savedProjectId) ||
          savedProjects[0];

        setProject(selectedProject);

        localStorage.setItem(ACTIVE_PROJECT_KEY, selectedProject._id);

        // Keep the existing dashboard URL style while adding the ID.
        if (projectIdFromUrl !== selectedProject._id) {
          setSearchParams(
            { projectId: selectedProject._id },
            { replace: true },
          );
        }
      } catch (error) {
        if (active) {
          setPageError(getErrorMessage(error));
        }
      } finally {
        if (active) setProjectsLoading(false);
      }
    }

    loadProjects();

    return () => {
      active = false;
    };
  }, [projectIdFromUrl, setSearchParams]);

  // Load the latest saved audit for the active project.
  const loadLatestAudit = useCallback(async (projectId) => {
    if (!projectId) {
      setAudit(null);
      setAuditLoading(false);
      return;
    }

    setAuditLoading(true);
    setAuditError("");

    try {
      const data = await auditService.getLatestAudit(projectId);
      setAudit(data.audit || null);
    } catch (error) {
      if (error?.status === 404) {
        // A project without an audit is a normal first-time state.
        setAudit(null);
        setAuditError("");
      } else {
        setAuditError(getErrorMessage(error));
        setAudit(null);
      }
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (project?._id) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, project._id);
      loadLatestAudit(project._id);
    } else if (!projectsLoading) {
      setAudit(null);
      setAuditLoading(false);
    }
  }, [project?._id, projectsLoading, loadLatestAudit]);

  // Run a new audit using the existing backend audit service.
  async function handleRunAudit() {
    if (!project?._id || runningAudit) return;

    setRunningAudit(true);
    setAuditError("");

    try {
      const data = await auditService.runAudit(project._id);

      if (data.audit) {
        setAudit(data.audit);
      } else {
        await loadLatestAudit(project._id);
      }
    } catch (error) {
      setAuditError(getErrorMessage(error));

      // The backend may save a failed audit before returning an error.
      try {
        const latest = await auditService.getLatestAudit(project._id);

        if (latest.audit) setAudit(latest.audit);
      } catch {
        // Keep the original error visible.
      }
    } finally {
      setRunningAudit(false);
    }
  }

  function handleProjectChange(event) {
    const nextProject = projects.find(
      (item) => item._id === event.target.value,
    );

    if (!nextProject) return;

    setProject(nextProject);
    setAudit(null);
    setAuditError("");

    localStorage.setItem(ACTIVE_PROJECT_KEY, nextProject._id);

    setSearchParams({ projectId: nextProject._id });
  }

  const checks = audit?.checks || [];
  const counts = getCheckCounts(checks);
  const insights = getAuditInsights(checks);
  const failedChecks = checks.filter((check) => check.status === "failed");
  const warningChecks = checks.filter((check) => check.status === "warning");
  const issues = [...failedChecks, ...warningChecks];

  const auditReady = audit?.status === "completed";

  const kpis = [
    {
      id: "health",
      title: "SEO Health Score",
      value: auditReady ? (audit.seoScore ?? 0) : "—",
      unit: auditReady ? "/100" : "",
      sub: auditReady
        ? `${counts.passed} checks passed`
        : "Run an audit to calculate",
      viz: auditReady ? { type: "ring", value: audit.seoScore ?? 0 } : null,
    },
    {
      id: "traffic",
      title: "Organic Traffic",
      value: "—",
      unit: "",
      sub: "Connect Google Search Console",
    },
    {
      id: "keywords",
      title: "Ranking Keywords",
      value: "—",
      unit: "",
      sub: "Ranking data not connected",
    },
    {
      id: "backlinks",
      title: "Backlinks",
      value: "—",
      unit: "",
      sub: "Backlink data not connected",
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto [scrollbar-width:thin] pb-1">
      {/* PAGE HEADING */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold leading-7">
            {DASHBOARD_HEADER.title}
          </h1>
          <p className="text-xs text-muted">{DASHBOARD_HEADER.subtitle}</p>
          {project && (
            <p className="mt-1 max-w-[440px] truncate text-xs text-primary">
              Website: {project.url}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {projects.length > 1 && (
            <select
              value={project?._id || ""}
              onChange={handleProjectChange}
              aria-label="Select project"
              className="h-9 max-w-[220px] rounded-lg border border-line bg-white px-3 text-xs font-medium text-gray-700 outline-none focus:border-primary"
            >
              {projects.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={pickDateRange}
            className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3.5 text-xs font-medium text-gray-700 hover:border-primary/50"
          >
            <CalendarDays className="h-4 w-4 text-primary" />
            {dateRange}
            <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* PROJECT / AUDIT STATUS */}
      {pageError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
        >
          {pageError}
        </div>
      )}

      {projectsLoading ? (
        <section className="rounded-xl border border-line bg-white p-5 text-sm text-muted shadow-sm">
          Loading your projects...
        </section>
      ) : projects.length === 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold">
              Create your first SEO project
            </h2>
            <p className="mt-1 text-xs text-muted">
              Add your website to start running audits and tracking available
              SEO data.
            </p>
          </div>

          <button
            onClick={() => navigate("/projects")}
            className="flex h-9 items-center gap-2 rounded-lg bg-primary-dark px-4 text-xs font-semibold text-white transition hover:bg-primary"
          >
            Go to Projects
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </section>
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">
              {project?.name || "Your website"}
            </h2>

            <p className="mt-1 text-xs text-muted">
              {auditReady
                ? `Last audit: ${formatDate(audit.completedAt || audit.updatedAt)} · ${audit.pagesCrawled ?? 1} page(s) checked`
                : audit?.status === "failed"
                  ? "The latest audit failed. You can try again."
                  : auditLoading
                    ? "Loading your latest audit..."
                    : "Run an audit to calculate your website's SEO health score."}
            </p>
          </div>

          <button
            onClick={handleRunAudit}
            disabled={runningAudit || auditLoading}
            className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary-dark px-4 text-xs font-semibold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${runningAudit ? "animate-spin" : ""}`}
            />
            {runningAudit ? "Running Audit..." : "Run Audit"}
          </button>
        </section>
      )}

      {auditError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
        >
          {auditError}
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <MetricCard key={kpi.id} {...kpi} />
        ))}
      </div>

      {/* TRAFFIC + AI INSIGHTS */}
      <div className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-[1.9fr_1.15fr]">
        {/* TRAFFIC TREND */}
        <div className="flex min-h-[220px] flex-col rounded-xl border border-line bg-white p-4 shadow-sm">
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

          <EmptyState>
            Organic traffic data isn't available yet. Connect Google Search
            Console and add a backend analytics endpoint to display real traffic
            for this project.
          </EmptyState>
        </div>

        {/* INSIGHTS */}
        <div className="flex flex-col rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex min-h-[30px] items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold">AI Insights</h2>
              <span
                title="These recommendations are generated from the latest audit checks, not an AI model."
                className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-[9px] text-muted"
              >
                i
              </span>
            </div>

            <button
              onClick={() =>
                alert(
                  "These recommendations come from the latest available website audit.",
                )
              }
              className={VIEW_ALL}
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 flex flex-1 flex-col justify-between rounded-lg bg-[#effcf7] p-3">
            {auditReady ? (
              insights.map((insight) => (
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
                    &#10003;
                  </span>
                  <span>{insight.text}</span>
                </div>
              ))
            ) : (
              <EmptyState>
                Run an audit to see recommendations based on your website's
                actual checks.
              </EmptyState>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM GRID */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-3">
        {/* TOP PAGES */}
        <div className="flex min-h-[200px] min-w-0 flex-col rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="whitespace-nowrap text-sm font-semibold">
              Top Performing Pages
            </h2>

            <button
              onClick={() =>
                alert("Page traffic data requires an analytics data source.")
              }
              className={VIEW_ALL}
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
            <table className="w-full border-collapse">
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
                  <th className="bg-gray-50 px-2 py-1.5" />
                </tr>
              </thead>

              <tbody>
                {auditReady && project ? (
                  <tr className="hover:bg-gray-50/60">
                    <td
                      title={project.url}
                      className="max-w-[110px] truncate border-t border-gray-100 px-2 py-1.5 text-[13px] text-gray-700"
                    >
                      {project.url}
                    </td>
                    <td className="whitespace-nowrap border-t border-gray-100 px-2 py-1.5 text-[13px] text-gray-500">
                      —
                    </td>
                    <td className="whitespace-nowrap border-t border-gray-100 px-2 py-1.5 text-[13px] text-gray-500">
                      —
                    </td>
                    <td className="border-t border-gray-100 px-2 py-1 text-right text-muted">
                      <ArrowUpRight className="inline h-3.5 w-3.5" />
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState>
                        {auditLoading
                          ? "Loading audit data..."
                          : "Page traffic and keyword counts aren't available from the current audit service."}
                      </EmptyState>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* KEYWORD RANKINGS */}
        <div className="flex min-h-[200px] min-w-0 flex-col rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="whitespace-nowrap text-sm font-semibold">
              Keyword Rankings
            </h2>

            <button
              onClick={() =>
                alert(
                  "Connect a keyword-ranking data source to display real positions.",
                )
              }
              className={VIEW_ALL}
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
            <table className="w-full border-collapse">
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
                <tr>
                  <td colSpan={3}>
                    <EmptyState>
                      Keyword positions and ranking changes aren't provided by
                      the current audit service.
                    </EmptyState>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SEO ISSUES */}
        <div className="flex min-h-[200px] min-w-0 flex-col rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="whitespace-nowrap text-sm font-semibold">
              SEO Issues
            </h2>

            <button
              onClick={() => alert(ALERTS.viewAllIssues)}
              className={VIEW_ALL}
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-1.5 flex min-h-0 flex-1 flex-col overflow-y-auto">
            {auditReady && issues.length > 0 ? (
              issues.map((issue, index) => {
                const tone = getCheckTone(issue.status);

                return (
                  <button
                    key={`${issue.name}-${index}`}
                    onClick={() => alert(`${issue.name}: ${issue.message}`)}
                    className="flex items-center gap-2.5 border-b border-gray-100 px-1 py-[7px] text-left transition last:border-b-0 hover:bg-gray-50/60"
                  >
                    <span
                      className={
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white " +
                        (tone === "bad" ? "bg-[#e05252]" : "bg-[#e8a317]")
                      }
                    >
                      !
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
                      className={
                        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium " +
                        (PILL[tone] || PILL.warn)
                      }
                    >
                      {getCheckLabel(issue.status)}
                    </span>

                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  </button>
                );
              })
            ) : (
              <EmptyState>
                {auditLoading
                  ? "Loading audit checks..."
                  : !auditReady
                    ? "Run an audit to see actual SEO issues."
                    : "No failed or warning checks were found in the latest audit."}
              </EmptyState>
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

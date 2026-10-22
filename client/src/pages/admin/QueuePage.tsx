import { Link, useSearchParams } from "react-router";
import { api } from "../../api/client";
import type { Paginated, TicketListItem } from "../../api/types";
import { EmptyState, ErrorBanner, PriorityBadge, SourceTag, Spinner, StatusBadge } from "../../components/ui";
import { usePolling } from "../../hooks/usePolling";
import { age, CATEGORIES, CATEGORY_LABELS, PRIORITIES, PRIORITY_LABELS } from "../../lib/format";

const STATUS_PRESETS: Record<string, string> = {
  active: "OPEN,IN_PROGRESS",
  open: "OPEN",
  in_progress: "IN_PROGRESS",
  resolved: "RESOLVED",
  closed: "CLOSED",
  all: "OPEN,IN_PROGRESS,RESOLVED,CLOSED",
};

// Unresolved tickets waiting longer than this are highlighted in the queue.
const STALE_HOURS = 24;

export function QueuePage() {
  // Filters live in the URL so a filtered view can be bookmarked or shared.
  const [params, setParams] = useSearchParams();
  const view = params.get("view") ?? "active";

  const query = new URLSearchParams({ status: STATUS_PRESETS[view] ?? STATUS_PRESETS.active, pageSize: "50" });
  for (const key of ["category", "priority", "assignee", "from", "to", "q", "sort"]) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  const queryString = query.toString();

  const { data, error, loading } = usePolling(
    () => api.get<Paginated<TicketListItem>>(`/tickets?${queryString}`),
    10_000,
    [queryString],
  );

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <>
      <div className="page-header">
        <h1>Ticket Queue</h1>
        <span className="muted small">{data ? `${data.total} ticket${data.total === 1 ? "" : "s"}` : ""} · updates automatically</span>
      </div>

      <div className="filters card">
        <select value={view} onChange={(e) => setFilter("view", e.target.value === "active" ? "" : e.target.value)} aria-label="Status">
          <option value="active">Open + In progress</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
          <option value="all">All statuses</option>
        </select>
        <select value={params.get("priority") ?? ""} onChange={(e) => setFilter("priority", e.target.value)} aria-label="Priority">
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <select value={params.get("category") ?? ""} onChange={(e) => setFilter("category", e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select value={params.get("assignee") ?? ""} onChange={(e) => setFilter("assignee", e.target.value)} aria-label="Assignee">
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </select>
        <label className="inline">
          From
          <input type="date" value={params.get("from") ?? ""} onChange={(e) => setFilter("from", e.target.value)} />
        </label>
        <label className="inline">
          To
          <input type="date" value={params.get("to") ?? ""} onChange={(e) => setFilter("to", e.target.value)} />
        </label>
        <input
          type="search"
          placeholder="Search subject…"
          defaultValue={params.get("q") ?? ""}
          onKeyDown={(e) => e.key === "Enter" && setFilter("q", e.currentTarget.value.trim())}
          aria-label="Search"
        />
        <select value={params.get("sort") ?? "urgency"} onChange={(e) => setFilter("sort", e.target.value === "urgency" ? "" : e.target.value)} aria-label="Sort">
          <option value="urgency">Most urgent first</option>
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
          <option value="updated">Recently updated</option>
        </select>
      </div>

      <ErrorBanner error={error} />
      {loading && !data ? (
        <Spinner />
      ) : !data?.items.length ? (
        <EmptyState title="No tickets match these filters">Nothing waiting here. Try another status or clear the filters.</EmptyState>
      ) : (
        <div className="card table-wrap">
          <table className="queue">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Ticket</th>
                <th>Category</th>
                <th>Author / Book</th>
                <th>Status</th>
                <th>Assignee</th>
                <th title="Time since the ticket was raised">Waiting</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => {
                const unresolved = t.status === "OPEN" || t.status === "IN_PROGRESS";
                const hours = (Date.now() - new Date(t.createdAt).getTime()) / 3_600_000;
                const stale = unresolved && hours > STALE_HOURS;
                return (
                  <tr key={t.id} className={stale ? "stale" : undefined}>
                    <td>
                      <PriorityBadge priority={t.priority} /> <SourceTag source={t.prioritySource} />
                    </td>
                    <td>
                      <Link to={`/admin/tickets/${t.id}`} className="ticket-link">
                        #{t.id} {t.subject}
                      </Link>
                      {t.aiSummary && t.aiSummary !== t.subject && <div className="muted small">{t.aiSummary}</div>}
                    </td>
                    <td className="small">{t.category ? CATEGORY_LABELS[t.category] : "—"}</td>
                    <td className="small">
                      {t.author.name}
                      <div className="muted">{t.book?.title ?? "Account level"}</div>
                    </td>
                    <td>
                      <StatusBadge status={t.status} />
                      {unresolved && !t.firstResponseAt && <div className="muted small">No reply yet</div>}
                    </td>
                    <td className="small">{t.assignee?.name ?? <span className="muted">Unassigned</span>}</td>
                    <td className={stale ? "age stale-age" : "age"}>{age(t.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

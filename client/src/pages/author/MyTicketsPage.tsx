import { Link } from "react-router";
import { api } from "../../api/client";
import type { Paginated, TicketListItem } from "../../api/types";
import { EmptyState, ErrorBanner, Spinner, StatusBadge } from "../../components/ui";
import { usePolling } from "../../hooks/usePolling";
import { dateTime } from "../../lib/format";

export function MyTicketsPage() {
  const { data, error, loading } = usePolling(
    () => api.get<Paginated<TicketListItem>>("/tickets?sort=updated&pageSize=100"),
    10_000,
  );

  return (
    <>
      <div className="page-header">
        <h1>My Tickets</h1>
        <Link to="/tickets/new" className="btn btn-primary">
          New query
        </Link>
      </div>
      <ErrorBanner error={error} />
      {loading && !data ? (
        <Spinner />
      ) : !data?.items.length ? (
        <EmptyState title="You haven't raised any queries yet">
          Questions about royalties, ISBNs, printing or your book's status? <Link to="/tickets/new">Ask us here.</Link>
        </EmptyState>
      ) : (
        <ul className="ticket-list">
          {data.items.map((t) => (
            <li key={t.id}>
              <Link to={`/tickets/${t.id}`} className="card ticket-row">
                <div>
                  <div className="ticket-subject">
                    #{t.id} · {t.subject}
                  </div>
                  <div className="muted small">
                    {t.book?.title ?? "General / Account"} · Updated {dateTime(t.updatedAt)}
                    {t.replyCount > 0 && ` · ${t.replyCount} message${t.replyCount === 1 ? "" : "s"}`}
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

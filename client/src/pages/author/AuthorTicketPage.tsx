import { useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router";
import { api } from "../../api/client";
import type { TicketDetail } from "../../api/types";
import { ErrorBanner, Spinner, StatusBadge } from "../../components/ui";
import { Thread } from "../../components/Thread";
import { usePolling } from "../../hooks/usePolling";
import { CATEGORY_LABELS, dateTime } from "../../lib/format";

export function AuthorTicketPage() {
  const { id } = useParams();
  const location = useLocation();
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated;
  // Polled every 5s, so admin replies appear without a refresh.
  const { data: ticket, error, setData } = usePolling(() => api.get<TicketDetail>(`/tickets/${id}`), 5_000, [id]);
  const [reply, setReply] = useState("");
  const [sendError, setSendError] = useState<Error | null>(null);
  const [sending, setSending] = useState(false);

  if (error && !ticket) return <ErrorBanner error={error} />;
  if (!ticket) return <Spinner />;

  async function onReply(e: FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      setData(await api.post<TicketDetail>(`/tickets/${id}/messages`, { body: reply }));
      setReply("");
    } catch (err) {
      setSendError(err as Error);
    } finally {
      setSending(false);
    }
  }

  const waitingForTeam = ticket.messages.length === 0;

  return (
    <div className="narrow">
      <p>
        <Link to="/tickets">← My Tickets</Link>
      </p>
      {justCreated && (
        <div className="banner banner-success">Your query has been submitted. We'll reply here, and this page updates automatically.</div>
      )}
      <div className="page-header">
        <h1>
          #{ticket.id} · {ticket.subject}
        </h1>
        <StatusBadge status={ticket.status} />
      </div>
      <p className="muted small">
        {ticket.book?.title ?? "General / Account Level"}
        {ticket.category && ` · ${CATEGORY_LABELS[ticket.category]}`} · Raised {dateTime(ticket.createdAt)}
      </p>

      <Thread
        original={{ body: ticket.description, createdAt: ticket.createdAt, attachmentName: ticket.attachmentName }}
        messages={ticket.messages}
        viewer="AUTHOR"
      />

      {waitingForTeam && <p className="muted small live-hint">Our team will reply here. This page updates automatically.</p>}

      {ticket.status === "CLOSED" ? (
        <p className="note">
          This ticket is closed. Need more help? <Link to="/tickets/new">Raise a new query.</Link>
        </p>
      ) : (
        <form className="card form reply-box" onSubmit={onReply}>
          <label>
            {ticket.status === "RESOLVED" ? "Still need help? Replying will reopen this ticket." : "Add a reply"}
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={10000} />
          </label>
          <ErrorBanner error={sendError} />
          <div className="form-actions">
            <button className="btn btn-primary" disabled={sending || !reply.trim()}>
              {sending ? "Sending…" : "Send reply"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

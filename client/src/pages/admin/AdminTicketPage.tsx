import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { api } from "../../api/client";
import type { Draft, TeamMember, TicketDetail, TicketStatus } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { ErrorBanner, PriorityBadge, SourceTag, Spinner, StatusBadge } from "../../components/ui";
import { Thread } from "../../components/Thread";
import { usePolling } from "../../hooks/usePolling";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  date,
  dateTime,
  inr,
  isPublished,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
} from "../../lib/format";

type Mode = "REPLY" | "INTERNAL_NOTE";

export function AdminTicketPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: ticket, error, setData } = usePolling(() => api.get<TicketDetail>(`/tickets/${id}`), 5_000, [id]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [actionError, setActionError] = useState<Error | null>(null);

  useEffect(() => {
    api.get<{ items: TeamMember[] }>("/admin/team").then((r) => setTeam(r.items)).catch(() => setTeam([]));
  }, []);

  const update = useCallback(
    async (body: Record<string, unknown>) => {
      setActionError(null);
      try {
        setData(await api.patch<TicketDetail>(`/tickets/${id}`, body));
      } catch (err) {
        setActionError(err as Error);
      }
    },
    [id, setData],
  );

  if (error && !ticket) return <ErrorBanner error={error} />;
  if (!ticket) return <Spinner />;

  return (
    <>
      <p>
        <Link to="/admin/tickets">← Queue</Link>
      </p>
      <div className="page-header">
        <h1>
          #{ticket.id} · {ticket.subject}
        </h1>
        <div className="header-badges">
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>
      {ticket.aiSummary && ticket.aiSummary !== ticket.subject && <p className="muted">{ticket.aiSummary}</p>}
      <ErrorBanner error={actionError} />

      <div className="ticket-layout">
        <section>
          <Thread
            original={{
              body: ticket.description,
              createdAt: ticket.createdAt,
              attachmentName: ticket.attachmentName,
              authorName: ticket.author?.name,
            }}
            messages={ticket.messages}
            viewer="ADMIN"
          />
          {ticket.status !== "CLOSED" && <Composer ticket={ticket} onSent={setData} />}
        </section>

        <aside className="sidebar">
          <div className="card side-card">
            <h3>Triage</h3>
            <label>
              Status
              <select value={ticket.status} onChange={(e) => update({ status: e.target.value as TicketStatus })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority <SourceTag source={ticket.prioritySource} />
              <select value={ticket.priority ?? ""} onChange={(e) => update({ priority: e.target.value })}>
                {!ticket.priority && <option value="">Classifying…</option>}
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category <SourceTag source={ticket.categorySource} />
              <select value={ticket.category ?? ""} onChange={(e) => update({ category: e.target.value })}>
                {!ticket.category && <option value="">Classifying…</option>}
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assignee
              <select value={ticket.assignee?.id ?? ""} onChange={(e) => update({ assigneeId: e.target.value || null })}>
                <option value="">Unassigned</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            {ticket.assignee?.id !== user?.id && (
              <button className="btn btn-ghost btn-sm" onClick={() => update({ assigneeId: "me" })}>
                Assign to me
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              title="Ask the AI to classify again. Fields you set manually are kept."
              onClick={async () => {
                setActionError(null);
                try {
                  setData(await api.post<TicketDetail>(`/tickets/${id}/classify`));
                } catch (err) {
                  setActionError(err as Error);
                }
              }}
            >
              Re-run AI classification
            </button>
          </div>

          <div className="card side-card">
            <h3>Author</h3>
            <p>
              <strong>{ticket.author?.name}</strong>
              <br />
              <span className="muted small">
                {ticket.author?.email}
                {ticket.author?.city && ` · ${ticket.author.city}`}
              </span>
            </p>
            <p className="muted small">Raised {dateTime(ticket.createdAt)}</p>
          </div>

          {ticket.book && (
            <div className="card side-card">
              <h3>Book</h3>
              <p>
                <strong>{ticket.book.title}</strong>
                <br />
                <span className="muted small">ISBN {ticket.book.isbn}</span>
              </p>
              <dl className="facts">
                <dt>Status</dt>
                <dd>{ticket.book.status}</dd>
                {isPublished(ticket.book.status) && (
                  <>
                    <dt>Published</dt>
                    <dd>{date(ticket.book.publicationDate)}</dd>
                    <dt>Copies sold</dt>
                    <dd>{ticket.book.totalCopiesSold}</dd>
                    <dt>Royalty paid</dt>
                    <dd>{inr(ticket.book.royaltyPaid)}</dd>
                    <dt>Pending</dt>
                    <dd className={ticket.book.royaltyPending > 0 ? "highlight" : undefined}>{inr(ticket.book.royaltyPending)}</dd>
                    <dt>Last payout</dt>
                    <dd>{ticket.book.lastRoyaltyPayoutAt ? date(ticket.book.lastRoyaltyPayoutAt) : "Never"}</dd>
                    <dt>Platforms</dt>
                    <dd>{ticket.book.availableOn.join(", ")}</dd>
                    <dt>Printer</dt>
                    <dd>{ticket.book.printPartner ?? "—"}</dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Composer({ ticket, onSent }: { ticket: TicketDetail; onSent: (t: TicketDetail) => void }) {
  const [mode, setMode] = useState<Mode>("REPLY");
  const [body, setBody] = useState("");
  const [usedDraft, setUsedDraft] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<Error | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<Error | null>(null);

  const bodyRef = useRef(body);
  bodyRef.current = body;

  // A draft is only useful while the author is waiting on us: when there are
  // no team replies yet, or the author has replied since. This avoids paying
  // for a new draft right after we've answered.
  const publicMessages = ticket.messages.filter((m) => m.kind === "REPLY");
  const lastPublic = publicMessages[publicMessages.length - 1];
  const awaitingTeam = !lastPublic || lastPublic.sender.role === "AUTHOR";
  const draftKey = lastPublic?.id ?? "initial";

  const loadDraft = useCallback(
    async (regenerate = false) => {
      setDraftLoading(true);
      setDraftError(null);
      try {
        const d = regenerate
          ? await api.post<Draft>(`/tickets/${ticket.id}/draft`)
          : await api.get<Draft>(`/tickets/${ticket.id}/draft`);
        setDraft(d);
        // Pre-fill the reply box, unless the admin has already started typing.
        if (regenerate || !bodyRef.current.trim()) {
          setBody(d.content);
          // Only real AI drafts count towards the "started from AI draft" metric.
          setUsedDraft(d.source === "AI");
        }
      } catch (err) {
        // The reply box stays usable: admins can always write manually.
        setDraftError(err as Error);
      } finally {
        setDraftLoading(false);
      }
    },
    [ticket.id],
  );

  // Fetch a draft when the ticket opens, and again when the author replies.
  useEffect(() => {
    if (ticket.category && awaitingTeam) loadDraft();
  }, [loadDraft, draftKey, awaitingTeam, ticket.category]);

  async function send(status?: TicketStatus) {
    if (!body.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const updated = await api.post<TicketDetail>(`/tickets/${ticket.id}/messages`, {
        body,
        kind: mode,
        status: mode === "REPLY" ? status : undefined,
        fromAiDraft: mode === "REPLY" && usedDraft,
      });
      onSent(updated);
      setBody("");
      setUsedDraft(false);
      if (mode === "REPLY") setDraft(null); // the draft answered the previous message
      setMode("REPLY");
    } catch (err) {
      setSendError(err as Error);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`card composer ${mode === "INTERNAL_NOTE" ? "composer-note" : ""}`}>
      <div className="composer-tabs" role="tablist">
        <button role="tab" aria-selected={mode === "REPLY"} className={mode === "REPLY" ? "active" : ""} onClick={() => setMode("REPLY")}>
          Reply to author
        </button>
        <button
          role="tab"
          aria-selected={mode === "INTERNAL_NOTE"}
          className={mode === "INTERNAL_NOTE" ? "active" : ""}
          onClick={() => setMode("INTERNAL_NOTE")}
        >
          Internal note
        </button>
      </div>

      {mode === "REPLY" && (
        <div className="ai-panel">
          {!ticket.category ? (
            <span className="muted small">AI draft will be ready once the ticket is classified…</span>
          ) : !awaitingTeam && !draft && !draftLoading ? (
            <span className="small">
              You've replied last.{" "}
              <button className="btn btn-ghost btn-sm" onClick={() => loadDraft(true)}>
                Draft a follow-up with AI
              </button>
            </span>
          ) : draftLoading ? (
            <span className="muted small">✨ Drafting a reply from the knowledge base…</span>
          ) : draftError ? (
            <span className="small">AI draft unavailable ({draftError.message}). You can write the reply manually.</span>
          ) : draft ? (
            <>
              <div className="ai-panel-head">
                <span className="small">
                  {draft.source === "AI" ? (
                    <>
                      ✨ <strong>AI draft</strong> pre-filled below. Review and edit before sending.
                      {draft.cached && <span className="muted"> (cached)</span>}
                    </>
                  ) : (
                    <>
                      <strong>Template draft</strong>: AI is unavailable ({draft.ai.reason}). Personalise before sending.
                    </>
                  )}
                </span>
                <span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setBody(draft.content);
                      setUsedDraft(draft.source === "AI");
                    }}
                  >
                    Reset to draft
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => loadDraft(true)}>
                    Regenerate
                  </button>
                </span>
              </div>
              {draft.checklist.length > 0 && (
                <ul className="checklist small">
                  {draft.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          // Clearing the box means the admin is writing from scratch.
          if (!e.target.value.trim()) setUsedDraft(false);
        }}
        rows={mode === "REPLY" ? 12 : 4}
        placeholder={mode === "REPLY" ? "Write a reply to the author…" : "Visible to the BookLeaf team only"}
        aria-label={mode === "REPLY" ? "Reply" : "Internal note"}
      />
      <ErrorBanner error={sendError} />
      <div className="form-actions">
        {mode === "REPLY" ? (
          <>
            <button className="btn btn-ghost" disabled={sending || !body.trim()} onClick={() => send("RESOLVED")}>
              Send &amp; resolve
            </button>
            <button className="btn btn-primary" disabled={sending || !body.trim()} onClick={() => send()}>
              {sending ? "Sending…" : "Send reply"}
            </button>
          </>
        ) : (
          <button className="btn btn-primary" disabled={sending || !body.trim()} onClick={() => send()}>
            {sending ? "Saving…" : "Add internal note"}
          </button>
        )}
      </div>
    </div>
  );
}

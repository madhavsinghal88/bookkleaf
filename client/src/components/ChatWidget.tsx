import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { api, ApiError } from "../api/client";
import type { ChatMessage } from "../api/types";
import { date } from "../lib/format";

const SESSION_KEY = "bookleaf.salesSession";
export const OPEN_SALES_THREAD_KEY = "bookleaf.openSalesThread";

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatView {
  threadId: string | null;
  sessions: ChatSession[];
  messages: ChatMessage[];
}

const COPY = {
  sales: {
    title: "Publishing advisor",
    launcher: "Talk to sales",
    intro: "Ask about packages, royalties, and how a manuscript becomes a live book.",
    suggestions: ["What's included in Standard Free?", "How do royalties work?", "How long until a book goes live?"],
  },
  support: {
    title: "Author assistant",
    launcher: "Help",
    intro: "Ask about your books, royalties, or production status. Use New Query when the team needs to change something.",
    suggestions: ["When is my next royalty payout?", "What's the status of my books?", "Where are my books listed?"],
  },
} as const;

function salesSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, created);
  return created;
}

export function ChatWidget({
  kind,
  startOpen = false,
  onReady,
  hideLauncher = false,
  refreshKey = 0,
  onOpenChange,
}: {
  kind: "sales" | "support";
  startOpen?: boolean;
  onReady?: (open: () => void) => void;
  hideLauncher?: boolean;
  refreshKey?: number;
  onOpenChange?: (open: boolean) => void;
}) {
  const copy = COPY[kind];
  const [open, setOpen] = useState(startOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    onReadyRef.current?.(() => setOpen(true));
  }, []);

  useEffect(() => {
    onOpenChangeRef.current?.(open);
  }, [open]);

  useEffect(() => {
    if (refreshKey > 0) setOpen(true);
  }, [refreshKey]);

  function visitorId() {
    return sessionId.current ?? (sessionId.current = salesSessionId());
  }

  function viewPath(threadId?: string | null) {
    if (kind === "sales") {
      const query = new URLSearchParams({ sessionId: visitorId() });
      if (threadId) query.set("threadId", threadId);
      return `/chat/sales?${query}`;
    }
    return threadId ? `/chat/support?threadId=${encodeURIComponent(threadId)}` : "/chat/support";
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setShowSaved(false);
    const pending = kind === "sales" ? sessionStorage.getItem(OPEN_SALES_THREAD_KEY) : null;
    if (pending) sessionStorage.removeItem(OPEN_SALES_THREAD_KEY);
    api
      .get<ChatView>(viewPath(pending))
      .then((data) => {
        if (cancelled) return;
        setSessions(data.sessions);
        setActiveId(data.threadId);
        setMessages(data.messages);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load the conversation.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, kind, refreshKey]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, sending, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setDraft("");
    setError(null);
    setSending(true);
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "USER",
      content: message,
      source: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    try {
      const body =
        kind === "sales"
          ? { sessionId: visitorId(), message, ...(activeId ? { threadId: activeId } : {}) }
          : { message, ...(activeId ? { threadId: activeId } : {}) };
      const path = kind === "sales" ? "/chat/sales" : "/chat/support";
      const data = await api.post<{ threadId: string; messages: ChatMessage[] }>(path, body);
      setActiveId(data.threadId);
      setMessages((current) => [...current.filter((item) => item.id !== optimistic.id), ...data.messages]);
      setSessions((current) => {
        const existing = current.find((item) => item.id === data.threadId);
        const next = {
          id: data.threadId,
          title: existing?.title ?? message.slice(0, 80),
          updatedAt: new Date().toISOString(),
        };
        return [next, ...current.filter((item) => item.id !== data.threadId)].slice(0, 20);
      });
    } catch (err) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(message);
      setError(err instanceof ApiError ? err.message : "Message didn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function startNew() {
    setActiveId(null);
    setMessages([]);
    setError(null);
    setDraft("");
    setShowSaved(false);
  }

  async function openSaved(id: string) {
    setShowSaved(false);
    setLoading(true);
    setError(null);
    setMessages([]);
    setActiveId(id);
    try {
      const data = await api.get<ChatView>(viewPath(id));
      setSessions(data.sessions);
      setActiveId(data.threadId);
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't open that chat.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  }

  return (
    <div className={`chat-dock chat-dock-${kind}${startOpen ? " chat-dock-inline" : ""}`}>
      {open && (
        <section className="card chat-panel" role="dialog" aria-label={copy.title}>
          <header className="chat-head">
            <div>
              <strong>{copy.title}</strong>
              <p className="muted small">{copy.intro}</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close chat">
              Close
            </button>
          </header>
          <div className="chat-tools">
            <button type="button" onClick={startNew} disabled={sending}>
              New
            </button>
            <button type="button" className={showSaved ? "active" : undefined} onClick={() => setShowSaved((value) => !value)} aria-expanded={showSaved}>
              Saved{sessions.length > 0 ? ` (${sessions.length})` : ""}
            </button>
          </div>
          {showSaved && (
            <ul className="chat-sessions">
              {sessions.length === 0 && <li className="muted small">No saved chats yet.</li>}
              {sessions.map((session) => (
                <li key={session.id}>
                  <button type="button" className={session.id === activeId ? "active" : undefined} onClick={() => void openSaved(session.id)}>
                    <span>{session.title}</span>
                    <time dateTime={session.updatedAt}>{date(session.updatedAt)}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="chat-log" ref={logRef}>
            {loading && <p className="muted small">Loading conversation…</p>}
            {!loading && messages.length === 0 && (
              <p className="muted small">New chat. Earlier conversations stay under Saved.</p>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`chat-bubble chat-${message.role.toLowerCase()}`}>
                <p>{message.content}</p>
                {message.role === "ASSISTANT" && message.source === "RULES" && (
                  <span className="chat-source">From the BookLeaf guide</span>
                )}
              </div>
            ))}
            {sending && <p className="muted small">BookLeaf is replying…</p>}
          </div>
          {messages.length === 0 && !loading && (
            <div className="chat-suggestions">
              {copy.suggestions.map((suggestion) => (
                <button key={suggestion} type="button" className="btn btn-ghost btn-sm" onClick={() => void send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          {kind === "support" && (
            <p className="chat-ticket-link small">
              Need the team to act? <Link to="/tickets/new">New Query</Link>
            </p>
          )}
          {error && <div className="banner banner-error chat-error">{error}</div>}
          <form className="chat-form" onSubmit={onSubmit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              maxLength={1500}
              placeholder="Write a message"
              aria-label="Message"
              disabled={sending}
            />
            <button className="btn btn-primary" disabled={sending || !draft.trim()}>
              Send
            </button>
          </form>
        </section>
      )}
      {!hideLauncher && !(startOpen && open) &&
        (kind === "support" ? (
          <button
            type="button"
            className="chat-launcher-help"
            aria-label={open ? "Hide help" : "Help"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "×" : "?"}
          </button>
        ) : (
          <button type="button" className="btn btn-primary chat-launcher" onClick={() => setOpen((value) => !value)}>
            {open ? "Hide chat" : copy.launcher}
          </button>
        ))}
    </div>
  );
}

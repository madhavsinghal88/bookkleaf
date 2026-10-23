import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { api, ApiError } from "../api/client";
import type { ChatMessage } from "../api/types";

const SESSION_KEY = "bookleaf.salesSession";

const COPY = {
  sales: {
    title: "Publishing advisor",
    launcher: "Talk to sales",
    intro: "Ask about packages, royalties, and how a manuscript becomes a live book.",
    suggestions: ["What's included in Standard Free?", "How do royalties work?", "How long until a book goes live?"],
  },
  support: {
    title: "Author assistant",
    launcher: "Ask BookLeaf",
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
}: {
  kind: "sales" | "support";
  startOpen?: boolean;
  onReady?: (open: () => void) => void;
  hideLauncher?: boolean;
}) {
  const copy = COPY[kind];
  const [open, setOpen] = useState(startOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    onReadyRef.current?.(() => setOpen(true));
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const path =
      kind === "sales"
        ? `/chat/sales?sessionId=${sessionId.current ?? (sessionId.current = salesSessionId())}`
        : "/chat/support";
    api
      .get<{ messages: ChatMessage[] }>(path)
      .then((data) => {
        if (!cancelled) setMessages(data.messages);
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
  }, [open, kind]);

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
      const body = kind === "sales" ? { sessionId: sessionId.current ?? salesSessionId(), message } : { message };
      const path = kind === "sales" ? "/chat/sales" : "/chat/support";
      const data = await api.post<{ messages: ChatMessage[] }>(path, body);
      setMessages((current) => [...current.filter((item) => item.id !== optimistic.id), ...data.messages]);
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
          <div className="chat-log" ref={logRef}>
            {loading && <p className="muted small">Loading conversation…</p>}
            {!loading && messages.length === 0 && <p className="muted small">No messages yet. Try one of the questions below.</p>}
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
      {!hideLauncher && !(startOpen && open) && (
        <button type="button" className="btn btn-primary chat-launcher" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide chat" : copy.launcher}
        </button>
      )}
    </div>
  );
}

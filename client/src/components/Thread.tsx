import type { Role, TicketMessage } from "../api/types";
import { dateTime } from "../lib/format";

interface Props {
  original: { body: string; createdAt: string; attachmentName: string | null; authorName?: string };
  messages: TicketMessage[];
  viewer: Role;
}

// The conversation: the author's original query followed by replies (and, for
// admins only, internal notes, which the API never sends to authors).
export function Thread({ original, messages, viewer }: Props) {
  return (
    <ol className="thread">
      <li className="msg msg-author">
        <div className="msg-meta">
          <strong>{viewer === "AUTHOR" ? "You" : (original.authorName ?? "Author")}</strong> · {dateTime(original.createdAt)}
        </div>
        <div className="msg-body">{original.body}</div>
        {original.attachmentName && <div className="msg-attachment">📎 {original.attachmentName}</div>}
      </li>
      {messages.map((m) => {
        const fromTeam = m.sender.role === "ADMIN";
        const cls = m.kind === "INTERNAL_NOTE" ? "msg-note" : fromTeam ? "msg-team" : "msg-author";
        const who =
          m.kind === "INTERNAL_NOTE"
            ? `Internal note · ${m.sender.name}`
            : fromTeam
              ? viewer === "AUTHOR"
                ? `${m.sender.name} · BookLeaf Support`
                : m.sender.name
              : viewer === "AUTHOR"
                ? "You"
                : m.sender.name;
        return (
          <li key={m.id} className={`msg ${cls}`}>
            <div className="msg-meta">
              <strong>{who}</strong> · {dateTime(m.createdAt)}
              {viewer === "ADMIN" && m.fromAiDraft && <span className="source-tag source-ai">from AI draft</span>}
            </div>
            <div className="msg-body">{m.body}</div>
          </li>
        );
      })}
    </ol>
  );
}

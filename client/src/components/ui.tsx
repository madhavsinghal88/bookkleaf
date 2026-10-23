import type { ReactNode } from "react";
import type { ClassificationSource, TicketPriority, TicketStatus } from "../api/types";
import { useI18n } from "../i18n";
import { PRIORITY_LABELS, STATUS_LABELS } from "../lib/format";

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge status-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority | null | undefined }) {
  if (!priority) return <span className="badge pending">Classifying…</span>;
  return <span className={`badge priority-${priority.toLowerCase()}`}>{PRIORITY_LABELS[priority]}</span>;
}

// Shows who set a value: AI, keyword rules (AI was unavailable), or an admin.
export function SourceTag({ source }: { source: ClassificationSource | null | undefined }) {
  if (!source) return null;
  const label = { AI: "AI", RULES: "Rules", ADMIN: "Admin" }[source];
  const title = {
    AI: "Suggested by the AI classifier",
    RULES: "AI was unavailable, so keyword rules were used",
    ADMIN: "Set manually by an admin",
  }[source];
  return (
    <span className={`source-tag source-${source.toLowerCase()}`} title={title}>
      {label}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function ErrorBanner({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <div className="banner banner-error" role="alert">
      {error.message}
    </div>
  );
}

export function Spinner({ label, full = false }: { label?: string; full?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={full ? "loader loader-full" : "loader"} role="status" aria-live="polite">
      <span className="loader-ring" aria-hidden="true" />
      <span className="loader-label">{label ?? t("loading")}</span>
    </div>
  );
}

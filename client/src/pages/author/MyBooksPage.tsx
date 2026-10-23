import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../../api/client";
import type { Book } from "../../api/types";
import { EmptyState, ErrorBanner, Spinner } from "../../components/ui";
import { useI18n } from "../../i18n";
import { date, inr, isPublished } from "../../lib/format";

const PRODUCTION_STAGES = [
  "Manuscript Received",
  "Editing",
  "Cover Design",
  "Typesetting",
  "Proofreading",
  "ISBN Assignment",
  "Printing",
  "Distribution Setup",
  "Published & Live",
];
const PAYOUT_THRESHOLD = 1000;

export function MyBooksPage() {
  const { t } = useI18n();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api
      .get<{ items: Book[] }>("/books")
      .then((r) => setBooks(r.items))
      .catch(setError);
  }, []);

  if (error) return <ErrorBanner error={error} />;
  if (!books) return <Spinner />;
  if (books.length === 0) {
    return <EmptyState title={t("noBooks")}>{t("noBooksBody")}</EmptyState>;
  }

  const totals = books.reduce(
    (acc, b) => ({
      earned: acc.earned + b.totalRoyaltyEarned,
      paid: acc.paid + b.royaltyPaid,
      pending: acc.pending + b.royaltyPending,
      sold: acc.sold + b.totalCopiesSold,
    }),
    { earned: 0, paid: 0, pending: 0, sold: 0 },
  );

  return (
    <>
      <div className="page-header">
        <h1>{t("myBooks")}</h1>
        <Link to="/tickets/new" className="btn btn-primary">
          {t("askQuestion")}
        </Link>
      </div>

      <div className="stat-row">
        <Stat label={t("copiesSold")} value={totals.sold.toLocaleString("en-IN")} />
        <Stat label={t("royaltyEarned")} value={inr(totals.earned)} />
        <Stat label={t("royaltyPaid")} value={inr(totals.paid)} />
        <Stat label={t("royaltyPending")} value={inr(totals.pending)} />
      </div>
      <p className="muted small">{t("royaltyPolicy")}</p>

      <div className="book-list">
        {books.map((b) => (isPublished(b.status) ? <PublishedBook key={b.id} book={b} /> : <InProductionBook key={b.id} book={b} />))}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function PublishedBook({ book: b }: { book: Book }) {
  const { t } = useI18n();
  return (
    <article className="card book">
      <header className="book-header">
        <div>
          <h2>{b.title}</h2>
          <p className="muted small">
            {b.genre} · ISBN {b.isbn}
          </p>
        </div>
        <span className="badge status-resolved">{t("publishedLive")}</span>
      </header>
      <dl className="book-grid">
        <Field label={t("published")} value={date(b.publicationDate)} />
        <Field label={t("mrp")} value={inr(b.mrp)} />
        <Field label={t("copiesSold")} value={b.totalCopiesSold.toLocaleString("en-IN")} />
        <Field label={t("royaltyPerCopy")} value={inr(b.authorRoyaltyPerCopy)} />
        <Field label={t("totalEarned")} value={inr(b.totalRoyaltyEarned)} />
        <Field label={t("paid")} value={inr(b.royaltyPaid)} />
        <Field label={t("pending")} value={inr(b.royaltyPending)} highlight={b.royaltyPending > 0} />
        <Field label={t("lastPayout")} value={b.lastRoyaltyPayoutAt ? date(b.lastRoyaltyPayoutAt) : t("noPayouts")} />
      </dl>
      {b.royaltyPending > 0 && b.royaltyPending < PAYOUT_THRESHOLD && (
        <p className="note">{t("belowThreshold", { amount: inr(b.royaltyPending), threshold: inr(PAYOUT_THRESHOLD) })}</p>
      )}
      {b.totalCopiesSold === 0 && <p className="note">{t("noSales")}</p>}
      <footer className="book-footer muted small">
        {t("availableOn", { platforms: b.availableOn.join(", ") || t("noPlatforms") })}
        {" · "}
        {t("printedBy", { partner: b.printPartner ?? "—" })}
      </footer>
    </article>
  );
}

function InProductionBook({ book: b }: { book: Book }) {
  const { t, stage: stageLabel } = useI18n();
  // Status looks like "In Production - Cover Design".
  const stage = b.status.split(" - ")[1] ?? b.status;
  const currentIndex = PRODUCTION_STAGES.indexOf(stage);

  return (
    <article className="card book">
      <header className="book-header">
        <div>
          <h2>{b.title}</h2>
          <p className="muted small">
            {b.genre} · ISBN {b.isbn}
          </p>
        </div>
        <span className="badge status-in_progress">{t("inProduction")}</span>
      </header>
      <ol className="stages" aria-label="Production progress">
        {PRODUCTION_STAGES.map((s, i) => (
          <li key={s} className={i < currentIndex ? "done" : i === currentIndex ? "current" : undefined}>
            {stageLabel(s)}
          </li>
        ))}
      </ol>
      <p className="muted small">{t("currentlyIn", { stage: stageLabel(stage) })}</p>
    </article>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={highlight ? "highlight" : undefined}>{value}</dd>
    </div>
  );
}

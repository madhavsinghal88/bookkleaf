import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../../api/client";
import type { Book } from "../../api/types";
import { EmptyState, ErrorBanner, Spinner } from "../../components/ui";
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
    return <EmptyState title="No books yet">Once your manuscript is received, it will appear here.</EmptyState>;
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
        <h1>My Books</h1>
        <Link to="/tickets/new" className="btn btn-primary">
          Ask a question
        </Link>
      </div>

      <div className="stat-row">
        <Stat label="Copies sold" value={totals.sold.toLocaleString("en-IN")} />
        <Stat label="Royalty earned" value={inr(totals.earned)} />
        <Stat label="Royalty paid" value={inr(totals.paid)} />
        <Stat label="Royalty pending" value={inr(totals.pending)} />
      </div>
      <p className="muted small">
        Royalties are calculated quarterly and paid by bank transfer within 45 days of each quarter ending. Balances under{" "}
        {inr(PAYOUT_THRESHOLD)} roll over to the next quarter.
      </p>

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
  return (
    <article className="card book">
      <header className="book-header">
        <div>
          <h2>{b.title}</h2>
          <p className="muted small">
            {b.genre} · ISBN {b.isbn}
          </p>
        </div>
        <span className="badge status-resolved">{b.status}</span>
      </header>
      <dl className="book-grid">
        <Field label="Published" value={date(b.publicationDate)} />
        <Field label="MRP" value={inr(b.mrp)} />
        <Field label="Copies sold" value={b.totalCopiesSold.toLocaleString("en-IN")} />
        <Field label="Royalty / copy" value={inr(b.authorRoyaltyPerCopy)} />
        <Field label="Total earned" value={inr(b.totalRoyaltyEarned)} />
        <Field label="Paid" value={inr(b.royaltyPaid)} />
        <Field label="Pending" value={inr(b.royaltyPending)} highlight={b.royaltyPending > 0} />
        <Field label="Last payout" value={b.lastRoyaltyPayoutAt ? date(b.lastRoyaltyPayoutAt) : "No payouts yet"} />
      </dl>
      {b.royaltyPending > 0 && b.royaltyPending < PAYOUT_THRESHOLD && (
        <p className="note">
          Your pending royalty of {inr(b.royaltyPending)} is below the {inr(PAYOUT_THRESHOLD)} payout threshold, so it will roll
          over and be paid once it crosses the threshold.
        </p>
      )}
      {b.totalCopiesSold === 0 && <p className="note">No sales recorded yet. Royalties will appear here after your first sales.</p>}
      <footer className="book-footer muted small">
        Available on {b.availableOn.join(", ") || "no platforms yet"} · Printed by {b.printPartner ?? "—"}
      </footer>
    </article>
  );
}

function InProductionBook({ book: b }: { book: Book }) {
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
        <span className="badge status-in_progress">In production</span>
      </header>
      <ol className="stages" aria-label="Production progress">
        {PRODUCTION_STAGES.map((s, i) => (
          <li key={s} className={i < currentIndex ? "done" : i === currentIndex ? "current" : undefined}>
            {s}
          </li>
        ))}
      </ol>
      <p className="muted small">
        Currently in <strong>{stage}</strong>. Price, sales and royalties will appear once the book is published.
      </p>
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

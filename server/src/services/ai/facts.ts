// Deterministic account facts for the AI prompts. We compute dates and money in
// code rather than asking the model to, so drafts quote correct numbers
// (e.g. the actual next payout date) instead of plausible-sounding guesses.
import type { Book } from "../../generated/prisma/client.js";

export const PAYOUT_THRESHOLD = 1000;
const PAYOUT_WINDOW_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtInr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function quarterEnd(year: number, quarterIndex: number): Date {
  // quarterIndex 0..3 -> last day of Mar/Jun/Sep/Dec
  return new Date(Date.UTC(year, quarterIndex * 3 + 3, 0));
}

// The next payout deadline on or after `today`, and the sales quarter it covers.
export function nextPayout(today: Date) {
  let year = today.getUTCFullYear();
  let q = Math.floor(today.getUTCMonth() / 3) - 1; // most recently completed quarter
  if (q < 0) {
    q = 3;
    year -= 1;
  }
  for (;;) {
    const end = quarterEnd(year, q);
    const deadline = new Date(end.getTime() + PAYOUT_WINDOW_DAYS * DAY_MS);
    if (deadline >= today) {
      const start = new Date(Date.UTC(year, q * 3, 1));
      return { deadline, quarterLabel: `${fmtDate(start)} – ${fmtDate(end)}` };
    }
    q += 1;
    if (q > 3) {
      q = 0;
      year += 1;
    }
  }
}

// A payout is "possibly overdue" when money above the threshold is pending
// and no payout has happened within the last full cycle (quarter + 45 days).
function payoutOverdue(book: Book, today: Date): boolean {
  if (book.royaltyPending < PAYOUT_THRESHOLD) return false;
  const reference = book.lastRoyaltyPayoutAt ?? book.publicationDate;
  if (!reference) return false;
  return today.getTime() - reference.getTime() > (91 + PAYOUT_WINDOW_DAYS) * DAY_MS;
}

export function describeBook(book: Book, today = new Date()): string {
  const lines = [`- "${book.title}" (${book.id}), ISBN ${book.isbn}, ${book.genre}`];
  lines.push(`  Status: ${book.status}`);

  if (book.status !== "Published & Live") {
    lines.push("  Not yet published: no MRP, sales, or royalties yet.");
    return lines.join("\n");
  }

  lines.push(
    `  Published ${book.publicationDate ? fmtDate(book.publicationDate) : "date unknown"}; MRP ${fmtInr(book.mrp ?? 0)}; royalty ${fmtInr(book.authorRoyaltyPerCopy ?? 0)}/copy; print partner ${book.printPartner ?? "n/a"}`,
    `  Available on: ${book.availableOn.join(", ") || "no platforms"}`,
    `  Copies sold ${book.totalCopiesSold}; royalty earned ${fmtInr(book.totalRoyaltyEarned)}, paid ${fmtInr(book.royaltyPaid)}, pending ${fmtInr(book.royaltyPending)}`,
    `  Last payout: ${book.lastRoyaltyPayoutAt ? fmtDate(book.lastRoyaltyPayoutAt) : "never paid"}`,
  );

  if (book.royaltyPending > 0 && book.royaltyPending < PAYOUT_THRESHOLD) {
    lines.push(`  Pending amount is below the ${fmtInr(PAYOUT_THRESHOLD)} threshold, so it rolls over to the next quarter.`);
  }
  if (payoutOverdue(book, today)) {
    lines.push("  FLAG: pending royalty above threshold with no payout in over a full cycle. Possibly overdue; treat as BookLeaf's responsibility to resolve.");
  }
  return lines.join("\n");
}

export function describeAccount(
  input: { authorName: string; books: Book[]; focusBookId: string | null },
  today = new Date(),
): string {
  const payout = nextPayout(today);
  const focus = input.books.find((b) => b.id === input.focusBookId);
  // For book-specific tickets only that book's details are sent; other books
  // are reduced to one line each to keep the prompt small.
  const others = input.books.filter((b) => b.id !== input.focusBookId);
  const totalPending = input.books.reduce((sum, b) => sum + b.royaltyPending, 0);

  const parts = [
    `Today: ${fmtDate(today)}`,
    `Author: ${input.authorName}`,
    `Next royalty payout deadline: ${fmtDate(payout.deadline)} (covers sales from ${payout.quarterLabel})`,
    `Total royalty pending across all books: ${fmtInr(totalPending)}`,
  ];
  if (focus) {
    parts.push(`\nBook this ticket is about:\n${describeBook(focus, today)}`);
    if (others.length) {
      parts.push(`\nOther books by this author: ${others.map((b) => `"${b.title}" (${b.status})`).join("; ")}`);
    }
  } else {
    parts.push(`\nTicket is account-level. Author's books:\n${input.books.map((b) => describeBook(b, today)).join("\n")}`);
  }
  return parts.join("\n");
}

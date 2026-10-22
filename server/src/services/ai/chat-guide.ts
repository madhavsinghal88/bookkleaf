// Answers used when the model is unavailable. They quote the same policies and,
// for authors, the same account figures the model would have been given.
import type { Book } from "../../generated/prisma/client.js";
import { PAYOUT_THRESHOLD, formatDate, formatInr, isPayoutOverdue, nextPayout } from "./facts.js";

function firstName(name: string) {
  return name.split(" ")[0] || name;
}

function mentions(text: string, ...needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

export function salesGuideReply(message: string): string {
  const text = message.toLowerCase();

  if (mentions(text, "royalt", "paid", "payout", "earn", "80", "profit", "money")) {
    return [
      "Royalties are 80% of the net profit on each copy, and BookLeaf keeps 20%. Net profit is the MRP minus the printing cost, the Amazon or Flipkart commission, and shipping — so it is lower than the MRP, which is why a few hundred sales can still produce a modest payout.",
      "We calculate royalties every quarter and pay them by bank transfer within 45 days of the quarter ending. If the balance is under ₹1,000, it rolls into the next quarter.",
      "Once a book is live, those figures show in the Author Portal. If you're already publishing with us, sign in and open My Books. If you're deciding whether to start, tell me whether you want the no-upfront-cost package or the premium one.",
    ].join("\n\n");
  }

  if (mentions(text, "bestseller", "breakthrough", "premium", "marketing", "price", "cost", "fee", "charge", "package", "standard", "free")) {
    return [
      "There are two ways to publish with BookLeaf.",
      "Standard Free has no upfront cost. We still handle the cover, typesetting, an ISBN, printing, distribution, and royalties. BookLeaf is paid from its 20% of net profit.",
      "Bestseller Breakthrough is the paid package. It follows the same publishing path and adds marketing and distribution support. I don't have a current price to quote — the team shares that directly, so I won't guess it.",
      "If you already have a manuscript, write to the BookLeaf team and say which package you want to talk about. If you already publish with us, sign in to the Author Portal.",
    ].join("\n\n");
  }

  if (mentions(text, "how long", "timeline", "when", "stage", "process", "typeset", "cover", "proof", "publish", "live", "week", "month")) {
    return [
      "A book moves through Manuscript Received, Editing if you opt in, Cover Design, Typesetting, Proofreading, ISBN Assignment, Printing, Distribution Setup, and then Published & Live.",
      "The waits we see most often are Cover Design, while we need your approval, and Proofreading, while revisions go back and forth. After the book is published, listings usually appear within 7–10 business days.",
      "If you tell me whether the manuscript is ready, I can point you at the right first step.",
    ].join("\n\n");
  }

  if (mentions(text, "amazon", "flipkart", "distribut", "store", "where", "list", "unavailable")) {
    return [
      "Finished books are listed on Amazon India, Flipkart, Amazon US, Amazon UK, and the BookLeaf Store. A new listing usually goes live within 7–10 business days after publication.",
      "If a live book later shows as unavailable, that is usually a stock sync issue, and the team can re-sync it within 24–48 hours. An existing author can raise that from the Author Portal.",
    ].join("\n\n");
  }

  if (mentions(text, "isbn", "imprint", "metadata")) {
    return [
      "Every book we publish gets its own ISBN, registered under BookLeaf's imprint. If you need the ISBN under your own imprint, that one has to be obtained separately.",
      "A wrong or duplicate ISBN is treated as urgent once the book is in production. Description updates after a book is live usually show on the retailers within 3–5 business days.",
    ].join("\n\n");
  }

  if (mentions(text, "print", "quality", "copy", "paper", "binding")) {
    return [
      "Most books are printed at our facility in Delhi. Larger runs or special formats go to Repro India or Epitome Books. A confirmed print run usually takes 5–7 business days.",
      "If author copies arrive with blurred images, bad binding, or colour problems, we reprint them free after you share photos of the copies.",
    ].join("\n\n");
  }

  if (mentions(text, "hello", "hi", "hey", "start", "help", "sign", "account", "join")) {
    return [
      "Hello — I can walk you through publishing with BookLeaf: the two packages, how royalties are calculated, and how a manuscript becomes a live book.",
      "Standard Free has no upfront cost. Bestseller Breakthrough is the paid package with marketing and distribution add-ons.",
      "What are you trying to decide?",
    ].join("\n\n");
  }

  return [
    "BookLeaf publishes books in India and the US. We take the manuscript through cover design, typesetting, an ISBN, printing, and distribution, then pay royalties quarterly.",
    "Standard Free has no upfront cost. Bestseller Breakthrough is the paid package with marketing and distribution add-ons — ask the team for the current price, and I won't invent one.",
    "I can go into royalties, timelines, or where the book gets listed. If you already publish with us, sign in to ask about your own books.",
  ].join("\n\n");
}

function bookLine(book: Book, today: Date): string {
  if (book.status !== "Published & Live") {
    const stage = book.status.replace(/^In Production -\s*/i, "");
    return `${book.title} is still in production, currently at ${stage}. Price and royalties show up here once it is published.`;
  }
  const pending =
    book.royaltyPending > 0 && book.royaltyPending < PAYOUT_THRESHOLD
      ? ` ${formatInr(book.royaltyPending)} is pending, which is under the ${formatInr(PAYOUT_THRESHOLD)} payout threshold, so it rolls to the next quarter.`
      : ` ${formatInr(book.royaltyPending)} is pending.`;
  const overdue = isPayoutOverdue(book, today)
    ? " That pending amount is above the threshold and there hasn't been a payout in over a full cycle, so this needs the finance team."
    : "";
  return `${book.title} is live, with ${book.totalCopiesSold.toLocaleString("en-IN")} copies sold. You've earned ${formatInr(book.totalRoyaltyEarned)}, of which ${formatInr(book.royaltyPaid)} has been paid.${pending}${overdue}`;
}

export function supportGuideReply(message: string, authorName: string, books: Book[], today = new Date()): string {
  const text = message.toLowerCase();
  const name = firstName(authorName);
  const payout = nextPayout(today);
  const mentioned = books.filter(
    (book) => text.includes(book.title.toLowerCase()) || text.includes(book.id.toLowerCase()),
  );
  const focus = mentioned.length > 0 ? mentioned : books;
  const payoutLine = `The next payout deadline is ${formatDate(payout.deadline)}, covering sales from ${payout.quarterLabel}.`;

  if (mentions(text, "royalt", "paid", "payout", "payment", "pending", "earn", "money", "threshold")) {
    const overdue = focus.some((book) => isPayoutOverdue(book, today));
    return [
      `Hi ${name} — royalties are calculated each quarter and paid by bank transfer within 45 days of the quarter ending. ${payoutLine}`,
      focus.map((book) => bookLine(book, today)).join("\n\n"),
      overdue
        ? "Please open a query with New Query and we'll have finance check this within 48 hours."
        : "The same figures are on My Books. If a number looks wrong, open a query and we'll send a line-by-line breakdown.",
    ].join("\n\n");
  }

  if (mentions(text, "status", "stage", "production", "typeset", "cover", "proof", "when", "progress", "publish")) {
    return [
      `Hi ${name} — here's where your books stand.`,
      focus.map((book) => bookLine(book, today)).join("\n\n"),
      "Cover Design usually waits on your approval of the cover, and Proofreading waits on revision rounds. If a stage has been still for longer than you expected, open a query and we'll send a specific updated timeline.",
    ].join("\n\n");
  }

  if (mentions(text, "amazon", "flipkart", "unavailable", "listing", "distribut", "stock", "where")) {
    const listed = focus.filter((book) => book.availableOn.length > 0);
    const lines = listed.length
      ? listed.map((book) => `${book.title} is on ${book.availableOn.join(", ")}.`).join(" ")
      : "None of these books are on retailer listings yet, which fits a book that is still in production.";
    return [
      `Hi ${name}. ${lines}`,
      "A new listing usually appears within 7–10 business days after publication. If a live book shows as unavailable, that is usually a stock sync issue — open a query and the distribution team can re-sync it within 24–48 hours.",
    ].join("\n\n");
  }

  if (mentions(text, "isbn", "metadata", "description", "bio")) {
    const isbn = focus.map((book) => `${book.title}: ${book.isbn}`).join("; ");
    return [
      `Hi ${name}. The ISBN we have on file — ${isbn} — is registered under BookLeaf's imprint.`,
      "If a retailer shows a different ISBN, that's a high-priority data issue. Open a query and we'll escalate it to production with a 48-hour timeline. Description or bio updates usually appear within 3–5 business days.",
    ].join("\n\n");
  }

  if (mentions(text, "print", "quality", "misprint", "blur", "binding", "defect", "copy")) {
    const partners = [...new Set(focus.map((book) => book.printPartner).filter(Boolean))];
    const who = partners.length ? ` Recent copies were printed by ${partners.join(" and ")}.` : "";
    return [
      `Hi ${name} — I'm sorry if a copy isn't up to standard.${who}`,
      "Please open a query and attach photos of the pages (the file name is enough for now). Once we verify the defect, we arrange a free reprint, usually within 5–7 business days.",
    ].join("\n\n");
  }

  if (mentions(text, "package", "bestseller", "standard free", "price", "cost")) {
    return [
      `Hi ${name}. Standard Free has no upfront cost. Bestseller Breakthrough is the paid package with marketing and distribution add-ons; the team quotes the current price, so I won't guess it.`,
      "Both include cover design, typesetting, an ISBN, printing, distribution, and royalty management. If you want to move a book onto the premium package, open a query and the team will confirm what's included.",
    ].join("\n\n");
  }

  const overview = books.length
    ? books.map((book) => bookLine(book, today)).join("\n\n")
    : "You don't have any books on this account yet.";
  return [
    `Hi ${name}. ${payoutLine}`,
    overview,
    "Ask me about a royalty, a production stage, an ISBN, print quality, or where a book is listed. If the team needs to change something, use New Query.",
  ].join("\n\n");
}

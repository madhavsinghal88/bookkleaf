// Keyword-based classification used when the AI is unavailable. Deliberately
// simple and predictable: it only has to put a ticket in a sensible queue
// position until an admin looks at it.
import type { Book, TicketCategory, TicketPriority } from "../../generated/prisma/client.js";
import { PAYOUT_THRESHOLD } from "./facts.js";

// First match wins, so the most specific / most common money topics go first.
// Bio and description edits are intentionally left to GENERAL_INQUIRY, matching
// the Knowledge Base's own example.
const CATEGORY_RULES: [TicketCategory, RegExp][] = [
  ["ROYALTY_PAYMENTS", /\b(royalt(y|ies)|payments?|payouts?|paid|bank|money|earnings?|statement)\b|₹/i],
  ["ISBN_METADATA", /\b(isbn|metadata|wrong (book|title|author) (linked|listed)|duplicate)\b/i],
  ["PRINTING_QUALITY", /\b(print(ing|ed)? quality|binding|misprint|blurry|misaligned|pages? (are|were|is) (missing|torn|blank)|torn|smudged|defect(ive)?|reprint|author copies)\b/i],
  ["DISTRIBUTION_AVAILABILITY", /\b(amazon|flipkart|unavailable|out of stock|listing|not (showing|available|live)|store|distribution)\b/i],
  ["BOOK_STATUS_PRODUCTION", /\b(status|typesetting|proof(read|s)?|cover design|editing|production|when will|timeline|delay(ed)?)\b/i],
];

const CRITICAL = /\b(legal|lawyer|fraud|scam|copyright|plagiar\w*|police|consumer court)\b/i;
const URGENT = /\b(urgent|asap|immediately|months?|never (received|got)|still (not|haven'?t)|no response|frustrat\w*|unacceptable)\b/i;
const LOW = /\b(how (do|can) i|can i|update (my )?(bio|description)|question|curious|wondering)\b/i;

export function classifyByRules(
  subject: string,
  description: string,
  book: Book | null,
): { category: TicketCategory; priority: TicketPriority; summary: string } {
  const text = `${subject}\n${description}`;
  const category = CATEGORY_RULES.find(([, re]) => re.test(text))?.[0] ?? "GENERAL_INQUIRY";

  let priority: TicketPriority = "MEDIUM";
  if (CRITICAL.test(text)) priority = "CRITICAL";
  else if (category === "ISBN_METADATA" && /\b(isbn|wrong|duplicate)\b/i.test(text)) priority = "HIGH"; // policy: ISBN errors are high priority
  else if (category === "PRINTING_QUALITY") priority = "HIGH";
  else if (URGENT.test(text)) priority = "HIGH";
  else if (LOW.test(text)) priority = "LOW";

  // Money owed and never paid is escalated regardless of wording.
  if (
    category === "ROYALTY_PAYMENTS" &&
    book &&
    book.royaltyPending >= PAYOUT_THRESHOLD &&
    !book.lastRoyaltyPayoutAt &&
    priority !== "CRITICAL"
  ) {
    priority = "HIGH";
  }

  // Without a model to summarise, the author's own subject line is the best summary.
  return { category, priority, summary: subject.slice(0, 140) };
}

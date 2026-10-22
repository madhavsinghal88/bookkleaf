// The BookLeaf Knowledge Base, split into sections so each AI call only
// carries the policy that is relevant to the ticket's category.
//
// Cost note: the base (persona + tone + company overview) is identical for
// every draft, and each category section is identical for every ticket in that
// category. Both are sent as separate cached system blocks, so repeat calls
// read them from the prompt cache instead of paying full input price.
import type { TicketCategory } from "../../generated/prisma/client.js";

export const COMPANY_OVERVIEW = `## Company overview
- BookLeaf Publishing is a self-publishing company operating in India and the US.
- Publishing packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid package with marketing and distribution add-ons).
- BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution, and royalty management for authors.
- In-house printing facility and warehouse in Delhi. Print partners: Repro India and Epitome Books.`;

export const TONE_GUIDELINES = `## How BookLeaf communicates with authors
- Always empathetic and professional. Authors are our partners, not customers to be managed.
- Acknowledge the author's concern before jumping to solutions.
- Be specific: include actual numbers, dates, and statuses wherever possible rather than vague reassurances.
- If something is BookLeaf's fault (delayed royalties, ISBN error), own it directly. No corporate deflection.
- If the issue requires escalation or investigation, give a clear timeline ("Our team will look into this and get back to you within 48 hours") rather than open-ended promises.
- Always end with a clear next step for the author and/or the BookLeaf team.`;

interface CategoryKnowledge {
  label: string;
  policy: string;
  example: { query: string; guidance: string }[];
}

export const CATEGORY_KNOWLEDGE: Record<TicketCategory, CategoryKnowledge> = {
  ROYALTY_PAYMENTS: {
    label: "Royalty & Payments",
    policy: `## Royalty policy
- 80/20 royalty split: 80% of the net profit per book goes to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart), and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold: ₹1,000. Accumulated royalties below this roll over to the next quarter.
- Payouts are made via bank transfer to the account linked in the author's dashboard.
- Authors can view a detailed royalty breakdown in their dashboard, showing sales figures per platform.`,
    example: [
      {
        query: "I published my book 4 months ago and still haven't received any royalty. What's going on?",
        guidance:
          "Acknowledge the frustration. Explain the quarterly royalty cycle and 45-day payout window. Check if their bank details are linked. Provide the specific next payout date. If the payment is genuinely overdue, escalate with a 48-hour resolution timeline.",
      },
      {
        query: "My royalty amount seems too low. I sold 200 copies but only received ₹3,000.",
        guidance:
          "Explain the net profit calculation: MRP minus printing, platform commission, and shipping. Offer to share a detailed line-by-line royalty breakdown. Don't be defensive; offer transparency.",
      },
    ],
  },
  ISBN_METADATA: {
    label: "ISBN & Metadata Issues",
    policy: `## ISBN policy
- Every book published through BookLeaf receives a unique ISBN assigned by BookLeaf.
- ISBNs are registered under BookLeaf's publisher imprint. Authors who want an ISBN under their own imprint must obtain it independently.
- An ISBN error (duplicate, wrong book linked) is a high-priority issue and is escalated to the production team.
- Metadata updates (description, bio, keywords) can be submitted through the dashboard or by emailing the BookLeaf team; changes typically reflect on platforms within 3–5 business days.`,
    example: [
      {
        query: "My book is showing a different ISBN on Amazon than what's on the physical copy.",
        guidance:
          "Treat as high priority. Acknowledge this is a serious data issue. Confirm you are escalating to the production team immediately. Provide a 48-hour resolution timeline.",
      },
    ],
  },
  PRINTING_QUALITY: {
    label: "Printing & Quality",
    policy: `## Printing & quality
- In-house printing handles most orders. Overflow or specific format requirements go to Repro India or Epitome Books.
- Standard print turnaround: 5–7 business days from order confirmation.
- For quality issues (misprints, binding defects, colour inconsistency), BookLeaf arranges a free reprint after verification. The author may need to share photos of the defective copy.`,
    example: [
      {
        query: "I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned.",
        guidance:
          "Apologise sincerely. Ask the author to share photos of the defective copies. Confirm that BookLeaf will arrange a free reprint once verified. Provide a timeline of 5–7 business days for the reprint.",
      },
    ],
  },
  DISTRIBUTION_AVAILABILITY: {
    label: "Distribution & Availability",
    policy: `## Distribution & availability
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK, and the BookLeaf Store.
- New listings typically go live within 7–10 business days after publication is complete.
- A book showing as unavailable on a platform usually indicates a stock sync issue; BookLeaf's team can trigger a re-sync within 24–48 hours.`,
    example: [
      {
        query: "My book is published but it's showing as \"Currently Unavailable\" on Amazon.",
        guidance:
          "Explain that this is typically a stock sync issue. Confirm you're triggering a re-sync with the distribution team. Set expectation: 24–48 hours for it to go live again.",
      },
    ],
  },
  BOOK_STATUS_PRODUCTION: {
    label: "Book Status & Production Updates",
    policy: `## Production stages
- Stages: Manuscript Received → Editing (if opted) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live.
- Authors are updated at each stage via email.
- Delays typically happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).`,
    example: [
      {
        query: "It's been 3 weeks and my book is still in typesetting. When will it be done?",
        guidance:
          "Check the actual production status. If it's delayed, be honest about why (e.g., waiting on author approval for proofs). Provide a specific updated timeline. Don't blame the author even if the delay is on their side; frame it collaboratively.",
      },
    ],
  },
  GENERAL_INQUIRY: {
    label: "General Inquiry",
    policy: `## General account questions
- Metadata updates (book description, author bio) can be submitted through the dashboard or by emailing the BookLeaf team. Changes typically reflect on platforms within 3–5 business days.
- Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, with marketing and distribution add-ons).`,
    example: [
      {
        query: "Can I update the description of my book on Amazon after it's already live?",
        guidance:
          "Yes, metadata updates can be submitted through the dashboard or by emailing the BookLeaf team. Changes typically reflect on platforms within 3–5 business days.",
      },
    ],
  },
};

export const CATEGORY_LABELS = Object.fromEntries(
  Object.entries(CATEGORY_KNOWLEDGE).map(([key, value]) => [key, value.label]),
) as Record<TicketCategory, string>;

// Policies only, no sample dialogues. Cached once and reused for every author
// chat turn so a question about any topic still has the right rule.
export const SUPPORT_POLICY = Object.values(CATEGORY_KNOWLEDGE)
  .map((section) => section.policy)
  .join("\n\n");

// What a prospective author can be told. Prices that are not listed here must
// not be invented; Bestseller Breakthrough is quoted by the team.
export const SALES_KNOWLEDGE = `## Publishing with BookLeaf
- BookLeaf is a self-publishing company in India and the US. We handle cover design, typesetting, ISBN assignment, printing, distribution, and royalty management.
- Standard Free: no upfront cost. BookLeaf is paid from its 20% share of net profit.
- Bestseller Breakthrough: a paid premium package that adds marketing and wider distribution on top of the same publishing workflow. The current price is quoted by the BookLeaf team. Never invent a price, discount, or inclusion that is not listed here.
- Production stages: Manuscript Received → Editing (if opted) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live.
- Delays usually happen at Cover Design (waiting for the author's approval) and Proofreading (revision rounds).
- Every BookLeaf book gets a unique ISBN under BookLeaf's imprint. An author who wants their own imprint obtains that ISBN independently.
- Listings go on Amazon India, Flipkart, Amazon US, Amazon UK, and the BookLeaf Store, typically within 7–10 business days after publication is complete.
- Printing is in-house in Delhi, with overflow at Repro India or Epitome Books. Standard print turnaround is 5–7 business days. Defective copies are reprinted free after the author shares photos.
- Royalty: 80% of net profit to the author, 20% to BookLeaf. Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart), and shipping. Calculated quarterly and paid within 45 days of the quarter ending, by bank transfer, once the balance reaches ₹1,000.
- This chat cannot create an account or accept a manuscript. A new author starts by writing to the BookLeaf team; an existing author signs in to the Author Portal.`;

export function categorySection(category: TicketCategory): string {
  const kb = CATEGORY_KNOWLEDGE[category];
  const examples = kb.example
    .map((e) => `Author query: "${e.query}"\nHow BookLeaf responds: ${e.guidance}`)
    .join("\n\n");
  return `${kb.policy}\n\n## Reference examples for ${kb.label}\n${examples}`;
}

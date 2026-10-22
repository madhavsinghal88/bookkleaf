// Shapes returned by the REST API (see README "API reference").

export type Role = "AUTHOR" | "ADMIN";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketCategory =
  | "ROYALTY_PAYMENTS"
  | "ISBN_METADATA"
  | "PRINTING_QUALITY"
  | "DISTRIBUTION_AVAILABILITY"
  | "BOOK_STATUS_PRODUCTION"
  | "GENERAL_INQUIRY";
export type TicketPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ClassificationSource = "AI" | "RULES" | "ADMIN";
export type MessageKind = "REPLY" | "INTERNAL_NOTE";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  authorId: string | null;
}

export interface Book {
  id: string;
  authorId: string;
  title: string;
  isbn: string;
  genre: string;
  status: string;
  publicationDate: string | null;
  mrp: number | null;
  authorRoyaltyPerCopy: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  lastRoyaltyPayoutAt: string | null;
  printPartner: string | null;
  availableOn: string[];
}

export interface TicketListItem {
  id: number;
  subject: string;
  status: TicketStatus;
  category: TicketCategory | null;
  categorySource?: ClassificationSource | null;
  priority?: TicketPriority | null;
  prioritySource?: ClassificationSource | null;
  aiSummary?: string | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  book: { id: string; title: string } | null;
  author: { id: string; name: string };
  assignee?: { id: string; name: string } | null;
  replyCount: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TicketMessage {
  id: string;
  kind: MessageKind;
  body: string;
  fromAiDraft: boolean;
  createdAt: string;
  sender: { id: string; name: string; role: Role };
}

export interface TicketDetail {
  id: number;
  subject: string;
  description: string;
  status: TicketStatus;
  category: TicketCategory | null;
  attachmentName: string | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  book: Book | null;
  messages: TicketMessage[];
  // Admin-only fields
  categorySource?: ClassificationSource | null;
  priority?: TicketPriority | null;
  prioritySource?: ClassificationSource | null;
  aiSummary?: string | null;
  classifiedAt?: string | null;
  author?: { id: string; name: string; email: string; city: string | null };
  assignee?: { id: string; name: string } | null;
}

export interface AiStatus {
  enabled: boolean;
  reason: string | null;
}

export interface Draft {
  content: string;
  checklist: string[];
  model: string;
  source: "AI" | "TEMPLATE";
  cached: boolean;
  createdAt: string;
  ai: AiStatus;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
}

export interface AiUsageRow {
  purpose: "CLASSIFY" | "DRAFT";
  calls: number;
  failures: number;
  avgLatencyMs: number | null;
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface Stats {
  tickets: {
    byStatus: Partial<Record<TicketStatus, number>>;
    openByPriority: Partial<Record<TicketPriority | "UNCLASSIFIED", number>>;
    unassignedOpen: number;
  };
  ai: {
    status: AiStatus;
    last30Days: AiUsageRow[];
    classifiedTickets: number;
    categoryOverrideRate: number | null;
    priorityOverrideRate: number | null;
    repliesStartedFromAiDraft: number;
    adminReplies: number;
  };
}

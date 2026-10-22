import type { TicketCategory, TicketPriority, TicketStatus } from "../api/types";

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ROYALTY_PAYMENTS: "Royalty & Payments",
  ISBN_METADATA: "ISBN & Metadata",
  PRINTING_QUALITY: "Printing & Quality",
  DISTRIBUTION_AVAILABILITY: "Distribution & Availability",
  BOOK_STATUS_PRODUCTION: "Book Status & Production",
  GENERAL_INQUIRY: "General Inquiry",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const STATUSES = Object.keys(STATUS_LABELS) as TicketStatus[];
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as TicketCategory[];
export const PRIORITIES = Object.keys(PRIORITY_LABELS) as TicketPriority[];

export const inr = (n: number | null | undefined) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`);

export const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// "3h", "2d": how long a ticket has been waiting.
export function age(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export const isPublished = (status: string) => status === "Published & Live";

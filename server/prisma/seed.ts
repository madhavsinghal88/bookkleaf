// Seeds the database from the provided BookLeaf sample dataset.
// Destructive by design: it resets all data so every run gives the same demo state.
import "dotenv/config";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, MessageKind } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEMO_AUTHOR_PASSWORD = "author123";
const DEMO_ADMIN_PASSWORD = "admin123";

interface SeedBook {
  book_id: string;
  title: string;
  isbn: string;
  genre: string;
  publication_date: string | null;
  status: string;
  mrp: number | null;
  author_royalty_per_copy: number | null;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  print_partner: string | null;
  available_on: string[];
}

interface SeedAuthor {
  author_id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  joined_date: string;
  books: SeedBook[];
}

const ADMINS = [
  { email: "admin@bookleaf.com", name: "Aisha Verma (Support)" },
  { email: "ops@bookleaf.com", name: "Karan Mehta (Operations)" },
];

// Sample tickets so the admin queue is not empty on first login. They are
// left unclassified on purpose: the server's startup sweep classifies them,
// exercising the same AI pipeline as a freshly submitted ticket.
const SAMPLE_TICKETS: {
  authorId: string;
  bookId: string | null;
  subject: string;
  description: string;
  daysAgo: number;
  adminReply?: string;
}[] = [
  {
    authorId: "AUTH003",
    bookId: "BK005",
    subject: "No royalty received since publication",
    description:
      "My book Between Two Temples was published in July 2024 and I can see 67 copies sold, but I have not received a single rupee of royalty yet. It has been over a year. Can someone please explain what is going on?",
    daysAgo: 6,
  },
  {
    authorId: "AUTH002",
    bookId: "BK003",
    subject: "Different ISBN on Amazon vs my printed copy",
    description:
      "The ISBN printed on the back cover of Code & Karma does not match the ISBN shown on the Amazon India listing. Readers are getting confused and I am worried this affects my sales tracking.",
    daysAgo: 3,
  },
  {
    authorId: "AUTH007",
    bookId: "BK013",
    subject: "When will the cover design be ready?",
    description:
      "Midnight in Mysore has been in cover design for quite some time now. Could you share an updated timeline and let me know if anything is needed from my side?",
    daysAgo: 2,
  },
  {
    authorId: "AUTH005",
    bookId: null,
    subject: "Can I update my author bio?",
    description: "I would like to update the author bio that appears on my book listings. How do I do that?",
    daysAgo: 1,
    adminReply:
      "Hi Meera,\n\nThanks for reaching out! Yes, you can update your author bio anytime. Just reply here with the new text and we'll update it across all your listings — changes usually reflect within 3–5 business days.\n\nWarm regards,\nAisha\nBookLeaf Author Support",
  },
];

async function main() {
  const data = JSON.parse(
    readFileSync(new URL("./data/bookleaf_sample_data.json", import.meta.url), "utf8"),
  ) as { authors: SeedAuthor[] };

  // Full reset, including id sequences, so ticket numbers start at #1 again.
  await prisma.$executeRawUnsafe(
    'TRUNCATE "AiCallLog", "AiDraft", "TicketMessage", "Ticket", "Book", "Author", "User" RESTART IDENTITY CASCADE',
  );

  const [authorHash, adminHash] = await Promise.all([
    bcrypt.hash(DEMO_AUTHOR_PASSWORD, 10),
    bcrypt.hash(DEMO_ADMIN_PASSWORD, 10),
  ]);

  const admins = [];
  for (const admin of ADMINS) {
    admins.push(
      await prisma.user.create({
        data: { ...admin, passwordHash: adminHash, role: Role.ADMIN },
      }),
    );
  }

  for (const a of data.authors) {
    await prisma.user.create({
      data: {
        email: a.email,
        name: a.name,
        passwordHash: authorHash,
        role: Role.AUTHOR,
        author: {
          create: {
            id: a.author_id,
            name: a.name,
            email: a.email,
            phone: a.phone,
            city: a.city,
            joinedDate: new Date(a.joined_date),
            books: {
              create: a.books.map((b) => ({
                id: b.book_id,
                title: b.title,
                isbn: b.isbn,
                genre: b.genre,
                status: b.status,
                publicationDate: b.publication_date ? new Date(b.publication_date) : null,
                mrp: b.mrp,
                authorRoyaltyPerCopy: b.author_royalty_per_copy,
                totalCopiesSold: b.total_copies_sold,
                totalRoyaltyEarned: b.total_royalty_earned,
                royaltyPaid: b.royalty_paid,
                royaltyPending: b.royalty_pending,
                lastRoyaltyPayoutAt: b.last_royalty_payout_date
                  ? new Date(b.last_royalty_payout_date)
                  : null,
                printPartner: b.print_partner,
                availableOn: b.available_on,
              })),
            },
          },
        },
      },
    });
  }

  for (const t of SAMPLE_TICKETS) {
    const createdAt = new Date(Date.now() - t.daysAgo * 24 * 60 * 60 * 1000);
    const ticket = await prisma.ticket.create({
      data: {
        authorId: t.authorId,
        bookId: t.bookId,
        subject: t.subject,
        description: t.description,
        createdAt,
      },
    });

    if (t.adminReply) {
      const repliedAt = new Date(createdAt.getTime() + 3 * 60 * 60 * 1000);
      await prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: admins[0].id,
          kind: MessageKind.REPLY,
          body: t.adminReply,
          createdAt: repliedAt,
        },
      });
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "RESOLVED", firstResponseAt: repliedAt, resolvedAt: repliedAt },
      });
    }
  }

  const bookCount = await prisma.book.count();
  console.log(
    `Seeded ${data.authors.length} authors, ${bookCount} books, ${ADMINS.length} admins, ${SAMPLE_TICKETS.length} tickets.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

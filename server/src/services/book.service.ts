import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";
import type { AuthUser } from "../middleware/auth.js";

// Authors only ever see their own books; admins see all (optionally per author).
export async function listBooks(user: AuthUser, filter: { authorId?: string }) {
  const authorId = user.role === "AUTHOR" ? user.authorId! : filter.authorId;
  return prisma.book.findMany({
    where: authorId ? { authorId } : undefined,
    orderBy: [{ publicationDate: { sort: "desc", nulls: "first" } }, { title: "asc" }],
    include: user.role === "ADMIN" ? { author: { select: { id: true, name: true } } } : undefined,
  });
}

export async function getBook(user: AuthUser, bookId: string) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  // Same 404 for "doesn't exist" and "not yours", so ids can't be probed.
  if (!book || (user.role === "AUTHOR" && book.authorId !== user.authorId)) {
    throw notFound("Book");
  }
  return book;
}

import { Router } from "express";
import { z } from "zod";
import { parse } from "../lib/validate.js";
import { currentUser } from "../middleware/auth.js";
import * as bookService from "../services/book.service.js";

const ListQuery = z.object({ authorId: z.string().optional() });

export const booksRouter = Router();

// GET /api/books -> author: own books; admin: all books (?authorId= to filter)
booksRouter.get("/", async (req, res) => {
  const query = parse(ListQuery, req.query);
  res.json({ items: await bookService.listBooks(currentUser(req), query) });
});

// GET /api/books/:id
booksRouter.get("/:id", async (req, res) => {
  res.json(await bookService.getBook(currentUser(req), String(req.params.id)));
});

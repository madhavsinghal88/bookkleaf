import express from "express";
import cors from "cors";
import helmet from "helmet";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { env } from "./config/env.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.routes.js";
import { booksRouter } from "./routes/books.routes.js";
import { ticketsRouter } from "./routes/tickets.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { chatRouter } from "./routes/chat.routes.js";

// Built React app. When it exists (e.g. `npm run build && npm start` on a
// plain Node host) Express serves the UI too. On Vercel the client is its own
// service and express.static is ignored, so this block is inert there.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");

// The app is built separately from index.ts (which only calls listen) so it
// can be imported by tests without opening a port.
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Public: login. Everything below requires a valid token.
  app.use("/api/auth", authRouter);
  // Sales chat is public; support routes on this router enforce auth themselves.
  app.use("/api/chat", chatRouter);
  app.use("/api/books", requireAuth, booksRouter);
  app.use("/api/tickets", requireAuth, ticketsRouter);
  app.use("/api/admin", requireAuth, requireRole("ADMIN"), adminRouter);
  app.use("/api", notFoundHandler);

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // Client-side routing: any non-API GET falls back to index.html.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { env } from "./config/env.js";

// Built React app. When it exists (e.g. `npm run build && npm start` on a
// plain Node host) Express serves the UI too. On Vercel the client is its own
// service and express.static is ignored, so this block is inert there.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");

// The app is built separately from index.ts (which only calls listen) so it
// can be imported by tests without opening a port.
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // Client-side routing: any non-API GET falls back to index.html.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return app;
}

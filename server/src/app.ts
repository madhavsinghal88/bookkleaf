import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";

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

  return app;
}

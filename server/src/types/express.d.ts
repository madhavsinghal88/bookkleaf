import type { AuthUser } from "../middleware/auth.js";

declare module "express-serve-static-core" {
  interface Request {
    // Set by requireAuth; present on every authenticated route.
    user?: AuthUser;
  }
}

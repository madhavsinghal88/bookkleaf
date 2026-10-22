import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

// On Vercel the platform invokes the exported app as a function; locally we
// run a normal HTTP server.
if (!process.env.VERCEL) {
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

export default app;

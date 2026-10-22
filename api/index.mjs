// Vercel serverless entry point. The Express app is compiled to server/dist
// during the build; Vercel wraps it as a single function serving /api/*.
import { createApp } from "../server/dist/app.js";

export default createApp();

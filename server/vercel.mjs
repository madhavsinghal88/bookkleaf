// Vercel entrypoint for the API service.
// The build bundles src/ into dist/server.mjs; the .mjs extension guarantees
// Node loads it as an ES module regardless of how the function is packaged.
export { default } from "./dist/server.mjs";

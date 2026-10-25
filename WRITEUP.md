# Approach: BookLeaf Author Support Portal

## What I prioritised

1. **The core ticket loop, end to end.**
   - An author raises a query.
   - The ticket is classified and lands in the queue in the right position.
   - An admin opens it, reviews an AI draft and sends a reply.
   - The author sees the reply live.

   Everything else was built around this loop.
2. **AI that's correct, not just fluent.** The most dangerous failure for a support tool is a confident, wrong number. So the server computes the facts in code and the model only writes:
   - the next payout date (quarterly cycle + 45 days)
   - whether a balance is below the ₹1,000 threshold
   - whether a payout looks overdue

   The knowledge base is split by category, so each prompt carries only the relevant policy and its sample response.
3. **Graceful degradation as a first-class path.** I built and tested the "no AI" path first:
   - Keyword rules classify tickets.
   - Category templates give the agent a starting draft.
   - A circuit breaker stops users waiting on retries during an outage.
   - Ticket creation never waits on the AI.

   The live app works with or without an API key.
4. **Cost you can see.**
   - `gpt-4o-mini` does classification, live chat, and drafts. Drafts are still generated once per conversation state.
   - Static prompt blocks are cached, and history is capped.
   - Each draft is generated once per conversation state.
   - Every call is logged, so the Insights page shows real spend and how often admins override the AI.

## Trade-offs

- **Polling over WebSockets.** Serverless hosting can't hold connections open. Polling every 5 seconds with ETag/304 responses is cheap and simple, and replies appeared in about 4 seconds in testing. A managed realtime service is the upgrade path.
- **Category-scoped knowledge base instead of embedding retrieval.** The knowledge base is small and structured, so routing by the predicted category is cheaper, deterministic, and easy to explain. If a ticket is misclassified, the admin fixes the category and regenerates the draft.
- **Drafts are always reviewed by a human, never auto-sent.** That's the right default until accuracy has been measured on real tickets.
- **Not built in 4 days:** a real file upload pipeline, cookie-based sessions, an automated test suite, and a formal eval set.

## Evolving it into a production system

- **Measure the AI.**
  - Build a labelled eval set from real tickets, tracking classification accuracy, priority agreement, and how much admins edit drafts.
  - Use the admin override rate as the live signal.
  - Tune the prompts against the eval set before changing models.
- **Make background work durable.** Move classification to a queue with retries, which replaces the per-instance safeguards, and share the circuit breaker through Redis.
- **Close the loop with operations.**
  - Turn checklist items ("trigger re-sync", "escalate to finance") into real tasks with SLAs.
  - Add SLA timers and breach alerts to the queue.
  - Email authors when a reply is posted.
- **Use richer context.** Pull live data from finance (payout ledger), production (stage timestamps) and distribution (stock sync) so drafts quote verified, current facts. Add retrieval once the knowledge base grows.
- **Harden security and scale.** Use httpOnly cookie sessions, password reset, rate limiting, audit logs on admin actions, attachment uploads with virus scanning, and pagination and indexing tuned to 22,000+ titles.

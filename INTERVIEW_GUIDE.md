# Audience Builder interview prep

## A strong system-design question

**“Design a CDP audience builder that lets a marketer combine profile attributes
with recent events, preview eligible people, and activate the audience to a
destination. How would you model the data and rules, keep previews correct at
scale, and ensure consent and activation are safe?”**

This is a useful question for the supplied job description because it tests
customer identity, segmentation, data systems, product UX, AI, and operational
safety together—not just React or endpoint trivia.

## Answer outline

1. **Clarify semantics and scale.** Ask about batch versus streaming freshness,
   profile/event volumes, latency and preview accuracy targets, identity
   resolution, late/duplicate events, audience membership churn, consent scope,
   and activation destinations.
2. **Separate the source of truth from serving paths.** Store governed event
   history and curated profile facts in a lakehouse such as Delta/Databricks;
   use a low-latency serving/index path for previews only if latency needs it.
   Keep identity edges and source provenance explicit. Do not treat a cache as
   the authoritative consent or audience record.
3. **Represent rules as a typed, versioned AST/DSL.** Define profile predicates,
   event existence/count/order/window predicates, `AND`/`OR`/`NOT`, exclusions,
   timezone and anchor-time semantics. Validate field types, operator support,
   maximum windows, and compile to a controlled query plan rather than
   accepting arbitrary SQL.
4. **Make preview honest.** Return a snapshot/evaluation timestamp, audience
   definition version, counts, sample members, per-rule explanations, and
   freshness/approximation metadata. Apply the same normalized rule semantics
   in preview and production evaluation; define late-event and deduplication
   behavior.
5. **Use events responsibly.** Ingest via Kafka/Event Hubs with schema
   validation, idempotent event IDs, partitioning by identity, retry and
   dead-letter policy, replay support, and consumer-lag/quality metrics.
6. **Treat activation as a job.** Validate the destination and consent at
   export time, snapshot the audience version, map identifiers, write an
   idempotent job/outbox record, deliver asynchronously, and track accepted,
   rejected, retried, and suppressed counts. Minimize PII in logs and make
   retries safe.
7. **Constrain AI assistance.** Have a model propose a typed rule draft, never
   execute generated SQL. Validate against the same schema and policy engine,
   explain each inferred condition, show preview impact, require human approval,
   and audit the accepted definition. Apply data minimization and prompt-injection
   defenses.
8. **Measure correctness and experience.** Test rule truth tables, event-window
   boundaries, timezone transitions, identity merges, consent revocation,
   duplicate/late events, preview/export parity, and activation retries. Track
   preview latency, audience freshness, event lag, export success, and
   suppression counts.

## A grounded 60-second project answer

> “For this practice build, I modeled ten synthetic customer profiles and
> timestamped web, mobile, and booking events. I joined CRM and intent
> enrichment using `customer_id`, then implemented the audience as explicit
> consent, loyalty-or-intent, recent-search, recent-abandonment, and recent-booking
> suppression checks. The API returns both qualified profiles and per-condition
> explanations, and the UI lets me vary the anchor date and event windows. I
> added a deterministic rule-draft interaction and count-only destination
> simulation to demonstrate those workflows, but I’m clear those are not a
> production LLM or live connector. For production I’d version the rule
> definition, evaluate over governed event data, enforce consent again at
> activation, and deliver through an idempotent job/outbox with audit and retry
> state.”

Replace “I built” with only the work you have actually run and can explain.
PostgreSQL here is the local demo store; it is not Adobe Experience Platform,
Databricks, Kafka, Redis, or an activated destination.

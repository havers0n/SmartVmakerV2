# Scrimspec – Full Architecture & Product Audit
**Date:** 2025-11-21
**Version:** 1.1.0 (Revised based on Deep Domain Review)

---

## 1. High-Level Product Summary
**Scrimspec** (also known as "AEC Studio") is not just a pipeline; it is an **End-to-End Automated Video Generation Factory**.

It solves the problem of "blind" video generation by implementing a **Two-Phase Design**:
1.  **Phase 1: Semantic Extraction (Ingestion & Analysis)**: It doesn't just "download" videos; it deconstructs viral content into atomic **Semantic Units** (Beats, Hooks, Emotional Anchors).
2.  **Phase 2: Generative Synthesis (Generation)**: It uses these extracted "Emotional Architectures" (AES) to mathematically reconstruct new, high-performing content.

- **For Whom:** High-volume automated media channels and data-driven content creators.
- **Unique Value:** Unlike generic "Text-to-Video" tools, Scrimspec understands **Narrative Arcs**. It treats video as a structured sequence of emotional stimuli, not just a stream of pixels.
- **Domain Resemblance:** A hybrid of a **High-Frequency Trading System** (for attention/virality) and a **Procedural Content Generation Engine**.

---

## 2. System Architecture Review
The system is a **pnpm monorepo** using **TurboRepo**, structured to support this two-phase factory model.

### Structure & Boundaries
- **`apps/dashboard`**: The Mission Control. It visualizes the "assembly line" of video generation.
- **`packages/workers`**: The Factory Floor. Stateless workers specialized by phase:
    - *Extraction Phase*: `ingest`, `analysis` (Gemini/AES).
    - *Synthesis Phase*: `keyframe`, `animation` (MiniMax/Runway).
- **`packages/db`**: The Warehouse. Stores not just data, but the *structural blueprints* (Schemas/Templates) for content.

### Dataflow (The "Async Action Runner" Pattern)
1.  **Trigger**: User selects a `Story Template` (Narrative Arc).
2.  **Orchestration**: `POST /api/actions` initiates the pipeline.
3.  **Phase 1 (Extraction)**:
    - `ingest-worker` finds reference material.
    - `analysis-worker` breaks it down into **Beats** and **Emotional Anchors**.
4.  **Phase 2 (Synthesis)**:
    - `keyframe-worker` clusters frames and generates visual anchors.
    - `animation-worker` interpolates between anchors to create fluid narrative flow.
5.  **Delivery**: Final video is assembled and stored.

### Scalability Patterns
- **Stateless Workers**: Workers are pure functions of `(Job) -> Result`.
- **Database as Queue (Reality Check)**: The system uses Postgres with `SKIP LOCKED`.
    - **Capacity**: Realistically **1,000 - 2,000 jobs/sec**.
    - **Bottleneck**: Beyond this, row contention on the `jobs` tables will degrade performance.
    - **Verdict**: Sufficient for "Company Scale" (1M jobs/month), but **NOT** "Web Scale" (10k+ jobs/sec) without sharding or moving to Redis/Kafka.

---

## 3. Domain Architecture & DDD Analysis
The system implements a sophisticated **Semantic Video Domain**. The previous audit missed the depth of these concepts:

- **Core Domain Concepts**:
    - **Semantic Units**: The video is treated as a tree of meaningful segments, not a flat timeline.
    - **Beats**: The atomic unit of pacing. A "Beat" is a time-bound segment with a specific *intended impact*.
    - **Emotional Anchors**: Key moments (visual or auditory) designed to spike user retention (Dopamine hits).
    - **Narrative Arcs**: Represented by `story_templates`. These are the "recipes" for virality (e.g., "Hook -> Conflict -> Resolution").
    - **Frame Clustering**: The logic (likely in `keyframe-worker`) that groups visual data to ensure consistency across the generated video.

- **Bounded Contexts**:
    - **Virality Context**: `youtube_videos`, `view_count`, `retention_graphs`. Focus: "What works?"
    - **Structure Context**: `beats`, `story_templates`, `aes_core`. Focus: "How is it built?"
    - **Production Context**: `assets`, `generation_projects`. Focus: "Rendering the output."

- **Critique**: The domain model is strong because it codifies *artistic intuition* into *database constraints*.

---

## 4. Database, Schema & Data Contracts
- **Schema-First**: **Excellent.** `schema.ts` is the single source of truth.
- **Migration Quality**: Mature "flattening" strategy.
- **Naming**: Consistent `snake_case` in DB.
- **Constraints**: Good use of Foreign Keys.
- **Indexing**: Critical indexes present for queue performance.
- **Concurrency**: `FOR UPDATE SKIP LOCKED` is correctly implemented for the current scale target.

---

## 5. AI Integration Architecture
- **Isolation**: AI providers (`ai_providers`) are treated as interchangeable "batteries" for the factory.
- **Contracts**: The system enforces **Structured Output**. It demands JSON from LLMs (Gemini) to map unstructured video content into the strict `Beat` / `Anchor` domain model.
- **Safety**: The `analysis-worker`'s fallback parsing logic (JSON vs Markdown) is a crucial "glue" layer between deterministic code and probabilistic AI.
- **Rate Limits**: **Critical Gap.** No global rate limiter. A burst of "Analysis" jobs will instantly exhaust Gemini quotas.

---

## 6. Pipeline Robustness Analysis
- **Failure Modes**:
    - **Partial Failure**: If `keyframe` generation fails for Beat #3, does the whole video fail? The current schema suggests yes (`status: failed`). A more robust design would allow "partial rendering" or "placeholder beats".
    - **Zombie Jobs**: Lack of `idle_in_transaction_session_timeout` handling means crashed workers could leave jobs locked.
- **Bottlenecks**: The **Database Write Throughput**. At high load, writing analysis results (heavy JSONB) + updating queue status + reading new jobs will saturate IOPS.

---

## 7. Code Quality & Tooling
- **TypeScript**: Strict.
- **Structure**: Clean monorepo.
- **Readability**: High.
- **DX**: Manual startup is a friction point.

---

## 8. Security & RLS Analysis
- **Auth Boundaries**: API (`/api/actions`) lacks strict session enforcement middleware.
- **Worker Access**: Workers bypass RLS. This is acceptable *if* the workers are trusted, but they must validate all inputs to prevent "poisoned job" attacks.

---

## 9. Testing Strategy & Failure Scenarios
**CRITICAL WEAKNESS.**
- **Coverage**: **Zero tests** for the complex Domain Logic (Beat extraction, Frame clustering).
- **Risk**: The system relies on "Implicit Knowledge" inside the worker code. If the logic for "what constitutes a valid Hook" changes, there are no tests to verify it.

---

## 10. Documentation, Onboarding & DX
- **Accuracy**: High.
- **Mental Model**: Clear.
- **Friction**: Setup is scripted but requires multiple manual steps.

---

## 11. High Priority Findings (Critical Risks)
1.  **Zero Test Coverage on Domain Logic**: The "Secret Sauce" (AES, Beat extraction) is untested.
    *   *Risk*: High. Loss of intellectual property integrity during refactors.
2.  **Scalability Misconception**: Postgres Queue is good for ~1k jobs/sec, not 10k.
    *   *Risk*: Medium. System will choke under "Viral Load" without architectural changes (Sharding/Redis).
3.  **Missing Global Rate Limiting**: Workers will DDoS your own AI provider accounts.
    *   *Risk*: High. Service disruption.
4.  **Security/Auth on API**: API is effectively open to anyone who can reach the endpoint.

---

## 12. Medium Priority Findings
1.  **Zombie Job Handling**: Need a "Reaper" process for stuck jobs.
2.  **Database Growth**: `analysis_results` (JSONB) will grow massive. Needs partitioning strategy.
3.  **Hardcoded Prompts**: Prompts defining "Beats" should be versioned in the DB, not code.

---

## 13. Low Priority / Cosmetic
1.  **Russian Documentation**: `ARCHITECTURE.md` is in Russian.
2.  **Manual Startup**: Docker Compose needed.

---

## 14. Final Verdict

**Overall Integrity:** **A- (Domain Vision) / C (Implementation Maturity)**

**Strengths:**
The **Domain Vision** is exceptional. You are not building a "wrapper around OpenAI"; you are building a **Computational Creativity Engine** based on a deep understanding of video structure (AES). The **Two-Phase Design** correctly separates "Understanding" from "Creation".

**Weaknesses:**
The **Implementation** underestimates the complexity of operating this at scale.
1.  **Scalability**: You are betting on Postgres `SKIP LOCKED` for a workload that might behave like a high-frequency trading system (10k+ events). You need a plan for when Postgres chokes.
2.  **Reliability**: The lack of tests for the *Semantic* logic means the system is fragile.

**Revised Roadmap:**
1.  **Solidify the Domain**: Extract "Beat Detection" and "Frame Clustering" logic into pure, tested functions in `packages/core-domain`.
2.  **Protect the Pipes**: Implement Redis-based Rate Limiting immediately.
3.  **Prepare for Scale**: Design the "Escape Hatch" from Postgres Queue to Redis/Kafka now, so you aren't rewriting the whole system when you hit 2k jobs/sec.

**Verdict:** You have a Ferrari engine (AES Domain) inside a prototype chassis. Reinforce the chassis (Tests, Rate Limits, Queue Strategy) before hitting the race track.

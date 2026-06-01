# Cleopatra Ink Studio — Progress Tracker

_Last updated: 2026-06-01_

---

## Overall Status: **Core Platform + Print Studio Functional**

Full staff login, role-based access, customer management, session overview, cron cleanup, streaming generation, A4 print/stencil studio, and style-accurate AI generation are all live.

---

## Completed

### Infrastructure & Auth
- [x] Next.js App Router + TypeScript strict mode
- [x] Supabase Auth (`@supabase/ssr`) — cookie-based staff sessions, 24hr timeout enforced in middleware
- [x] Role-based route protection: unauthenticated → login; designer blocked from `/studio/admin/*`
- [x] Zustand store with localStorage persistence + Supabase hydration

### Database
- [x] `staff` table with `role`, `is_active`, `last_login`, `deleted_at` (soft-delete)
- [x] `sessions`, `tattoo_designs`, `placements`, `users`, `user_preferences` tables
- [x] RLS: admin sees all rows; designer sees only own sessions
- [x] `finalize_session` RPC — marks finalized rows, prunes siblings, marks session completed

### Staff Portal
- [x] `/studio/login` — email+password login, role-based redirect, password visibility toggle
- [x] `/studio/designer` — phone lookup (new/existing customer), recent 5 sessions
- [x] `/studio/admin` — stats, designer list with activate/deactivate, recent sessions
- [x] `/studio/admin/customers` — all customers, live search by name/phone
- [x] `/studio/admin/designers/[id]` — designer profile, stats, session history, password reset
- [x] `/studio/admin/designers/new` — create designer account
- [x] `/studio/admin/settings` — change admin password
- [x] Designer soft-delete — preserves staff row so historical "designed by X" attribution survives; blocks login for deleted accounts
- [x] Designer password reset — admin-only; generates or sets new password, shown once, never persisted

### Session Flow
- [x] Design page — two modes: **AI Design** (style → generate → refine) and **Direct Upload** (existing design)
- [x] Streaming generation — 5 KEI tasks fire in parallel; each result streams to the UI as it completes; per-slot retry on failure; user can proceed while slots are still generating
- [x] Refinement loop — customer feedback + selected variations → new generation
- [x] Placement page — describe or upload body photo → interactive drag/scale/rotate editor → AI composite generation
- [x] `SessionOverview` — shared read-only view (admin + designer): design, reference images, placement, download button
- [x] `/customer/[userId]` — tattoo history with role-validated back navigation

### AI Prompts (`src/lib/prompts.ts`)
- [x] All prompt text consolidated into one file — no prompt logic in route handlers or API clients
- [x] `STYLE_PROMPT_DESCRIPTORS` — 70+ styles each mapped to specific linework, shading, color, composition, feel, and subject descriptors sourced from studio style definitions; injected via `buildStyleBlock()` so the model renders style-accurate output, not just a label
- [x] `buildBodyAreaBlock()` — optional design-time body area hint; injects composition guidance + strict "no anatomy in output" constraint
- [x] `inferCameraFrame()` — maps placement text to photographer framing instructions when no body photo is provided
- [x] Composite placement prompt locks size and position from the customer's editor; clean tattoo design sent as detail reference only, not for recomposition

### Style Selection (`StyleSelect.tsx`)
- [x] Expanded from 30 to 70+ styles organized by category: Black & Grey, Color, Traditional, Realism, Linework, Dotwork, Japanese, Modern, Blackwork, and specialty formats
- [x] Searchable dropdown

### Placement Editor
- [x] Canvas drag/scale/rotate overlay — user positions tattoo on body photo at exact size and angle
- [x] Composite preview displays full body (no crop/zoom) — `object-contain`, no forced aspect ratio
- [x] Composite image sent to AI with size/position locked; clean design sent separately for detail only

### Print / Stencil Studio
- [x] `TattooPrintStudio` — full-screen A4 modal: drag to position, size slider (20–200%), rotation, mirror (default ON for skin transfer)
- [x] Multi-page A4 PDF export — 1/2/4/8 sheet grid; auto-crops empty frame to actual ink; 2mm safe-area margin guide
- [x] WYSIWYG preview matches the exported PDF

### Infrastructure
- [x] Pinterest reference images — uploaded to Supabase Storage immediately; blob URL swapped to permanent URL in background
- [x] Cron cleanup — deletes active sessions older than 24hr + all storage files; runs every 30min via Supabase pg_cron
- [x] Insufficient-credits handling — non-retryable `KeiCreditsError`; clear message shown on both design and placement pages
- [x] `?from=` back navigation — role-validated at destination; admin URLs stripped for designers

---

## Not Started / Remaining

- [ ] Line-art / stencil edge conversion (print design as-is; no thresholding to clean linework)
- [ ] SVG/vector export from print studio
- [ ] AR camera overlay (real-time body preview)
- [ ] Appointment booking integration

---

## Known Issues

- KEI uses a Wikipedia placeholder image when no reference images are provided — functional but low quality
- `finalize_session` RPC has a `user_preferences NOT NULL` edge case — fallback manual sequence in store handles it silently
- Pinterest requires `PINTEREST_ACCESS_TOKEN` env var — silently unavailable if not set
- Cron cleanup requires `pg_cron` + `pg_net` enabled in Supabase Dashboard; cron block in `supabase-schema.sql` must be run manually after deploy

---

## SQL Setup (Fresh Install)
1. Run `supabase-schema.sql` — creates all tables, RLS, functions, storage buckets, seeds admin
2. After deploying: uncomment and run the cron block at the bottom of `supabase-schema.sql`

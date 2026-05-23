# Cleopatra Ink Studio — Progress Tracker

_Last updated: 2026-05-23_

---

## Overall Status: **RBAC Complete — Core Platform Functional**

Full staff login system, role-based access, customer management, session overview, and cron cleanup are all live. The main remaining gap is the stencil editor UI.

---

## Completed

### Infrastructure & Auth
- [x] Next.js App Router + TypeScript strict mode
- [x] `@supabase/ssr` installed — cookie-based staff session management
- [x] `src/lib/supabase-server.ts` — server-only SSR clients + `getStaffSession()`
- [x] `src/lib/supabase-client.ts` — browser-only `createSupabaseBrowserClient()` (safe in client components)
- [x] `src/lib/staff-types.ts` — shared `StaffMember`, `StaffRole` types
- [x] `src/lib/auth-utils.ts` — `getClientRole()`, `resolveBackUrl()` for role-validated back navigation
- [x] `middleware.ts` — full route protection: unauthenticated → login; designer → blocked from `/studio/admin/*`; 24hr session timeout via `last_login`
- [x] Zustand store updated: `designerId`, `setDesignerId`, `replaceReferenceImage`; all Supabase calls use SSR browser client

### Database Schema
- [x] `staff` table — `id` (= auth.users.id), `email`, `name`, `role`, `is_active`, `last_login`
- [x] `sessions.designer_id` FK — tracks which designer owns each session
- [x] `staff.last_login` column — used by middleware for 24hr timeout enforcement
- [x] RLS policies: admin sees all; designer sees only own sessions
- [x] Helper functions: `is_admin()`, `is_designer()`, `get_staff_role()`
- [x] `finalize_session` RPC with fallback manual sequence in store

### Staff Portal — Login
- [x] `/studio/login` — email+password via Supabase Auth, stamps `last_login` on success, role-based redirect
- [x] Session timeout: 24hr hard expiry enforced in middleware via `last_login`; "session expired" message shown
- [x] `/` — logo splash, auto-redirects based on role (no customer-facing buttons)

### Staff Portal — Designer
- [x] `/studio/designer` — dashboard: phone lookup (new/existing customer), recent 5 sessions
- [x] Customer lookup: find by phone → existing → show card + "Start New Design" / "History"; not found → name input → create
- [x] Recent sessions: last 5, click → `SessionOverview`
- [x] `designer_id` stamped on all sessions created from designer dashboard

### Staff Portal — Admin
- [x] `/studio/admin` — stats (Designers, Active, Customers, Final Designs), designer list with toggle, recent 5 sessions
- [x] Designer stat tile is clickable → `/studio/admin/customers`
- [x] `/studio/admin/customers` — all customers, live search by name/phone, session count, last session date
- [x] `/studio/admin/designers/[id]` — designer profile, stats, all sessions with thumbnails
- [x] `/studio/admin/designers/new` — create designer (Supabase Admin API)
- [x] `/studio/admin/settings` — change admin password (validates current first)
- [x] `/studio/admin/sessions/[id]` — server-component wrapper for `SessionOverview`

### Admin API Routes
- [x] `GET /api/studio/designers` — list all staff (admin only, service role)
- [x] `POST /api/studio/designers` — create designer with auth user (admin only)
- [x] `PATCH /api/studio/designers` — toggle `is_active` (admin only, blocks self-deactivation)
- [x] `POST /api/studio/logout` — sign out

### Security — Defense in Depth
- [x] Middleware: primary guard (edge level)
- [x] Server components: `getStaffSession()` + `redirect()` (server level)
- [x] Client components: inline role check in `useEffect` → `router.replace("/studio/designer")` (client level)
- [x] `?from=` param validated via `resolveBackUrl()` — admin URLs stripped for designers
- [x] All admin pages (6 total) secured with all applicable layers

### Shared Session Overview
- [x] `src/components/session/SessionOverview.tsx` — single reusable component used by admin + designer
  - Sections: session card, customer request (style + prompt), reference images (from Storage), approved design, placement (body photo + composite)
  - PDF "Preview Sizes" download button in header
  - Lightbox for every image (click to zoom)
  - Props: `sessionId`, `backUrl`, `backLabel`
- [x] `/studio/sessions/[id]` — designer/shared wrapper (server component, reads `?from=`)
- [x] `/studio/admin/sessions/[id]` — admin wrapper (server component, reads `?from=`, enforces admin role)

### Customer Dashboard
- [x] `/customer/[userId]` — tattoo history list; click → navigates to `/studio/sessions/[id]`
- [x] Back button role-validated: admin → "Admin" / "Customers"; designer → "Dashboard"
- [x] Removed lightbox (replaced by full `SessionOverview` page)

### Back Navigation (`?from=` pattern)
- [x] Every navigation passes `?from=<source-url>`
- [x] Destinations read it and show correct back label + URL
- [x] Role-validated: injecting an admin `from` URL as a designer silently falls back to `/studio/designer`
- [x] Full chain: Admin → Customers → Customer history → Session → correct back at every step

### Prompts Consolidated
- [x] `src/lib/prompts.ts` — ALL AI prompt text lives here (5 functions):
  - `buildInitialDesignPrompt` — first generation
  - `buildRefinementPrompt` — iteration with customer feedback
  - `buildTattooPrompt` — unified entry point (picks initial or refinement)
  - `buildPlacementPrompt` — standard mode (tattoo + body photo)
  - `buildCompositePrompt` — canvas drag-and-drop mode
- [x] `kei-api.ts` — pure HTTP client, no prompt text
- [x] `placement/route.ts` — pure route handler, no prompt text

### Pinterest Reference Images — Storage Persistence
- [x] `POST /api/upload-ref` — uploads base64 to Supabase Storage `refs/` prefix immediately
- [x] `replaceReferenceImage` action in store
- [x] `handleAddPinterestPin` in design page: shows blob URL instantly → uploads to Storage in background → replaces blob URL with permanent URL → revokes blob
- [x] Admin `SessionOverview` now lists Pinterest reference images correctly from Storage

### Session Cleanup (Cron)
- [x] `GET /api/cron/cleanup` — finds `active` sessions older than 3hr, deletes Storage files (`refs/`, `designs/`, `body/`, `composites/`, `previews/`), deletes session rows (cascade)
- [x] Cron setup SQL included in `supabase-schema.sql` (commented section at bottom)
- [x] `CRON_SECRET` env var for request validation

### Store — New Session Clears Old State
- [x] `freshSessionDesignState` constant in store — resets all design/placement fields when `startSession` or `startSessionForUser` is called, preventing old session data bleeding into new sessions via localStorage persistence

### Prompts — Consolidated & Improved
- [x] All 5 prompts rewritten in `src/lib/prompts.ts`: removed hyperbolic quality claims, merged redundant bullets, removed example sentences that caused anchoring
- [x] Composite placement prompt rewritten for 3-image input: composite (position) + clean tattoo design (detail) + body photo (skin/lighting)
- [x] Placement route updated to send all 3 images in composite mode; body photo now uploaded separately and stored in `body/` prefix
- [x] `/api/upload-ref` updated to accept a configurable `prefix` param (`refs` or `designs`)

### Direct Tattoo Upload Mode
- [x] Mode switcher on design page: **✦ AI Design** (default) | **↑ Upload Existing** tabs
- [x] Direct upload flow: drag-drop or camera → image uploaded to `designs/` prefix immediately → preview shown → "Proceed to Placement" → saved via `persistDesigns` → `selectDesign` → navigate to placement
- [x] Camera capture in direct mode uploads as the final design, not a reference image
- [x] Sticky mobile CTA bar hidden in direct mode (not relevant)
- [x] All AI design sections (style picker, description, generation, refinement) hidden when in direct mode

### Session Overview — Conditional Sections
- [x] Customer Request section hidden when both `tattoo_style` and `tattoo_description` are empty
- [x] Reference Images section hidden when no images exist in storage (no empty-state card shown)
- [x] Each field within Customer Request only renders if it has a value

### Login UX Fixes
- [x] `middleware.ts` — `isSessionExpired(null)` now returns `false` (was `true`), fixing "session expired" error that blocked first-time staff login
- [x] `/studio/login` — password visibility toggle (eye icon) added to the password field

### Streaming Image Generation
- [x] `/api/generate` — switched from batch JSON response to NDJSON streaming; each of the 5 KEI tasks emits its result the moment it completes; removed auto-retry logic
- [x] `app-store.ts` — added `addGeneratedDesign(design)` action; `generateDesigns()` now clears previous designs on start; `finishGenerating(designs?)` keeps accumulated designs when called with no args
- [x] Design page — reads the stream line-by-line and appends each image immediately via `addGeneratedDesign`; shows skeleton placeholder cards for pending slots; shows warning cards for failed slots; displays "X of 5 ready · still generating…" status while streaming; failed slots banner with "Retry All" after completion

### Dead Code Removed
- [x] `/new/page.tsx` — orphaned customer intake page (designer dashboard has same logic inline)
- [x] `/returning/page.tsx` — orphaned phone lookup page (designer dashboard has same logic inline)
- [x] `src/lib/placeholder-designs.ts` — dev scaffold for when KEI wasn't wired, never used
- [x] `public/placeholder-ref.jpg` — reference placeholder image, nothing referenced it
- [x] `src/app/api/upload/route.ts` + `src/app/api/images/[id]/route.ts` — legacy in-memory upload pair
- [x] `src/lib/supabase.ts` — legacy anon client (replaced by `supabase-client.ts` + `supabase-server.ts`)
- [x] All stale SQL migration files consolidated into single `supabase-schema.sql`

---

## Not Started / Remaining

- [ ] **Stencil editor UI** — `src/lib/tattoo-pdf.ts` exists but no `/[sessionId]/stencil` page; no line-art conversion, sizing controls, or print UI
- [ ] Multi-page stencil tiling for oversized tattoos
- [ ] SVG/vector export from stencil editor
- [ ] AR camera overlay (real-time body preview)
- [ ] Appointment booking integration


---

## Known Issues / Watch Items

- KEI API uses a Wikipedia image as a placeholder when no reference images are provided — functional but low quality starting point
- `finalize_session` RPC has a known `user_preferences NOT NULL` issue — fallback manual sequence in store handles it silently
- Pinterest requires `PINTEREST_ACCESS_TOKEN` env var — feature silently unavailable if not set
- Cron cleanup requires `pg_cron` + `pg_net` extensions enabled in Supabase Dashboard, and the cron block in `supabase-schema.sql` run manually after deploy with real domain + `CRON_SECRET`

---

## SQL Setup (Fresh Install)
1. Run `supabase-schema.sql` — creates all tables, RLS, functions, storage buckets, seeds admin
2. After deploying the app: uncomment and run the cron block at the bottom of `supabase-schema.sql`

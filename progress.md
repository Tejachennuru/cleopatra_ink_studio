# Cleopatra Ink Studio — Progress Tracker

_Last updated: 2026-05-30_

---

## Overall Status: **Core Platform + Print Studio Functional**

Full staff login system, role-based access, customer management, session overview, cron cleanup, streaming generation, and the A4 print/stencil studio are all live.

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
  - Header "Download" button opens the Print Studio (A4 stencil layout)
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
- [x] `GET /api/cron/cleanup` — finds `active` sessions older than 24hr, deletes Storage files (`refs/`, `designs/`, `body/`, `composites/`, `previews/`), deletes session rows (cascade)
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

### Placement — Smarter Camera Framing (No Body Photo)
- [x] `src/lib/prompts.ts` — added `inferCameraFrame(placement)` helper that maps the placement text to a natural photographer's framing instruction (wrist → arm extended; neck → portrait head/chest; shoulder → three-quarter side portrait; ankle → low-angle foot; back → behind-portrait; etc.). Injected into `buildPlacementPrompt` only when no body photo is uploaded, so the AI generates a close-to-medium focused shot instead of a full-body image.

### Login UX Fixes
- [x] `middleware.ts` — `isSessionExpired(null)` now returns `false` (was `true`), fixing "session expired" error that blocked first-time staff login
- [x] `/studio/login` — password visibility toggle (eye icon) added to the password field

### Streaming Image Generation
- [x] `/api/generate` — switched from batch JSON response to NDJSON streaming; each of the 5 KEI tasks emits its result the moment it completes; removed auto-retry logic
- [x] `app-store.ts` — added `addGeneratedDesign(design)` action; `generateDesigns()` now clears previous designs on start; `finishGenerating(designs?)` keeps accumulated designs when called with no args
- [x] Design page — reads the stream line-by-line and appends each image immediately via `addGeneratedDesign`; shows skeleton placeholder cards for pending slots; shows warning cards for failed slots; displays "X of 5 ready · still generating…" status while streaming; failed slots banner with "Retry All" after completion

### Print / Stencil Studio (A4)
- [x] `src/components/print/TattooPrintStudio.tsx` — full-screen modal replacing the old "Preview Sizes" PDF. Left "lightroom" canvas + right sidebar controls
- [x] A4 sheet count (1/2/4/8) — one tattoo tiled across the grid (portrait-leaning: 1→1×1, 2→1×2, 4→2×2, 8→2×4)
- [x] Size % slider (20–200%) referenced to A4; rotation (0/90/180/270 buttons + fine slider); mirror toggle (default ON — flips for skin transfer so text reads correctly once applied)
- [x] Drag the tattoo to reposition over the sheet grid; preview clipped to the grid (off-sheet content won't print); preview is WYSIWYG for the PDF (same mirror→rotate→center transform)
- [x] `src/lib/tattoo-pdf.ts` rewritten: `computeStencilLayout`, `defaultStencilCenter`, `loadTrimmedStencilImage` (auto-crops the design's empty frame to the actual ink so sizing tracks the real tattoo, not the square frame), `downloadTattooStencilPdf` (multi-page A4 PDF, one sheet per page at 150 DPI, faint assembly labels). Old `downloadTattooSizesPdf` removed
- [x] Fixed preview "stops scaling / drifts left past 100%" — Tailwind Preflight's `img { max-width: 100% }` was capping the element; overridden with `maxWidth/maxHeight: none` on the preview image

### Placement → Nano Banana Pro
- [x] Final body-placement render switched to KEI `nano-banana-pro` (Gemini 3 Pro Image) for higher photorealism; design generation stays `gpt-image-2-image-to-image`
- [x] `createKeiTask(prompt, urls, {model})` — maps `image_input` (nano-banana-pro) vs `input_urls` (gpt-image) field names

### Insufficient-Credits Handling
- [x] `KeiCreditsError` in `kei-api.ts` — thrown on 402 / credit / balance / quota messages at createTask or poll; never retried
- [x] `/api/generate` tags failed slots with `code:"insufficient_credits"`; `/api/placement` returns `402` + same code (no wasted retry)
- [x] Both design + placement UIs show a clear, non-retryable "AI image generation temporarily unavailable — notify staff" message and hide the Retry button for this case

### Pinterest Reference Bug Fix
- [x] After a Pinterest pin's background upload swapped its blob URL → permanent Supabase URL, generation sent that URL through `uploadBase64` and produced empty/garbage reference files. Fixed: design page splits references into base64 (`images[]`) vs already-hosted URLs (`referenceImageUrls[]`); `/api/generate` appends hosted URLs directly. `blobUrlToBase64` now throws on remote URLs instead of silently passing them through

### Generation UX — Per-Slot Retry & Proceed-While-Generating
- [x] Failed slots tracked individually (`failedSlots[]`) with a per-card **Retry** that re-fires a single `count:1` task; replaced the old "Retry All" banner
- [x] User can select a ready design and proceed to placement while other slots are still streaming (removed the `isGenerating` gate on selection/proceed); Refine/Regenerate stay disabled mid-stream (they clear state)

### Session TTL Extended
- [x] Cron cleanup TTL raised from 3hr → 24hr so in-progress sessions aren't wiped mid-use

### Designer Soft Delete
- [x] `staff.deleted_at timestamptz` column added. Hard delete was off the table — `sessions.designer_id` is `ON DELETE SET NULL`, so removing a staff row would wipe every "designed by X" attribution
- [x] `DELETE /api/studio/designers` — sets `deleted_at = now()` + `is_active = false`; refuses self / admin targets
- [x] `GET /api/studio/designers` filters out rows where `deleted_at is not null`
- [x] Login (`/studio/login`), middleware, and `getStaffSession()` all reject `deleted_at != null` so removed designers cannot sign in even if reactivated via direct DB edit
- [x] Admin dashboard — trash-icon button next to each Active toggle; `window.confirm` warning; row removed from local state on success; stats updated client-side. Designer detail page intentionally left accessible so admins can still review a removed designer's historical work
- [x] All session-history displays (admin recent sessions, customer page, `SessionOverview`, designer detail) keep showing the deleted designer's name because the staff row is preserved

### Designer Password Reset
- [x] `PUT /api/studio/designers` — admin-only; updates Supabase Auth password via `service.auth.admin.updateUserById`; **never stored in our DB**; min 6 chars; refuses self / admin / soft-deleted targets
- [x] Designer detail page — "Reset Password" button under the Total Sessions stat; on click reveals an inline card (form is hidden by default)
- [x] Inline form: new-password input with eye-toggle visibility, `Generate` button (12-char crypto-random alphabet avoiding 0/O/1/l/I), Cancel, Set Password
- [x] After success: gold-highlighted panel shows the new password once with a Copy button (1.5s "Copied" confirmation); warning that it disappears on navigate; only held in component state — never persisted

### PDF Stencil Safe-Area Margin
- [x] Client diagnosis: most printers can't print within ~1-2mm of the paper edge, so a full-bleed PDF was silently being cropped along the seams when sheets were tiled
- [x] `STENCIL_MARGIN_MM = 2` constant in `src/lib/tattoo-pdf.ts`. Per-sheet logic draws only exterior-edge segments (no margin lines on interior sheet seams), so taped sheets form one continuous light-grey rectangle around the whole assembled tattoo. Drawn with `doc.line()` as vectors (0.2mm hairline, `#b4b4b4`) — crisp at any zoom
- [x] Matching live-preview overlay in `TattooPrintStudio.tsx` — single absolutely-positioned div with `1px solid #b4b4b4` inset by `STENCIL_MARGIN_MM × scale`
- [x] Guide only — the tattoo is not clipped to the margin; users still see if their composition is going to be cropped by the printer
- [x] Footer caption updated: "Grey border = 2mm printer safe-area"

### Design-Time Body Area Hint
- [x] Client insight: when the AI didn't know the target body part, it tended to produce square compositions that didn't fit narrow placements (forearm, calf) well, then the placement step had to shrink the design to fit
- [x] `sessions.target_body_area text` column added; threaded through store (`targetBodyArea` state, setter, persist, hydrate, Supabase sync in `persistDesigns`)
- [x] `buildBodyAreaBlock()` in `prompts.ts` — when set, injects a `TARGET BODY AREA:` directive (proportions, flow, detail density for the area) AND an aggressive output constraint that explicitly forbids drawing any anatomy in the output (image models tend to draw the limb once you mention it). When unset, falls back to the existing "No body parts" line
- [x] `buildInitialDesignPrompt`, `buildRefinementPrompt`, `buildTattooPrompt` all take optional `targetBodyArea` arg; `/api/generate` accepts it from the payload
- [x] `BodyAreaPicker` UI on the design page between Style and Description: 11 preset chips (Forearm, Upper Arm, Shoulder, Wrist, Chest, Back, Ribs, Thigh, Calf, Ankle, Neck) + a `Custom…` chip that toggles a free-text input. Optional — empty value = no hint, no regression. Threaded into both initial generate and refine payloads (so retries via `lastPayload` carry it too)

### Credits-Exhausted Message Clarity
- [x] Replaced the deliberately-vague "AI image generation is temporarily unavailable. Please notify studio staff to restore the service." with the explicit "AI generation credits are exhausted. Please contact the admin to top up the credits and restore the service." on both the design and placement pages — staff immediately know the fix is topping up credits, not debugging

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

- [ ] Line-art / stencil edge conversion (current studio prints the design as-is, no thresholding to clean linework)
- [ ] SVG/vector export from the print studio
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

# Cleopatra Ink Studio — Agent Reference

## What This Is
AI-powered tattoo design platform for **in-shop use by staff (designers + admin)**. A designer creates or looks up a customer by phone, runs the tattoo design flow (style → generate → refine → placement → finalize), and the admin manages the studio. Customers never log in — the staff acts on their behalf.

## Stack
- **Framework:** Next.js (App Router) + TypeScript strict mode — read `node_modules/next/dist/docs/` before writing any Next.js code. Breaking changes exist.
- **Auth:** Supabase Auth (email + password) via `@supabase/ssr` cookie-based sessions
- **State:** Zustand with localStorage persistence + Supabase hydration (`src/store/app-store.ts`)
- **Database & Storage:** Supabase PostgreSQL + Storage bucket `session-assets`
- **Image Generation:** KEI API (`api.kie.ai`). Design generation uses `gpt-image-2-image-to-image`; the final body-placement render uses `nano-banana-pro` (Gemini 3 Pro Image). NOT Claude or DALL-E.
- **Styling:** Tailwind CSS v4. Dark luxury theme: bg `#0D0D0D`, gold `#C9A84C`, font Cinzel.

---

## Route Map

### Public (no auth)
| Route | Purpose |
|-------|---------|
| `/studio/login` | Staff login (email + password). First page shown to everyone. |

### Staff — shared (designer + admin)
| Route | Purpose |
|-------|---------|
| `/` | Logo splash → auto-redirects based on role |
| `/customer/[userId]` | Customer history (session list). Accepts `?from=` for back navigation. |
| `/studio/sessions/[id]` | Session overview (read-only). Accepts `?from=` for back navigation. |
| `/[sessionId]/design` | Design flow: AI mode (style → generate → refine) OR Direct Upload mode (upload existing design) |
| `/[sessionId]/placement` | Body placement canvas + composite generation |

### Designer only
| Route | Purpose |
|-------|---------|
| `/studio/designer` | Designer dashboard: phone lookup, new customer, recent 5 sessions |

### Admin only (`/studio/admin/*`)
| Route | Purpose |
|-------|---------|
| `/studio/admin` | Overview: stats, designer list, recent 5 sessions |
| `/studio/admin/customers` | All customers with live search by name/phone |
| `/studio/admin/sessions/[id]` | Admin session overview. Accepts `?from=` for back navigation. |
| `/studio/admin/designers/[id]` | Designer detail: profile, all their sessions + design thumbnails |
| `/studio/admin/designers/new` | Create new designer account |
| `/studio/admin/settings` | Change admin password |

---

## API Routes
| Route | Purpose |
|-------|---------|
| `POST /api/generate` | Fires 5 KEI tasks (`gpt-image-2-image-to-image`) in parallel; **streams** NDJSON — each task emits `{type:"result"}` or `{type:"error"}` (with `code:"insufficient_credits"` when out of credits), followed by `{type:"done"}`. References: base64 in `images[]` (fresh uploads) + already-hosted URLs in `referenceImageUrls[]` (Pinterest pins) |
| `POST /api/upload-ref` | Uploads base64 image to Supabase Storage. `prefix` param: `"refs"` (default) or `"designs"` (direct upload mode) |
| `POST /api/placement` | Generates body+tattoo composite via KEI `nano-banana-pro`. Returns `402` + `code:"insufficient_credits"` when out of credits (no retry); `504` timeout; `502` other |
| `GET /api/pinterest/search` | Pinterest reference image search |
| `GET /api/pinterest/image` | Pinterest image proxy (CORS bypass) |
| `GET /api/proxy-image` | General image proxy |
| `GET /api/studio/designers` | List all staff, excluding soft-deleted (admin only) |
| `POST /api/studio/designers` | Create designer via Supabase Admin API (admin only) |
| `PATCH /api/studio/designers` | Toggle `is_active` on a designer (admin only) |
| `PUT /api/studio/designers` | Reset a designer's password — applied to Supabase Auth only, never stored. Blocks self / admin / soft-deleted targets (admin only) |
| `DELETE /api/studio/designers` | Soft-delete a designer: sets `deleted_at = now()` + `is_active = false`. Staff row is preserved so historical sessions still resolve "designed by X". Blocks self / admin (admin only) |
| `POST /api/studio/logout` | Sign out staff |
| `GET /api/cron/cleanup` | Delete expired sessions (active + older than 24hr) + their storage files |

---

## Database Tables (Supabase)

| Table | Key columns |
|-------|-------------|
| `auth.users` | Supabase Auth — staff login accounts |
| `staff` | `id` (= auth.users.id), `email`, `name`, `role` (admin\|designer), `is_active`, `last_login`, `deleted_at` (soft-delete marker — non-null hides the row from the admin list & blocks login; the row is kept so historical "designed by X" still resolves) |
| `users` | `id`, `first_name`, `phone` — customers (no auth, identified by phone) |
| `sessions` | `id`, `user_id`, `designer_id`, `tattoo_style`, `tattoo_description`, `target_body_area` (optional design-time hint, fed into the generation prompt), `status`, `created_at`, `completed_at` |
| `tattoo_designs` | `id`, `session_id`, `image_url`, `style_name`, `pattern_type`, `iteration`, `is_finalized` |
| `placements` | `id`, `session_id`, `placement_text`, `body_photo_url`, `final_composite_url`, `is_finalized` |
| `user_preferences` | `user_id`, `preferred_styles[]`, `preferred_placements[]` |

**RPC:** `finalize_session(p_session_id, p_design_id, p_placement_id)` — marks finalized rows, prunes siblings, marks session completed, updates user_preferences.

**RLS:** Admin sees all rows. Designer sees only sessions where `designer_id = auth.uid()`. Service role (API routes) bypasses RLS.

---

## Key Files

### Auth & Security
- `middleware.ts` — runs on every request; blocks unauthenticated → `/studio/login`; blocks designers from `/studio/admin/*`; enforces 24hr session timeout via `last_login`; rejects soft-deleted designers (`deleted_at != null`)
- `src/lib/supabase-server.ts` — server-only: `createSupabaseServerClient`, `createServiceClient`, `getStaffSession`
- `src/lib/supabase-client.ts` — browser-only: `createSupabaseBrowserClient` (cookie-based, safe in `"use client"`)
- `src/lib/staff-types.ts` — `StaffMember`, `StaffRole` types (safe to import anywhere)
- `src/lib/auth-utils.ts` — `getClientRole()`, `resolveBackUrl()` — role-validated back navigation

### Core Logic
- `src/lib/prompts.ts` — **ALL AI prompts live here**: `buildInitialDesignPrompt`, `buildRefinementPrompt`, `buildTattooPrompt`, `buildPlacementPrompt`, `buildCompositePrompt`. `STYLE_PROMPT_DESCRIPTORS` maps every style to specific visual language (linework, shading, color, composition, feel, subjects); injected via `buildStyleBlock(style)`. `buildBodyAreaBlock()` adds a design-time body area hint + "no anatomy in output" constraint. Composite mode: image 1 = composite (position + size locked), image 2 = clean design (detail reference only, not for recomposition), image 3 = body photo (skin/lighting).
- `src/lib/kei-api.ts` — pure KEI HTTP client: `createKeiTask(prompt, urls, {model})`, `waitForKeiTask`, `KeiTaskFailedError`, `KeiCreditsError` (non-retryable).
- `src/lib/storage.ts` — `uploadBase64`, `uploadFromUrl` to Supabase Storage bucket `session-assets`
- `src/lib/tattoo-colors.ts` — curated ink palette, `getColorsByHex`
- `src/lib/tattoo-pdf.ts` — **print/stencil engine**: `computeStencilLayout`, `defaultStencilCenter`, `loadTrimmedStencilImage` (auto-crops the design's empty frame to the actual ink), `downloadTattooStencilPdf` (tiles one tattoo across N A4 sheets → multi-page PDF, one sheet per page, with mirror + rotation, plus a `STENCIL_MARGIN_MM` 2mm light-grey safe-area guide drawn as one continuous outer rectangle around the assembled grid). Grid: 1→1×1, 2→1×2, 4→2×2, 8→2×4.
- `src/store/app-store.ts` — Zustand store: `designerId`, session lifecycle, design state (incl. `targetBodyArea` body-part hint), `persistDesigns` (syncs style/description/target_body_area to `sessions`), `finalizeSession`, `hydrateFromSession`, `replaceReferenceImage`

### Components
- `src/components/session/SessionOverview.tsx` — **shared read-only session detail view** used by admin and designer. Shows: session card, customer request, reference images, approved design, placement. Header **Download** button opens the Print Studio. Takes `sessionId`, `backUrl`, `backLabel` props.
- `src/components/print/TattooPrintStudio.tsx` — full-screen A4 print/stencil modal (replaces the old "Preview Sizes" PDF). Left "lightroom" canvas (drag to position the tattoo over the sheet grid) + right sidebar controls: A4 count (1/2/4/8), size %, rotation (0/90/180/270 + slider), mirror toggle (default ON — for skin transfer). Downloads a multi-page A4 PDF via `downloadTattooStencilPdf`.
- `src/components/placement/TattooPlacementEditor.tsx` — canvas drag/scale/rotate overlay
- `src/components/pinterest/PinterestSearch.tsx` — Pinterest reference search UI

---

## Staff Flow (Current Entry Point)
1. Staff navigates to any URL → middleware checks auth + 24hr timeout → redirects to `/studio/login` if needed
2. Login → `last_login` stamped in `staff` table → redirected to `/studio/designer` or `/studio/admin`
3. **Designer:** phone lookup → existing customer (go to `/customer/[userId]`) or new customer (create user + session) → `/[sessionId]/design`
4. **Design flow — two modes on `/[sessionId]/design`:**
   - **AI Design** (default): style + description → 5 KEI tasks in parallel → variation gallery → refine loop → proceed
   - **Direct Upload**: customer has an existing design → upload image → saved as final design → proceed directly to placement
5. **Placement:** upload body photo → composite generated → finalize → `finalizeSession()` RPC
6. **Admin:** views stats, manages designers (activate/deactivate, create), views all customers + sessions

---

## Session Cleanup (Cron)
- `GET /api/cron/cleanup` — deletes `active` sessions older than 24 hours + all their Supabase Storage files (`refs/`, `designs/`, `body/`, `composites/`, `previews/`)
- Triggered by Supabase pg_cron via `pg_net.http_get()` every 30 minutes
- Setup SQL: `supabase-cron-cleanup.sql`

---

## Back Navigation Pattern
All navigation to detail pages passes `?from=<source-url>`. Destination reads it via `useSearchParams` (client) or `searchParams` prop (server) and calls `resolveBackUrl()` which validates the URL against the user's actual role — admin URLs are stripped for designers.

---

## SQL Setup
Single file: **`supabase-schema.sql`** — creates everything from scratch (tables, RLS, functions, storage buckets, admin seed). The cron cleanup job setup is included at the bottom as a commented block to run after deploy.

---

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
KEI_API_KEY
CRON_SECRET                    # shared secret between app and pg_net cron caller
PINTEREST_ACCESS_TOKEN         # optional
```

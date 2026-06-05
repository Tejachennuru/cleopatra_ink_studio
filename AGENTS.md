# Cleopatra Ink Studio — Agent Reference

## What This Is
AI-powered tattoo design platform for **in-shop use by staff (designers + admin)**. A designer creates or looks up a customer by phone, runs the tattoo design flow (style → generate → refine → placement → finalize), and the admin manages the studio. Customers never log in — staff acts on their behalf.

## Stack
- **Framework:** Next.js (App Router) + TypeScript strict mode
- **Auth:** Supabase Auth (email + password) via `@supabase/ssr` cookie-based sessions
- **State:** Zustand with throttled localStorage persistence + Supabase hydration (`src/store/app-store.ts`)
- **Database & Storage:** Supabase PostgreSQL + Storage bucket `session-assets`
- **Image Generation:** KEI API (`api.kie.ai`). Design generation uses `gpt-image-2-image-to-image` by default; switches to `nano-banana-pro` (Gemini 3 Pro Image) when Text Tattoo mode is on. Placement render always uses `nano-banana-pro`. NOT Claude or DALL-E. Reference image is mandatory for design generation — no fallback.
- **Styling:** Tailwind CSS v4. Dark luxury theme: bg `#0D0D0D`, gold `#C9A84C`, font Cinzel.

---

## Route Map

### Public
| Route | Purpose |
|-------|---------|
| `/studio/login` | Staff login — first page shown to everyone |

### Staff — shared
| Route | Purpose |
|-------|---------|
| `/` | Logo splash → auto-redirects by role |
| `/customer/[userId]` | Customer tattoo history |
| `/studio/sessions/[id]` | Session overview (read-only) |
| `/[sessionId]/design` | AI Design mode OR Direct Upload mode |
| `/[sessionId]/placement` | Body placement editor + composite generation |

### Designer only
| Route | Purpose |
|-------|---------|
| `/studio/designer` | Dashboard: phone lookup, new customer, recent sessions |

### Admin only
| Route | Purpose |
|-------|---------|
| `/studio/admin` | Stats, designer list, recent sessions |
| `/studio/admin/customers` | All customers with live search |
| `/studio/admin/sessions/[id]` | Admin session view |
| `/studio/admin/designers/[id]` | Designer profile + password reset |
| `/studio/admin/designers/new` | Create designer account |
| `/studio/admin/settings` | Change admin password |

---

## API Routes
| Route | Purpose |
|-------|---------|
| `POST /api/generate` | 5 KEI tasks in parallel; streams NDJSON — each task emits `{type:"result"}` or `{type:"error"}`, then `{type:"done"}`. References: base64 in `images[]` + hosted URLs in `referenceImageUrls[]`. At least one reference image is required (no fallback). Accepts `isTextTattoo` (bool) to switch model to `nano-banana-pro` and use text-optimised prompt. Accepts `faithfulMode` (bool) to use minor-changes-only refinement prompt. |
| `POST /api/upload-ref` | Uploads base64 to Supabase Storage. `prefix`: `"refs"` or `"designs"` |
| `POST /api/placement` | Composite generation via `nano-banana-pro`. Returns `402` (credits), `504` (timeout), `502` (other) |
| `POST /api/enhance-prompt` | Calls OpenAI GPT-4o-mini to generate 3 enhanced tattoo description variations from a raw staff input. Body: `{ description, style? }`. Returns `{ variations: string[] }`. Requires `OPENAI_API_KEY` env var. |
| `GET /api/pinterest/search` | Pinterest reference search |
| `GET /api/pinterest/image` | Pinterest image proxy (CORS bypass) |
| `GET /api/proxy-image` | General image proxy |
| `GET /api/studio/designers` | List all staff, excluding soft-deleted (admin only) |
| `POST /api/studio/designers` | Create designer (admin only) |
| `PATCH /api/studio/designers` | Toggle `is_active` (admin only) |
| `PUT /api/studio/designers` | Reset password — Supabase Auth only, never stored (admin only) |
| `DELETE /api/studio/designers` | Soft-delete designer (admin only) |
| `POST /api/studio/logout` | Sign out |
| `GET /api/cron/cleanup` | Delete sessions older than 24hr + storage files |

---

## Database Tables

| Table | Key columns |
|-------|-------------|
| `auth.users` | Supabase Auth — staff accounts |
| `staff` | `id`, `email`, `name`, `role` (admin\|designer), `is_active`, `last_login`, `deleted_at` |
| `users` | `id`, `first_name`, `phone` — customers (no auth) |
| `sessions` | `id`, `user_id`, `designer_id`, `tattoo_style`, `tattoo_description`, `target_body_area`, `status` |
| `tattoo_designs` | `id`, `session_id`, `image_url`, `style_name`, `pattern_type`, `iteration`, `is_finalized` |
| `placements` | `id`, `session_id`, `placement_text`, `body_photo_url`, `final_composite_url`, `is_finalized` |
| `user_preferences` | `user_id`, `preferred_styles[]`, `preferred_placements[]` |

**RPC:** `finalize_session(p_session_id, p_design_id, p_placement_id)` — marks finalized rows, prunes siblings, completes session, updates preferences.

**RLS:** Admin sees all. Designer sees only own sessions. Service role (API routes) bypasses RLS.

---

## Key Files

### Auth & Security
- `middleware.ts` — route protection, 24hr timeout, soft-delete check. Uses `getSession()` (cookie-local) then `Promise.all(getUser, staff query)` — parallel, not sequential
- `src/lib/supabase-server.ts` — `createSupabaseServerClient`, `createServiceClient`, `getStaffSession`
- `src/lib/supabase-client.ts` — `createSupabaseBrowserClient` (safe in `"use client"`)
- `src/lib/auth-utils.ts` — `getClientRole()`, `resolveBackUrl()` — role-validated back navigation

### Core Logic
- `src/lib/prompts.ts` — **ALL AI prompts**. `STYLE_PROMPT_DESCRIPTORS` maps 70+ styles to visual language via `buildStyleBlock()`. `buildBodyAreaBlock()` injects body area hint + no-anatomy constraint. Composite mode: image 1 = composite (position/size locked), image 2 = clean design (detail only), image 3 = body photo (skin/lighting). Five prompt builders: `buildInitialDesignPrompt`, `buildRefinementPrompt`, `buildFaithfulRefinementPrompt` (minor changes only), `buildTextTattooPrompt` + `buildTextTattooRefinementPrompt` (text/lettering, uses nano-banana-pro). Unified entry: `buildTattooPrompt(desc, style, hasRefs, refinement?, colors?, bodyArea?, isTextTattoo?)`
- `src/lib/kei-api.ts` — KEI HTTP client: `createKeiTask`, `waitForKeiTask`, `KeiTaskFailedError`, `KeiCreditsError`
- `src/lib/storage.ts` — `uploadBase64`, `uploadFromUrl` to `session-assets` bucket
- `src/lib/tattoo-colors.ts` — ink palette (`TATTOO_COLORS`), `getColorsByHex`
- `src/lib/tattoo-pdf.ts` — stencil engine: `computeStencilLayout`, `loadTrimmedStencilImage`, `downloadTattooStencilPdf` (multi-page A4, mirror + rotation, 2mm safe-area guide)
- `src/store/app-store.ts` — Zustand store. `makeThrottledStorage(400ms)` batches localStorage writes. Pages render from store immediately; `hydrateFromSession()` syncs from Supabase in background

### Components
- `src/components/session/SessionOverview.tsx` — shared read-only session view (admin + designer)
- `src/components/print/TattooPrintStudio.tsx` — A4 print modal. `computeStencilLayout` and style objects memoised
- `src/components/placement/TattooPlacementEditor.tsx` — drag/scale/rotate canvas overlay. Overlay style memoised for 60fps drag performance
- `src/components/ui/StyleSelect.tsx` — searchable style dropdown (70+ styles by category)
- `src/components/pinterest/PinterestSearch.tsx` — Pinterest reference search UI

---

## Staff Flow
1. Any URL → middleware checks auth + timeout → `/studio/login` if needed
2. Login → `last_login` stamped → redirect to `/studio/designer` or `/studio/admin`
3. Designer: phone lookup → new or existing customer → `/[sessionId]/design`
4. Design: AI mode (generate → refine) or Direct Upload → select design → proceed
5. Placement: upload photo → editor → generate composite → finalize
6. Admin: stats, manage designers, view all customers + sessions

---

## SQL Setup
Single file: **`supabase-schema.sql`** — tables, RLS, functions, storage buckets, admin seed. Run the cron block at the bottom manually after deploy (requires `pg_cron` + `pg_net` enabled in Supabase Dashboard).

---

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
KEI_API_KEY
OPENAI_API_KEY                 # used by /api/enhance-prompt (GPT-4o-mini description enhancer)
CRON_SECRET                    # shared secret for cron endpoint
PINTEREST_ACCESS_TOKEN         # optional
```

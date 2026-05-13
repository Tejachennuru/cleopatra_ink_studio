# 🎨 Cleopatra Ink Studio
### AI-Powered Tattoo Design Platform — Complete Application Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Application Architecture](#2-application-architecture)
3. [Feature Specifications](#3-feature-specifications)
4. [User Workflow & Screen Flow](#4-user-workflow--screen-flow)
5. [AI Integration Layer](#5-ai-integration-layer)
6. [Tattoo Style Catalog](#6-tattoo-style-catalog)
7. [Stencil Editor & Print System](#7-stencil-editor--print-system)
8. [Technology Decisions](#8-technology-decisions)
9. [Technical Stack](#9-technical-stack)
10. [API & Backend Design](#10-api--backend-design)
11. [Database Schema](#11-database-schema)
12. [Authentication & Session Management](#12-authentication--session-management)
13. [UI/UX Design Principles](#13-uiux-design-principles)
14. [Deployment & Infrastructure](#14-deployment--infrastructure)
15. [Future Roadmap](#15-future-roadmap)

---

## 1. Project Overview

**Cleopatra Ink Studio** is a professional, AI-powered tattoo design application built for in-shop use by tattoo artists, studio staff, and their customers. The platform replaces the traditional 45-minute manual design consultation with a near-instant AI-driven iteration loop — producing custom tattoo designs from customer references, style preferences, and body placement in seconds.

### Problem Statement

Traditional tattoo studios face a bottleneck: the design process is slow, manual, and heavily dependent on the individual artist's availability and skill set. Customers often can't visualize a design on their body before committing. Stencil preparation adds further delay.

### Solution

Cleopatra Ink Studio provides:
- Upload-to-design generation in under 30 seconds
- 3–4 design variations per iteration
- Live body preview overlay
- Unlimited refinement loops until customer satisfaction
- One-click stencil export, sized for standard US paper (8.5" × 11")

### Target Users

| User Role | Description |
|-----------|-------------|
| **Tattoo Artist / Designer** | Creates and refines designs using the AI tools |
| **Studio Receptionist** | Manages customer intake and session creation |
| **Customer** | Views designs, gives feedback, approves final selection |
| **Studio Owner / Admin** | Manages team logins, views session history, analytics |

---

## 2. Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLEOPATRA INK STUDIO                      │
│                      Frontend (React)                        │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Upload   │  │  Design  │  │ Preview  │  │ Stencil  │  │
│  │  Module  │  │ Gallery  │  │ Overlay  │  │  Editor  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼─────────────┼─────────────┼──────────────┼─────────┘
        │             │             │              │
        └─────────────┴──────┬──────┴──────────────┘
                             │
               ┌─────────────▼──────────────┐
               │        API Gateway          │
               │    (Node.js / Express)      │
               └──────┬──────────────┬───────┘
                      │              │
          ┌───────────▼──┐    ┌──────▼───────────┐
          │  Claude API  │    │  Image Processing │
          │ (Anthropic)  │    │  (Sharp / Canvas) │
          └──────────────┘    └──────────────────┘
                      │              │
               ┌──────▼──────────────▼──────┐
               │     PostgreSQL Database     │
               │  (Sessions, Designs, Users) │
               └─────────────────────────────┘
```

---

## 3. Feature Specifications

### 3.1 Customer Image & Reference Upload

**Functionality:**
- Drag-and-drop or click-to-browse file upload
- Supports JPEG, PNG, WEBP, HEIC formats
- Up to 8 reference images per session
- Body photo upload for placement preview
- Automatic image compression and optimization on upload
- Thumbnail grid display with reorder/remove capability
- Image annotation: customer can draw arrows or circles on references to indicate specific elements they want

**Supported Body Parts:**
Shoulder, Upper Arm, Forearm, Wrist, Hand, Back (full/upper/lower), Chest, Rib, Thigh, Calf, Ankle, Neck, Behind Ear

**Storage:**
- Temporary session storage (24-hour expiry for unfinalized sessions)
- Permanent customer record storage upon finalization
- All images stored server-side; customers never see raw file paths

---

### 3.2 AI-Powered Design Generation

**Generation Engine:**
- Primary: Claude API (claude-sonnet-4-20250514) with vision capabilities
- Generates 3–4 design variations per prompt
- Each generation run is logged with prompt + output for quality review

**Prompt Engineering Strategy:**
Each generation prompt is assembled from:
1. Tattoo style selection
2. Reference images (passed as base64 vision input)
3. Custom text instructions from the designer
4. Body part context (affects composition rules)
5. Composition layout instructions (e.g., "eagle at top, roses at bottom")
6. Previous iteration context (when refining)

**Iteration Loop:**
```
Generate 4 variations
     ↓
Customer selects one (or none)
     ↓
If none: adjust prompt and regenerate
If one: customer gives feedback text
     ↓
New generation uses: selected design + feedback as base
     ↓
Repeat until "Approve Design" clicked
```

**Generation Parameters (configurable by designer):**
- Detail level: Sketch / Detailed / Hyper-detailed
- Contrast: Low / Medium / High
- Line weight: Fine / Medium / Bold
- Background: Transparent / White / Body Skin tone

---

### 3.3 Customization & Styling Options

**Style Selection UI:**
- Visual grid of style tiles with sample tattoo thumbnail per style
- Multi-style blending: select up to 2 styles for hybrid output (e.g., "Neo Traditional + Geometric")
- Style intensity slider (0–100%) for primary/secondary blend ratio

**Text Integration:**
- Font selection from 30+ tattoo-appropriate typefaces (Script, Gothic, Block, Serif, etc.)
- Custom text input: names, dates, quotes, phrases
- Letter spacing, size, and curve path controls
- Placement relative to design elements

**Composition Builder:**
- Drag-and-drop element positioning panel
- Element stacking order (z-index control)
- Per-element scale adjustment (percentage-based)
- Mirror/flip controls
- Rotation controls (degrees)
- Symmetry lock (for mandala, geometric styles)

**Size & Scale Controls:**
- Global scale slider: 50% to 200%
- Fine-tune inputs: enter exact percentages
- Dimension display: always shows final size in inches and centimeters
- "Fit to body part" auto-scale button

---

### 3.4 Body Placement Visualization

**Overlay Engine:**
- Composite tattoo design onto uploaded body photo using server-side image processing
- Body contour detection using computer vision (OpenCV or similar)
- Warp/distortion applied to tattoo to follow skin curves
- Skin tone sampling for realistic opacity blending
- Shadow/highlight layer added for depth realism

**Preview Controls:**
- Drag to reposition tattoo on body photo
- Pinch-to-zoom / scroll wheel zoom on preview
- Rotate tattoo on body (freehand rotation handle)
- Opacity slider: see through tattoo to body (for precise placement)
- Side-by-side comparison: body alone vs. body with tattoo

**Supported Preview Modes:**
- Static photo overlay
- Real-time camera view (tablet camera AR mode for in-shop use)
- Front/side/back views if multiple body photos uploaded

---

### 3.5 Design Selection & Finalization

**Selection Process:**
- Customer reviews all generated variations in a lightbox gallery
- "Favourite" toggle to shortlist designs across iterations
- Side-by-side comparison of up to 2 designs
- Full-screen presentation mode (for showing customer on a large display)
- One-click "Approve This Design" button

**Post-Approval Actions:**
- System automatically removes body photo background from final composite
- Tattoo-only image extracted at full resolution
- Design saved to customer session record
- Session flagged as "Finalized — Awaiting Stencil"

---

### 3.6 Stencil Editor & Sizing

**Editor Interface:**
Accessible only to team members (login required). Customers see a simplified "Design Approved" screen while artists use the stencil editor.

**Sizing Controls:**
- Input: desired tattoo dimensions (width × height in inches or cm)
- Auto-calculation of paper layout based on entered size
- Scale indicator showing actual print size vs. body size

**Paper & Print Management:**
- Standard US Letter: 8.5" × 11"
- A4: 210mm × 297mm
- Custom size: manual input
- Multi-page splitting: if tattoo exceeds one page, automatic slice into tiles with 0.5" overlap and alignment guides printed on each page
- Tile numbering: "Page 1 of 3 — Align ▲ to ▲ on adjacent page"

**Image Processing Options:**
- Convert to pure black line art (removes color, shading — stencil-ready)
- Threshold adjustment for line clarity
- Increase line weight for thin lines (minimum 0.5mm for transfer)
- Mirror image option (for reverse stencil transfer method)
- Add margin padding around design

**Export Options:**
- Print directly from browser (PDF render)
- Export as PDF file (download)
- Export as high-resolution PNG (600 DPI)
- Export as SVG (editable vector, for artists with Procreate/Illustrator)

---

### 3.7 User Interface & Experience

**Design Philosophy:**
Luxury dark-theme aesthetic inspired by high-end tattoo studios. Gold and deep charcoal palette. Cinematic typography. Professional — not a generic SaaS app. Customers feel they are in an exclusive creative experience.

**Screen Structure:**
```
Step 1: Upload      → Body photo + Reference images
Step 2: Style       → Choose tattoo style(s) + initial instructions
Step 3: Generate    → View 3–4 AI variations
Step 4: Refine      → Select + provide feedback → regenerate
Step 5: Preview     → See tattoo on body photo
Step 6: Approve     → Confirm final design
Step 7: Stencil     → [Team only] Size, export, print
```

**Navigation:**
- Linear step wizard with back/forward navigation
- Step progress bar always visible at top
- "Save & Resume Later" on every step (session code given to customer)
- Mobile/tablet optimized (primary in-shop device: iPad)

**Customer Mode vs. Designer Mode:**
| Feature | Customer Mode | Designer Mode |
|---------|--------------|---------------|
| Upload images | ✅ | ✅ |
| View designs | ✅ | ✅ |
| Give feedback | ✅ | ✅ |
| Edit prompt directly | ❌ | ✅ |
| Stencil editor | ❌ | ✅ |
| Session management | ❌ | ✅ |
| Analytics dashboard | ❌ | ✅ (Admin only) |

---

## 4. User Workflow & Screen Flow

### Complete Customer Journey

```
[ ENTRY POINT ]
      │
      ▼
[ Welcome Screen ]
  ┌────────────┐
  │ New Session│  ← Receptionist or customer starts here
  │ or Resume  │
  └─────┬──────┘
        │
        ▼
[ STEP 1: Upload ]
  ┌──────────────────────────────────────┐
  │  Upload body photo (optional)        │
  │  Upload reference images (1–8)       │
  │  Select body part from diagram       │
  └─────────────────┬────────────────────┘
                    │
                    ▼
[ STEP 2: Style & Instructions ]
  ┌──────────────────────────────────────┐
  │  Select tattoo style(s)              │
  │  Add custom text (name/date/quote)   │
  │  Describe composition in plain text  │
  │  e.g. "Eagle at top, roses below,    │
  │  geometric border around everything" │
  └─────────────────┬────────────────────┘
                    │
                    ▼
[ STEP 3: AI Generation ]
  ┌──────────────────────────────────────┐
  │  ⏳ Generating 4 variations...        │
  │  [Design A] [Design B] [Design C]    │
  │  [Design D]                          │
  │  → Customer selects preferred OR     │
  │    clicks "Try Again / Adjust"       │
  └─────────────────┬────────────────────┘
                    │
          ┌─────────┴──────────┐
          │                    │
          ▼                    ▼
[ Feedback & Refine ]    [ Happy with selection ]
  ┌──────────────┐            │
  │ Enter text   │            │
  │ feedback     │            │
  │ (what to     │            │
  │  change)     │            │
  └──────┬───────┘            │
         │                    │
         └─────────┬──────────┘
                   │
                   ▼
[ STEP 4: Body Preview ]
  ┌──────────────────────────────────────┐
  │  See tattoo on uploaded body photo   │
  │  Drag to reposition                  │
  │  Scale and rotate                    │
  │  Toggle opacity                      │
  └─────────────────┬────────────────────┘
                    │
                    ▼
[ STEP 5: Approve Design ]
  ┌──────────────────────────────────────┐
  │  Final design displayed              │
  │  "This is perfect!" → Approve        │
  │  "Go back and change" → Return       │
  └─────────────────┬────────────────────┘
                    │
                    ▼
[ STEP 6: Stencil (Team Only) ]
  ┌──────────────────────────────────────┐
  │  Enter desired tattoo dimensions     │
  │  Preview print layout                │
  │  Split across pages if needed        │
  │  Convert to stencil line art         │
  │  Export / Print                      │
  └──────────────────────────────────────┘
```

---

## 5. AI Integration Layer

### Claude API Usage

**Model:** `claude-sonnet-4-20250514`  
**Capability used:** Vision (image input) + text generation

**Generation Prompt Template:**
```
System:
You are a professional tattoo design AI assistant for Cleopatra Ink Studio.
Generate tattoo designs in {style} style.
Output: Describe a detailed tattoo design that can be rendered as an image.
Focus on line work, composition, and tattoo-specific aesthetics.
Design must be suitable for tattooing on human skin.
Do NOT include any background scenes, only the tattoo design itself.

User:
Style: {selected_style}
Body placement: {body_part}
Reference elements from uploaded images: {reference_description}
Customer instructions: {custom_text}
Composition: {composition_instructions}
Additional customization: {text_to_include}, size adjustments: {scale_notes}

Generate a complete tattoo design description for image rendering.
Return 4 variations labeled DESIGN_A, DESIGN_B, DESIGN_C, DESIGN_D.
```

**Image Generation Pipeline:**
Since Claude provides text-based design descriptions, the pipeline passes these to a rendering layer (DALL-E 3, Stable Diffusion, or Midjourney API) to produce actual images. The architecture is modular — the image generation backend can be swapped.

**Refinement Prompt (Iteration 2+):**
```
Previous design: {base64_selected_design_image}
Customer feedback: "{feedback_text}"
Keep: {elements_to_keep}
Change: {elements_to_modify}
Style remains: {selected_style}
Generate 4 refined variations based on the above.
```

### Fallback & Error Handling

- If API call fails: retry up to 3 times with exponential backoff
- If rate limited: queue request and show estimated wait time
- If generation produces unusable output: log for manual review, offer regeneration
- Timeout: 45-second max generation time; show progress indicator

---

## 6. Tattoo Style Catalog

The application supports the following 29 tattoo styles, each with curated prompt modifiers and visual examples shown in the style picker:

| # | Style | Key Characteristics |
|---|-------|---------------------|
| 1 | **Black & Grey** | Monochromatic, smooth shading, realistic shadows |
| 2 | **Color Tattoo** | Full spectrum color, vibrant fills, bold outlines |
| 3 | **Realistic** | Photo-realistic imagery, fine detail, depth |
| 4 | **Hyper-realistic** | Extreme detail, trompe-l'œil effect, 3D depth illusion |
| 5 | **Old School** | Bold black outlines, limited palette, traditional motifs |
| 6 | **New School** | Exaggerated proportions, graffiti influence, modern icons |
| 7 | **Neo Traditional** | Old school structure + modern color and detail |
| 8 | **Anime** | Japanese animation style, cel-shaded, expressive |
| 9 | **Manga** | Black & white, screentone, panel-style composition |
| 10 | **Minimal** | Single fine lines, negative space, geometric simplicity |
| 11 | **Fine Line** | Ultra-thin lines, delicate detail, subtle shading |
| 12 | **Geometric** | Mathematical shapes, sacred geometry, precise lines |
| 13 | **Tribal** | Bold black patterns, cultural motifs, organic shapes |
| 14 | **Polynesian** | Traditional Pacific Island patterns, symbolic meaning |
| 15 | **Japanese** | Irezumi style, waves, koi, dragons, florals |
| 16 | **Gothic** | Dark imagery, skulls, cathedral architecture, script |
| 17 | **Dark Art** | Surreal dark themes, horror-adjacent, intricate |
| 18 | **Horror** | Explicit horror imagery, dripping effects, macabre |
| 19 | **Biomechanical** | Mechanical interior exposed, gears, pistons, organic-machine |
| 20 | **Lettering** | Text-dominant design, typography as art |
| 21 | **Script** | Flowing cursive text, calligraphic letterforms |
| 22 | **Chicano** | Black & grey, Catholic imagery, gang culture aesthetics |
| 23 | **Portrait** | Realistic face/figure rendering, photographic |
| 24 | **Mandala** | Radially symmetric circular patterns, spiritual |
| 25 | **Ornamental** | Decorative filigree, jewel-like elements, symmetry |
| 26 | **Dotwork** | Stippling technique, pointillism, gradient by dot density |
| 27 | **Watercolor** | Paint splash effect, color bleeds, no hard outlines |
| 28 | **Cover-up Design** | High-coverage designs that conceal existing tattoos |
| 29 | **Sleeve Design** | Full arm composition, cohesive multi-element sleeve |
| 30 | **Patchwork Design** | Collection of separate small designs filling an area |

**Style Blending:**
Customers may blend two styles. Example combinations:
- *Neo Traditional + Watercolor*: Traditional structure with watercolor fill and splashes
- *Geometric + Dotwork*: Geometric outlines filled with stippling
- *Anime + Color Tattoo*: Anime characters rendered in vivid tattoo color

---

## 7. Stencil Editor & Print System

### Purpose

The stencil editor is the final professional tool used exclusively by tattoo artists and print operators. It converts the approved AI-generated design into a print-ready stencil file optimized for tattoo transfer paper.

### Stencil Conversion Process

**Step 1 — Import Approved Design:**
- Pull finalized tattoo image from session database
- Display at actual pixel dimensions with DPI information

**Step 2 — Set Physical Dimensions:**
- Artist inputs desired tattoo width/height in inches or centimeters
- System recalculates DPI and page layout automatically

**Step 3 — Line Art Conversion:**
- Apply threshold filter to isolate dark lines
- Remove color data (convert to pure black on white)
- Minimum line thickness enforcement (0.5mm minimum for transfer quality)
- Preview toggle: see color original vs. stencil line art side-by-side

**Step 4 — Page Layout:**
- Single page: fits within 8.5" × 11" print area
- Multi-page: automatic tile layout with:
  - 0.5" overlap zone on each tile edge
  - Registration marks (crosshairs) at overlap corners
  - Page number and orientation guide printed on each page
  - Fold guide marks

**Step 5 — Final Export:**
```
Output Options:
├── Print Now (opens browser print dialog with PDF render)
├── Save as PDF (high quality, 600 DPI)
├── Save as PNG (transparent background option)
└── Save as SVG (vector, editable in Illustrator/Procreate)
```

### Print Specifications

| Property | Value |
|----------|-------|
| Default paper | US Letter (8.5" × 11") |
| Print resolution | 600 DPI |
| Color mode | Grayscale (stencil) |
| Line art threshold | Adjustable 50–200 (default 128) |
| Minimum line weight | 0.5mm |
| Margin | 0.25" all sides |
| Print area | 8.0" × 10.5" |

---

## 8. Technology Decisions

### Framework — Next.js 14+ (App Router)

Next.js is the definitive choice for this project over plain React or other frameworks.

The App Router provides route groups that map cleanly to the two separate worlds in this app: the customer-facing step wizard and the protected designer/admin dashboard. Middleware handles role-based access control at the routing level with no extra setup. Server-side rendering means the tablet in-shop loads the first screen instantly rather than waiting for a JS bundle to hydrate. The built-in Next.js Image component handles automatic compression and lazy loading for the image-heavy design gallery and body preview screens — both critical performance areas.

Most importantly: all Claude API calls live in Next.js Route Handlers on the server. The API key never reaches the browser. Image processing with Sharp also runs server-side inside these same handlers, so upload → process → store is a single server-side pipeline rather than a client-server round trip.

**Why not Vite + React SPA?** An SPA would require a separate Express/Fastify server for API routes, a separate server for image processing, manual SSR setup if needed, and exposes API keys unless you build a dedicated proxy. Next.js ships all of this together.

**Why not Remix?** Remix is excellent but its ecosystem and deployment options are narrower. Next.js has broader Vercel/AWS/containerized deployment support and a larger library of compatible packages — relevant for Prisma, NextAuth, and uploadthing integrations used here.

---

### Language — TypeScript (Strict Mode)

TypeScript is non-negotiable for a project of this complexity. The reasoning is not about preference — it is about the specific data shapes this app manages.

Every session flows through 7 steps carrying: uploaded image references, selected style IDs, an active generation job, an array of design variations, a selected design, overlay position/scale state, and stencil dimension config. Without TypeScript, passing these objects between components and API calls becomes error-prone the moment the shape of any one object changes. With TypeScript and strict mode enabled, a change to the `Design` type immediately surfaces every call site that needs updating.

The stencil editor alone manages numeric state for width, height, DPI, page count, tile overlap, and scale factor. TypeScript makes it impossible to accidentally pass a string where a number is expected — a class of bug that is invisible at runtime until a customer gets a corrupt print.

**Strict mode configuration for this project:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

`noUncheckedIndexedAccess` is particularly valuable here because arrays of designs, uploads, and style selections are accessed by index throughout the app — this flag forces handling of potentially undefined array elements.

---

### Key Type Definitions

These are the core types the entire application is built around:

```typescript
// Session — the central data object passed through all 7 steps
type Session = {
  id: string;
  customerName: string;
  bodyPart: BodyPart;
  status: "active" | "finalized" | "archived";
  teamMemberId: string;
  createdAt: Date;
  updatedAt: Date;
};

// A single AI generation run (one click of "Generate")
type GenerationRun = {
  id: string;
  sessionId: string;
  iteration: number;
  promptUsed: string;
  styles: TattooStyle[];
  feedback: string | null;
  designs: Design[];
  createdAt: Date;
};

// One of the 3–4 variations produced per generation run
type Design = {
  id: string;
  generationId: string;
  variationLabel: "A" | "B" | "C" | "D";
  imageUrl: string;
  isSelected: boolean;
  isApproved: boolean;
  createdAt: Date;
};

// Generation job — asynchronous, polled by the client
type GenerationJob = {
  id: string;
  sessionId: string;
  status: "pending" | "processing" | "complete" | "failed";
  result: Design[] | null;
  error: string | null;
};

// Stencil — final output for the tattoo artist
type Stencil = {
  id: string;
  sessionId: string;
  designId: string;
  widthInches: number;
  heightInches: number;
  pageCount: number;
  pdfUrl: string | null;
  pngUrl: string | null;
  createdBy: string;
  createdAt: Date;
};

// User roles with strict string literal union
type UserRole = "artist" | "receptionist" | "admin";

// All supported tattoo styles as a union — never a plain string
type TattooStyle =
  | "black_grey" | "color" | "realistic" | "hyper_realistic"
  | "old_school" | "new_school" | "neo_traditional" | "anime"
  | "manga" | "minimal" | "fine_line" | "geometric" | "tribal"
  | "polynesian" | "japanese" | "gothic" | "dark_art" | "horror"
  | "biomechanical" | "lettering" | "script" | "chicano"
  | "portrait" | "mandala" | "ornamental" | "dotwork"
  | "watercolor" | "cover_up" | "sleeve" | "patchwork";

// All supported body parts as a union
type BodyPart =
  | "upper_arm" | "forearm" | "wrist" | "hand" | "shoulder"
  | "chest" | "rib" | "back_full" | "back_upper" | "back_lower"
  | "thigh" | "calf" | "ankle" | "neck" | "behind_ear";
```

---

## 9. Technical Stack

### Framework & Language

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 14+ (App Router) | Full-stack framework — frontend, API routes, SSR |
| **TypeScript** | 5+ (strict mode) | Type safety across the entire codebase |
| **React** | 18+ | UI component model (via Next.js) |

### Frontend Libraries

| Technology | Purpose |
|-----------|---------|
| **Tailwind CSS** | Utility-first styling |
| **Framer Motion** | Page transitions, design card animations, approval effects |
| **TanStack Query (React Query)** | Server state, generation job polling, cache management |
| **Zustand** | Client-side global state (session wizard progress, selected designs) |
| **React Dropzone** | Drag-and-drop image upload zones |
| **Fabric.js** | Canvas-based body overlay editor (drag, scale, rotate tattoo on photo) |
| **React PDF** | In-browser PDF rendering for stencil print preview |

### Backend (Next.js Route Handlers)

| Technology | Purpose |
|-----------|---------|
| **Sharp** | Server-side image processing: resize, composite, threshold for stencil |
| **node-canvas** | Server-side canvas operations for overlay generation |
| **PDFKit** | PDF generation for multi-page stencil export |
| **uploadthing** | Type-safe file upload to S3-compatible storage |
| **BullMQ** | Redis-backed job queue for async generation tasks |

### AI & External Services

| Service | Purpose |
|---------|---------|
| **Anthropic Claude API** | Design generation, prompt assembly, vision input for refinement |
| **Image Generation API** | Rendering Claude design descriptions into actual tattoo images |
| **AWS S3 / Cloudflare R2** | Image and stencil file storage |

### Database & Auth

| Technology | Purpose |
|-----------|---------|
| **PostgreSQL** | Primary relational database |
| **Prisma ORM** | Type-safe, auto-generated DB client — pairs perfectly with TypeScript |
| **Redis** | BullMQ job queue, session caching, rate limit counters |
| **NextAuth.js** | Team member authentication (credentials provider + JWT strategy) |
| **bcrypt** | Password hashing (min 10 salt rounds) |

### Project Structure

```
cleopatra-ink-studio/
├── app/
│   ├── (customer)/              ← Customer-facing route group
│   │   ├── session/[id]/
│   │   │   ├── upload/          ← Step 1
│   │   │   ├── style/           ← Step 2
│   │   │   ├── generate/        ← Step 3 & 4
│   │   │   ├── preview/         ← Step 5
│   │   │   └── approve/         ← Step 6
│   │   └── layout.tsx
│   ├── (studio)/                ← Protected team route group
│   │   ├── dashboard/
│   │   ├── stencil/[sessionId]/
│   │   ├── sessions/
│   │   └── layout.tsx           ← Auth guard middleware here
│   ├── api/
│   │   ├── sessions/
│   │   ├── generate/
│   │   ├── jobs/[jobId]/
│   │   ├── uploads/
│   │   ├── stencil/
│   │   └── auth/[...nextauth]/
│   └── layout.tsx
├── components/
│   ├── upload/
│   ├── design-gallery/
│   ├── body-preview/
│   ├── stencil-editor/
│   └── ui/
├── lib/
│   ├── claude.ts                ← Claude API client
│   ├── image-processing.ts      ← Sharp utilities
│   ├── queue.ts                 ← BullMQ setup
│   ├── db.ts                    ← Prisma client
│   └── auth.ts                  ← NextAuth config
├── types/
│   └── index.ts                 ← All shared TypeScript types
├── prisma/
│   └── schema.prisma
└── middleware.ts                 ← Route protection
```

---

## 10. API & Backend Design

### Core Route Handlers (Next.js App Router)

All API logic lives in `app/api/` as Next.js Route Handlers. No separate Express server needed.

```
POST   /api/sessions                         → Create new customer session
GET    /api/sessions/[id]                    → Get full session data
PATCH  /api/sessions/[id]                    → Update session (step, status)

POST   /api/sessions/[id]/uploads            → Upload body or reference image
DELETE /api/sessions/[id]/uploads/[imgId]    → Remove uploaded image

POST   /api/sessions/[id]/generate           → Queue AI generation job → returns { jobId }
GET    /api/jobs/[jobId]                     → Poll job status + result
POST   /api/sessions/[id]/designs/[dId]/select  → Select a design variation
POST   /api/sessions/[id]/designs/[dId]/approve → Finalize design

POST   /api/sessions/[id]/preview            → Generate body overlay composite image
POST   /api/sessions/[id]/stencil            → Generate stencil (line art conversion)
GET    /api/sessions/[id]/stencil/export     → Download stencil (PDF / PNG / SVG)

POST   /api/auth/[...nextauth]               → NextAuth.js handler (login/logout/session)
GET    /api/auth/[...nextauth]               → NextAuth.js handler

GET    /api/admin/sessions                   → All sessions list (admin role only)
GET    /api/admin/analytics                  → Usage analytics (admin role only)
```

### Generation Job Queue

AI image generation is handled asynchronously:

```
Client → POST /generate → Returns job_id immediately
Client → polls GET /jobs/:job_id every 2s
Server → processes generation → Updates job status
Job status: pending | processing | complete | failed
On complete: job.result contains array of 4 image URLs
```

---

## 11. Database Schema

### Core Tables

**sessions**
```sql
id              UUID PRIMARY KEY
customer_name   VARCHAR(100)
body_part       VARCHAR(50)
tattoo_style    VARCHAR(50)[]
status          ENUM(active, finalized, archived)
created_at      TIMESTAMP
updated_at      TIMESTAMP
team_member_id  UUID REFERENCES users(id)
```

**uploads**
```sql
id          UUID PRIMARY KEY
session_id  UUID REFERENCES sessions(id)
type        ENUM(body_photo, reference)
url         TEXT
filename    VARCHAR(255)
size_bytes  INTEGER
created_at  TIMESTAMP
```

**generation_runs**
```sql
id          UUID PRIMARY KEY
session_id  UUID REFERENCES sessions(id)
iteration   INTEGER
prompt_used TEXT
style       VARCHAR(50)
feedback    TEXT
created_at  TIMESTAMP
```

**designs**
```sql
id              UUID PRIMARY KEY
generation_id   UUID REFERENCES generation_runs(id)
session_id      UUID REFERENCES sessions(id)
variation_label CHAR(1)  -- A, B, C, D
image_url       TEXT
is_selected     BOOLEAN DEFAULT FALSE
is_approved     BOOLEAN DEFAULT FALSE
created_at      TIMESTAMP
```

**stencils**
```sql
id              UUID PRIMARY KEY
session_id      UUID REFERENCES sessions(id)
design_id       UUID REFERENCES designs(id)
width_inches    DECIMAL
height_inches   DECIMAL
page_count      INTEGER
pdf_url         TEXT
png_url         TEXT
created_at      TIMESTAMP
created_by      UUID REFERENCES users(id)
```

**users** (team members)
```sql
id          UUID PRIMARY KEY
email       VARCHAR(255) UNIQUE
name        VARCHAR(100)
role        ENUM(artist, receptionist, admin)
password_hash TEXT
last_login  TIMESTAMP
is_active   BOOLEAN DEFAULT TRUE
created_at  TIMESTAMP
```

---

## 12. Authentication & Session Management

### Team Member Auth

- Email + password login via NextAuth.js credentials provider
- Passwords hashed with bcrypt (min 10 salt rounds)
- JWT strategy: 8-hour session expiry for active use
- Refresh tokens: 30-day sliding window
- Role-based access control (RBAC) enforced in `middleware.ts` at the route group level — the `(studio)` route group is inaccessible without a valid session token

### Customer Sessions

- No login required for customers
- UUID-based session codes (shareable for resuming: e.g., `CIS-9F3A-X2K7`)
- Sessions auto-expire after 24 hours of inactivity (unless finalized)
- Finalized sessions retained for 90 days then archived
- All uploads and designs permanently associated with session record

### Security

- All image uploads virus-scanned on receipt
- Session UUIDs are cryptographically random (non-guessable)
- Customer images stored in private S3 buckets (no public URLs)
- Time-limited signed URLs for image display (expire after 1 hour)
- Rate limiting on generation endpoint: 20 requests/hour per session
- HTTPS required on all endpoints; HTTP redirects to HTTPS

---

## 13. UI/UX Design Principles

### Visual Identity

**Color Palette:**
- Background: `#0D0D0D` (near black)
- Surface: `#1A1A1A` (dark card)
- Gold accent: `#C9A84C` (Egyptian gold)
- Text primary: `#F5F0E8` (warm white)
- Text secondary: `#8A8070` (muted)
- Success: `#4CAF70` (green)
- Error: `#CF4040` (red)

**Typography:**
- Display / Headings: Cinzel (Roman-inspired serif, Egyptian feel)
- Body text: Nunito or Lato (clean, readable)
- UI labels: Space Mono (technical elements, stencil editor)
- Tattoo style names: Playfair Display (editorial)

**Motion Design:**
- Page transitions: 300ms ease fade + slight upward translate
- Loading designs: skeleton pulse animation
- Design reveal: cards scale in with stagger (50ms delay each)
- Approval animation: gold ripple effect from button
- Stencil export: ink-fill progress bar

### Accessibility

- WCAG 2.1 AA compliance minimum
- All images have alt text
- Keyboard navigation fully supported
- Focus rings visible (styled to match gold accent)
- Minimum touch target: 44px × 44px (tablet use)
- Font sizes minimum 14px body, 12px label text

### Responsive Breakpoints

| Breakpoint | Target Device | Layout |
|-----------|--------------|--------|
| 375px | Phone | Single column, bottom nav |
| 768px | Tablet (iPad) | Primary in-shop device; two-column |
| 1024px | Laptop | Full layout, sidebar |
| 1440px | Desktop | Wide layout, expanded gallery |

---

## 14. Deployment & Infrastructure

### Recommended Architecture

Next.js is deployable to Vercel (zero-config, recommended for early stages) or containerized on AWS ECS for full infrastructure control. The containerized path is preferred for production studios needing data residency control.

```
Route 53 / Cloudflare DNS
        ↓
CloudFront CDN (Next.js static assets + ISR cache)
        ↓
Application Load Balancer
        ↓
ECS Fargate — Next.js App Container
        ↓
ECS Fargate — BullMQ Worker Container (generation jobs)
        ↓
RDS PostgreSQL (Multi-AZ)
ElastiCache Redis (job queue + session cache)
S3 Buckets (uploads, generated designs, stencil exports)
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Auth (NextAuth.js)
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://yourdomain.com

# AI
ANTHROPIC_API_KEY=
IMAGE_GEN_API_KEY=

# Storage
AWS_S3_BUCKET=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# App config
SESSION_EXPIRY_HOURS=24
MAX_UPLOAD_SIZE_MB=10
GENERATION_TIMEOUT_MS=45000
```

### Scaling Considerations

- Generation jobs processed by a dedicated worker pool (separate container)
- Redis queue for job management (Bull or BullMQ)
- Auto-scale API containers based on request volume
- S3 + CloudFront for zero-latency image delivery
- Database read replicas for analytics queries

---

## 15. Future Roadmap

### Phase 2 (3–6 months post-launch)

- **AR Body Preview:** Real-time camera overlay using WebAR (8th Wall or WebXR)
- **Customer Portal:** Web app where customers can review and re-order past designs
- **Style Learning:** System learns preferences from approval history per studio
- **Appointment Booking Integration:** Book artist appointment directly after design approval
- **Multi-language Support:** Spanish, Portuguese, French for international studios

### Phase 3 (6–12 months)

- **Vector Export:** AI-traced SVG output for professional vector stencils
- **Artist Marketplace:** Allow studios to share/sell design templates
- **Analytics Dashboard:** Track popular styles, average sessions per day, revenue attribution
- **Mobile App:** Native iOS/Android for customers to explore designs at home
- **Franchise / Multi-location:** Centralized admin for studio chains

### Phase 4 (12+ months)

- **Custom Model Fine-tuning:** Train studio-specific model on approved designs for consistent house style
- **3D Body Scan Integration:** Full 3D body model from photos for wraparound sleeve preview
- **Auto-Pricing Engine:** Quote generation based on size, complexity, and artist rate

---

*Cleopatra Ink Studio — Where Ancient Artistry Meets Modern Intelligence*

**Document Version:** 1.1  
**Last Updated:** May 2026  
**Prepared for:** Development Team — Cleopatra Ink Studio Project  
**Tech Decision Added:** Next.js 14 (App Router) + TypeScript strict mode confirmed as core stack

---
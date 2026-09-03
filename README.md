# The Meridian Ledger — Agent-Native Newsroom Portal

A polished internal newsroom portal with three tightly-integrated workspaces — **Story Desk**, **Media Vault** and **Handoff Engine** — that is operable *both* by humans through the UI *and* by external browser agents through the real **WebMCP** browser API (`document.modelContext.registerTool(...)`).

Agent actions and human actions go through the same REST API and the same business-logic layer, so they always mutate the same application state.

## Features

### 🗂 Story Desk
- Create, edit, assign and review stories
- **Two desk layouts:** a classic two-pane **list** view and a run-order **board** view that groups stories by workflow stage with inline next-step quick actions (Submit / Approve / Resubmit / Handoff)
- **Run-order sequencing** — every stage column is an ordered run: numbered position chips on board cards, drag a card onto another card in the same stage to re-sequence (drop on empty column space to send to the bottom), moves joining a stage append at the end, and the whole column is re-sequenced 1..n after every change. Recorded on the story timeline as a “Run order” event
- **Run-order list view** — a Recent / Run-order toggle in the list header re-orders the classic list into the print run: stage-by-stage group headers (with counts) and numbered position chips on each row, mirroring the board sequence. Deep-linkable via `?sort=run-order`
- **Print run strip** — an always-on summary band above the desk: the approved queue in board run-order (numbered cards with desk dot, scheduled date color-coded by deadline state, media/word counts), a "First run" badge, one-click jump to a story and a hover quick-action to send it straight to the Handoff Engine
- **Drag & drop on the board** — move stories between workflow stages; legal transitions from the editorial state machine are highlighted while dragging, illegal drops are rejected with a clear explanation (publishing only via the Handoff Engine)
- **Deep-linkable state** — the section (`?view=`), desk layout (`?layout=`) and selected story (`?story=`) persist in the URL, survive reloads and are shared as links (e.g. `/?view=handoff&layout=board`)
- Full editorial workflow with enforced transitions:
  `Draft → In Review → Approved | Revision Requested → … → (Handoff) → Published`
- **Editorial guardrail:** editing the copy of an *Approved* story (headline / standfirst / body) automatically reverts it to Draft for re-review — approval applies to the version that was reviewed
- **Pitch a follow-up:** duplicate any story as a fresh Draft (media, deadline and handoff history start clean)
- **Workflow stepper** — every story detail shows a Draft → Review → Approved → Published pipeline with the current stage highlighted (a story in revision shows an orange "in revision" detour chip; stages awaiting action pulse gently)
- **Editor filter** — filter the desk by assigned editor ("All editors" dropdown), matching the same `assignee` filter the `find_stories` agent tool exposes
- Story detail view with byline, desk, slug, word count, **estimated reading time** and timestamps
- Attach / detach media, set the lead image, write captions, and replace expired assets in one action
- Deadline awareness on cards and detail: `past due` (red) and `due soon` (amber, ≤ 48 h)
- **Scheduled-run dates on the board** — cards with a scheduled date show it as a quiet calendar chip (unless past-due/due-soon warnings take over)
- **Copy view link** — the masthead button copies the current deep-link so a colleague (or agent operator) reopens the exact desk, filters and selection
- **Desk color coding** — a colored dot per desk (City Hall, Business, Tech, Climate, Sports, Culture) across list, board and detail views
- Live warning when a story carries media with expired rights
- **Alt-text editor per attachment** — “missing alt” warning chip plus an editing dialog (with live character counter); the Handoff Engine blocks publication until every image has a text alternative
- Editorial timeline recording every status change, edit, attachment and handoff
- **Keyboard shortcuts:** `1` `2` `3` switch sections, `/` jumps to story search, `Ctrl/Cmd+K` command palette

### 🖼 Media Vault
- Searchable, filterable library of photographs (query, license type, rights status, channel)
- Rights filter includes **“Usable now”** (valid or perpetual) alongside the four exact statuses
- Full metadata per asset: photographer, source, license type + notes, allowed channels, expiry, attribution/credit requirements, dimensions, format
- Rights computed per asset: `Perpetual`, `Valid`, `Expiring soon` (≤ 14 days), `Expired`
- **Register asset by URL** — add wire-service or agent-supplied imagery with a live preview and full licensing metadata (license type, channels, expiry, credit line, optional dimensions); external assets render wherever local files do and carry an “External” badge
- **Lightbox** — zoom any asset to full size from the card hover button or the detail dialog
- **Usage cross-links** — every asset lists the stories it is attached to; one click jumps to that story on the Story Desk
- **License renewal** — dated assets show a renewal box in the vault detail: pick a new expiry date (or “+ 1 year”), optionally append a renewal note to the license notes, and the rights badge / attached-story validation update immediately. Renewing an expired asset re-clears it for handoff
- **Bulk license renewal** — when any asset is Expiring-soon or Expired, the vault header offers “Renew licenses (n)”: pick candidates from a checkbox list (thumbnails, current rights), set one new expiry date + optional note, and renew them all in one transaction — recorded in each asset's license notes
- **Deep-linkable detail** — `/?view=vault&asset=<id>` opens any asset's record directly
- One-click **“Copy credit”** for the attribution line
- Attach any asset to a story straight from the vault (caption + alt text in the same step)
- Seeded with realistic mixed-rights content — including **expired** assets and valid **replacement** images

### 🚚 Handoff Engine
- Three-step publication pipeline:
  1. **Validate** — checklist covering editorial status, desk-editor assignment, headline/standfirst/body quality, media attached, lead image set, licenses valid, web channel allowed, credits present **and alt text on every attachment** (accessibility guardrail), each with a remediation hint (replace expired media, add alt text, open the vault)
  2. **Generate payload** — structured JSON web-publishing payload (story, media with credits + alt text, SEO, delivery) with a syntax-highlighted viewer, copy button and **JSON download**
  3. **Execute handoff** — server-side re-validation, simulated CMS delivery, story marked `Published`, **handoff receipt opens automatically**
- **Payload diff** — every payload preparation is snapshotted server-side per story (and cleared on delivery), so re-preparing shows a field-level “changed vs previous preparation” table (+/− rows) **across reloads, tabs and agent preparations** — not just within one browser session
- **Media manifest & alt-text editor** — the payload step lists every delivered image with thumbnail, role and its alt text; alts that verbatim duplicate the caption or asset title (a screen-reader anti-pattern) are flagged `same as caption/title`. Each row has an inline editor with a deterministic **Suggest** button (derived from caption → asset description → asset title, first sentence, ≤140 chars); saving re-builds the payload so the diff shows exactly what changed
- **Handoff receipt** — every delivery produces a print-ready artifact (masthead, DELIVERED stamp, reference grid, story block, media manifest with credits/licenses, preview URL). Opened automatically after execution, from any history row, or shared via the `?receipt=<ref>` deep link; **Print** renders *only* the receipt sheet via a print-only portal twin and `@media print` isolation
- Handoff history with delivery receipts and inspectable payloads

### ⌘K Command palette
- **Ctrl/Cmd+K** opens an editorial command palette: jump between sections, jump to any story (opens it on the desk), open any vault asset, switch list/board layout, toggle the day/night edition, copy the current view link — all deep-link-aware

### 🌗 Day / night editions
- Full **dark mode** (“night edition”) via the masthead toggle — a warm-charcoal editorial palette with the press-red brand kept and all status/rights badges, warnings, hatches, payload viewer and scrollbars tuned for both modes; the choice persists across visits

### 🤖 WebMCP tools (for external browser agents)
When opened in a browser that implements WebMCP, the app registers these tools via `document.modelContext.registerTool(...)`:

| Tool | Purpose |
| --- | --- |
| `find_stories` | List/filter stories (status, desk, assignee, free text) |
| `get_story` | Full story record incl. attached media and rights |
| `get_story_history` | Editorial timeline events for a story |
| `create_story` | Create a draft story |
| `duplicate_story` | Pitch a follow-up: clone a story as a fresh Draft |
| `update_story` | Edit title/summary/body/desk/assignee/priority (approved copy edits revert the story to Draft) |
| `update_story_status` | Move a story through the editorial workflow (transitions enforced) |
| `approve_story` | Approve a story that is In Review |
| `reorder_story` | Move a story within its stage's run order (before another story, or top/bottom) |
| `search_media` | Search the vault (query, license, channel, rights status — `USABLE` = publishable today) |
| `get_media_metadata` | Full metadata for one asset |
| `register_media_asset` | Register a new vault asset from an external image URL with full licensing metadata |
| `check_media_rights` | Rights check for one asset or every asset on a story |
| `attach_media_to_story` | Attach an asset (caption + alt text + lead-image flag) |
| `detach_media_from_story` | Remove an attachment |
| `replace_story_media` | Swap an attached asset, preserving caption + lead-image status (alt text resets unless supplied) |
| `update_story_media` | Update an attachment's caption / alt text / lead-image flag |
| `suggest_alt_text` | Deterministic alt-text suggestion for an attachment (caption → description → title, first sentence, ≤140 chars) — same routine the editor-facing Suggest button uses |
| `validate_publication` | Run the full pre-publication checklist |
| `prepare_web_handoff` | Generate the web publishing payload (incl. a field-level diff against the previous prepared-but-undelivered draft) |
| `execute_web_handoff` | Perform the simulated web handoff |
| `renew_media_licenses` | Bulk-renew dated assets: set a new expiry (+ optional note) for several assets in one action |

Every tool has a JSON-Schema input, returns structured `{ ok, ... }` results, performs real operations against the application's data, and handles invalid input/errors. There is **no in-app chatbot or agent dashboard** — the tools exist purely for external browser agents. After a tool mutates data, the human UI refreshes automatically via a `newsroom:data-changed` event.

For runtime observability the bridge also exposes `window.__NEWSROOM_WEBMCP_TOOLS__` (ordered tool names) and `window.__NEWSROOM_WEBMCP_HANDLES__` (name → callable tool handle), so QA harnesses and agent operators can invoke any tool directly from the console.

**Tool validation:** all 22 tools are validated end-to-end (happy path + error path) against the running app in [`tests/webmcp-validation-report.md`](./tests/webmcp-validation-report.md).

## Architecture

```
UI (React components)            src/components/newsroom/*
  ↕  REST (same endpoints for UI + agents)
API routes                       src/app/api/**   (Node runtime, force-dynamic)
Business logic                   src/lib/newsroom/*   (types, stories, media, handoff)
Data layer                       Prisma — SQLite locally, PostgreSQL on Vercel
                                 prisma/schema.prisma · prisma/schema.postgres.prisma
WebMCP tools                     src/components/newsroom/webmcp-tools.ts
```

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Prisma ORM — SQLite for local development, PostgreSQL in production (see [Deploying to Vercel](#deploying-to-vercel))
- Zustand for client state

## Getting started

```bash
# 1. Install dependencies
bun install        # or: npm install

# 2. Configure the database URL
cp .env.example .env    # default: SQLite at file:../db/custom.db

# 3. Push the schema and seed realistic demo data
bun run db:push
bun run db:seed    # or: bun prisma/seed.ts

# 4. Start the dev server
bun run dev        # http://localhost:3000
```

> The database seeds 9 stories across all editorial states, 13 media assets with
> different rights conditions (perpetual, valid, expiring-soon and **expired**),
> a story whose attached image has expired rights (with a valid replacement in
> the vault), and two approved stories that pass the full handoff pipeline.

---

## License

Released under the [MIT License](./LICENSE). Newsroom content is fictional demo data.

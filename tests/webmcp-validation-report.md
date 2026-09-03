# WebMCP Tools — Validation Report

**Project:** The Meridian Ledger — Agent-Native Newsroom Portal
**Date:** 2026-09-02 · **Environment:** Chromium (agent-browser harness) against `localhost:3000` (Next.js dev server, seeded demo data)
**Method:** Every tool invoked through `window.__NEWSROOM_WEBMCP_HANDLES__` (the runtime handles registered by `src/components/newsroom/webmcp-provider.tsx`), covering the happy path **and** at least one error path per tool. Native registration cross-checked via `await document.modelContext.getTools()`.

## Registry integrity

| Check | Result |
| --- | --- |
| Native registration (`document.modelContext.getTools()`) | ✅ 22 tools |
| Runtime handles (`window.__NEWSROOM_WEBMCP_HANDLES__`) | ✅ 22 callables |
| Name sets identical (native ↔ handles) | ✅ |
| Post-mutation UI refresh via `newsroom:data-changed` event | ✅ (UI reflected every agent mutation) |

## Per-tool results (22/22 PASS)

| # | Tool | Happy path verified | Error path verified |
| --- | --- | --- | --- |
| 1 | `find_stories` | 9 stories unfiltered; `status=APPROVED` → 3; `desk` + `limit` filters respected | — (tolerates empty input) |
| 2 | `get_story` | by `storyId` (full record, 2 attachments) and by `slug` (same story resolved) | `{}` → `Provide either 'storyId' or 'slug'.` |
| 3 | `create_story` | Draft created with body/summary/desk/assignee/priority; word count computed (105w) | no title → `Missing required string parameter "title".` |
| 4 | `duplicate_story` | Follow-up Draft created: `(Follow-up)` suffix, media/deadline start clean | ghost id → `Story ghost-story not found.` |
| 5 | `update_story` | `priority=URGENT` + `scheduledFor=2026-12-01` applied | no fields → `Provide at least one field to update.` |
| 6 | `update_story_status` | `DRAFT → IN_REVIEW` transition applied (timeline event recorded) | — (illegal transitions rejected by business logic; covered by `approve_story` error) |
| 7 | `approve_story` | `IN_REVIEW → APPROVED` | approving an already-APPROVED story → `Only stories In Review can be approved.` |
| 8 | `reorder_story` | `position: "top"` → runOrder 1, column re-sequenced | no `beforeStoryId`/`position` → clear error |
| 9 | `search_media` | `rightsStatus=USABLE` → 10 (all VALID/PERPETUAL); `EXPIRED` → 2; free-text `solar` → 2 | — (tolerates empty input) |
| 10 | `get_media_metadata` | full metadata incl. license/channels/credit | unknown id → `Media asset not found.` |
| 11 | `check_media_rights` | single asset (1 problem: expiry) **and** whole-story report (`allUsableForWeb` flag) | neither param → `Provide 'mediaId' or 'storyId'.` |
| 12 | `attach_media_to_story` | caption + altText + lead flag set; **auto-primary rule holds after fix** (see bug below) | ghost media → `Media asset ghost-media not found.` |
| 13 | `detach_media_from_story` | attachment removed (mediaCount 0) | detaching non-attached asset → structured error |
| 14 | `replace_story_media` | caption **and** lead status preserved, alt reset (new image), replacement from seeded vault | same old/new id → `Replacement asset must differ…` |
| 15 | `register_media_asset` | external URL registered: rights VALID, channels `["web","print"]`, credit line stored | invalid URL → `A valid http(s) image URL is required.` |
| 16 | `update_story_media` | caption-only update **kept the lead flag**; alt/caption/isPrimary patch semantics | no fields → clear error |
| 17 | `suggest_alt_text` | deterministic suggestion (source: `caption`, ≤140 chars) — follows the updated caption | media not attached to that story → structured 404-style error |
| 18 | `renew_media_licenses` | bulk renewal → expiry 2028-06-30 + note appended to license notes | empty `mediaIds` → `mediaIds must be a non-empty array…` |
| 19 | `get_story_history` | timeline events with kinds (`DEADLINE_SET`, `STATUS_CHANGED`, …); `HANDOFF_EXECUTED` appears after delivery | — (bad id surfaces structured error via store) |
| 20 | `validate_publication` | 11-check gate: scratch story → `valid: true` (0 failed); seeded expired-media story → fails only `media-rights` | unknown story → `Story not found.` |
| 21 | `prepare_web_handoff` | payload generated (story + media with alt + credits); 1st prep `previousHandoffRef: null`; 2nd prep diffs against server-side snapshot `WEB-20260902-098C` (0 fields changed) | not-ready story → `Failed checks: story-approved, editor-assigned, media-attached, primary-media` |
| 22 | `execute_web_handoff` | SUCCESS: `handoffRef WEB-20260902-964F`, previewUrl, story → `PUBLISHED`, `HANDOFF_EXECUTED` timeline event | ghost id → `Story ghost-story not found.` |

## Bug found & fixed during validation

**First-attachment auto-promotion was suppressed** — `attach_media_to_story` (and the underlying REST route) coerced an omitted `isPrimary` into an explicit `false`, so the documented rule *"the first attachment becomes primary automatically"* never fired through the API/tool surface (only the Story Desk UI worked around it client-side with `story.media.length === 0`).

- **Fix 1 — API route** (`src/app/api/stories/[id]/media/route.ts`): `isPrimary: body.isPrimary === true ? true : undefined` — explicit `true` forces lead + demotes others; omitted defers to the business rule.
- **Fix 2 — tool layer** (`src/components/newsroom/webmcp-tools.ts`): same conditional so the tool no longer sends an explicit `false`.
- **Verified after fix:** detach → re-attach *without* `isPrimary` → attachment becomes lead automatically → story validates **11/11**.

## Handoff end-to-end (agent-driven golden path)

```
create_story → update_story (deadline) → update_story_status (IN_REVIEW)
→ approve_story → attach_media_to_story (caption + alt, auto-primary)
→ validate_publication (11/11) → prepare_web_handoff (payload, snapshot saved)
→ prepare_web_handoff (diff vs WEB-20260902-098C) → execute_web_handoff (SUCCESS WEB-20260902-964F)
→ story PUBLISHED · HANDOFF_EXECUTED on timeline
```

## Harness notes

- Mutating tests created a scratch story + scratch vault asset; the database was **reseeded to the pristine demo state** (9 stories / 13 assets / 1 handoff receipt) after validation, and a post-reseed smoke confirmed: 22 native tools + 22 handles, invocation OK, scratch entities gone.
- `prepare_web_handoff`'s server-side snapshot memory was exercised across the two preparations (previous ref surfaced on the second call).
- Console and `dev.log` clean apart from anticipated HMR full-reload notices caused by the mid-session fix edits (silent on fresh loads).

# FullShot — full-page capture extension (v1)

_Mirrored from [AVIDX-371](https://linear.app/avidx/issue/AVIDX-371/fullshot-full-page-capture-extension-v1). Source of truth is the Linear issue; update this file if the issue changes._

## Why

Replace GoFullPage for daily full-page captures (dozens/day, mostly sent to Claude). GoFullPage requires "read and change all data on all websites" on every page. A self-built, unpacked extension with no network access removes that risk.

Key finding driving the design: Claude downsizes images to max 2576px on the long edge (~4784 visual tokens). A tall single-image capture (e.g. 1440×10,000) arrives ~370px wide — unreadable. So captures for Claude must be **tiled (~1440×2400 per tile)**, and PDFs should carry a **real text layer**.

Personal tooling — not a portfolio bet (yet). Build for Mitch first; load unpacked, never published.

## What was built (Claude Code)

Private Chrome MV3 extension "FullShot". Plain JS, no build step. pdf-lib is vendored locally as a UMD bundle (`lib/pdf-lib.min.js`) — no CDN, no network requests anywhere at runtime.

**Permissions:** `activeTab`, `debugger`, `clipboardWrite`, `offscreen`, `downloads`, `storage`. No `host_permissions`.

> Deviation from the ticket's permission list: `storage` was added (for persisting options via `chrome.storage.local`) and `scripting` was deliberately **not** added — in-page code (pre-scroll, text-node extraction) runs through `chrome.debugger`'s `Runtime.evaluate` instead of `chrome.scripting.executeScript`, since the debugger connection is already open for the capture itself. Neither permission grants any host access or triggers an install warning.

**Capture**

* `chrome.debugger` + CDP: pre-scroll the page to trigger lazy-loaded content, return to top, `Page.getLayoutMetrics`, then `Page.captureScreenshot` with `captureBeyondViewport: true`, png. Detach debugger immediately after.
* Captured in fixed-height (4000 CSS px) clip segments regardless of total page height, then stitched on an `OffscreenCanvas` in the background service worker — this uniformly handles pages taller than Chrome's capture limit (~16k px) without special-casing.
* Because `captureBeyondViewport` renders the page as laid out (not by scrolling + re-screenshotting the visible viewport), fixed/sticky elements are captured once at their normal flow position rather than duplicated per segment.
* If DPR > 1, each capture segment's `clip.scale` is set to `1/DPR` so tiled/stitched output is 1:1 with CSS pixels instead of native device pixels.
* Deviation, found during testing: many app-shell layouts (SPA dashboards, docs sites, claude.ai's own chat panel) don't scroll the document at all — an inner pane does, with its own `overflow: auto` and a fixed height, so `Page.getLayoutMetrics()` only ever measures one viewport. Before measuring/capturing, any large-enough internally-scrolling element gets `overflow`/`height`/`max-height` forcibly overridden — **and so does every ancestor up to `<body>`**, tagged so each can be restored byte-for-byte afterward. The ancestor walk turned out to be necessary in practice: a flex/grid app shell (Tailwind's `min-h-0` truncation pattern, e.g.) commonly constrains the scrollable element via a parent's fixed height or `overflow: hidden`, so freeing only the innermost scrolling div still leaves it squeezed into that parent's box. The walk has to reach all the way up through `<body>` and `<html>` themselves, not stop short of them — a `html, body { height: 100vh; overflow: hidden }` reset is an extremely common pattern, and an early version of this fix stopped one level too soon, so the outermost clip was still silently capping everything. Known remaining gap: **virtualized/windowed lists** (rows that don't exist in the DOM until scrolled into view) can't be fixed this way — there's nothing to un-clip because the content genuinely isn't there yet. That would need actually scrolling the inner container step-by-step, which isn't implemented in v1.

**Triggers**

* `capture-default` — Alt+Shift+S — uses default format from options (default: PDF).
* `capture-image` — Alt+Shift+I — always image.
* Toolbar popup: two large buttons "PDF" and "Image"; gear icon → options page.

**PDF output**

* **Mode A "Claude PDF" (default):** the stitched full-page canvas is sliced into 1440(-ish, actual page width)×2400 tiles, one PNG-embedded tile per PDF page. Before capture, `Runtime.evaluate` walks visible text nodes and records text + bounding rects in document coordinates. Each tile gets that overlapping text redrawn at matching positions with `opacity: 0` (invisible but selectable/searchable) using pdf-lib's standard Helvetica font.
  * Deviation: pdf-lib's high-level `drawText` doesn't expose PDF text-rendering-mode 3 ("Invisible") directly, only the lower-level content-stream operators do. Zero-opacity fill text is the well-established alternative for OCR-style invisible text layers and is what's implemented here. Text that Helvetica/WinAnsi can't encode (CJK, emoji, etc.) is skipped per-node rather than failing the capture.
* **Mode B "Vector PDF" (experimental):** `Emulation.setEmulatedMedia({media:'screen'})`, then `Page.printToPDF` with `printBackground:true`, paperWidth/paperHeight = full page size in inches (px / 96), zero margins, single page.

**Image output**

* PNG default (JPEG option, quality configurable).
* Saved to disk AND copied to the clipboard via an offscreen document (`navigator.clipboard.write`) — the clipboard copy is always PNG even if the saved file is JPEG, since Chrome's Clipboard API doesn't accept `image/jpeg`.
* Options checkbox "also save Claude-sized tiles" additionally saves 1440×2400-ish PNG tiles alongside the main image.

**Saving**

* Path: `Downloads/<base>/<subfolder>/<domain>_<YYYYMMDD-HHmm>_<title-slug>.<ext>` (slug: lowercase, hyphens, max 50 chars, diacritics stripped, path-traversal-safe).
* `chrome.downloads.download` with `saveAs:false`, `conflictAction:'uniquify'`. `URL.createObjectURL()` doesn't exist in a service worker context, only in a real document, so the offscreen document (already needed for clipboard writes) mints the `blob:` URL from the captured bytes and hands the URL string back — but `chrome.downloads` itself isn't available *inside* the offscreen document, so the actual `chrome.downloads.download()` call and its completion tracking still run in the service worker, against that URL.
* Toolbar badge gives lightweight feedback ("…" while capturing, "✓"/"✗" after) instead of a native notification, since `notifications` wasn't in the requested permission set.
* Known caveat (matches the ticket's own note): if Chrome's global "Ask where to save each file" setting is on, Chrome shows the Save As dialog regardless of `saveAs:false` — this is a Chrome-level override the extension can't suppress.

**Options page**

All fields from the spec: default format, PDF mode, image format (+ JPEG quality), base folder name, subfolders (none/month/domain), filename preset (including custom template with `{domain} {title} {date} {time}` tokens), "also save Claude-sized tiles", and a live example-filename preview. Options auto-save on change (no separate Save button) and persist via `chrome.storage.local`.

## Acceptance criteria

- [ ] Alt+Shift+S saves a Claude PDF of the current page to the dated folder, no dialog
- [ ] PDF text is selectable/searchable; pages are tiles, not one giant page
- [ ] Alt+Shift+I saves a PNG and it's on the clipboard, pasteable into claude.ai
- [ ] Popup PDF / Image buttons work
- [ ] Lazy-loaded images render; no repeated sticky headers
- [ ] Pages >16k px capture correctly
- [ ] Options persist and change naming/folders as expected
- [ ] Zero network requests (verify in the extension's DevTools)
- [ ] Mode B tested vs Mode A on Mitch's ~10 most-captured sites; pick default

These need manual verification in real Chrome (see README) — an automated agent can't drive `chrome://extensions`, grant the debugger permission dialog, or inspect the system clipboard.

## Later (not in v1 — new tickets if pursued)

* Make `debugger` an optional permission requested on first capture + scroll-and-stitch fallback (`captureVisibleTab`) for users who decline.
* Local MCP server exposing `latest_capture` (tiles + text) for Claude Desktop / Claude Code.
* Copy page as markdown alongside the capture.
* Hand unpacked build to 3–5 heavy screenshot users; if still used after 2 weeks → Web Store listing + label + portfolio entry.
* Check whether Claude in Chrome already covers the "ask Claude about this page" case.

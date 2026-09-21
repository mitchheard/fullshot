# FullShot

Private, unpacked Chrome extension for full-page captures — a self-hosted replacement for GoFullPage that makes **zero network requests** and needs no `host_permissions` on any site.

- **Alt+Shift+S** — capture the current page in your default format (PDF by default)
- **Alt+Shift+I** — capture the current page as an image
- Toolbar icon → popup with "PDF" / "Image" buttons and a gear to open options

PDF captures default to **Claude PDF** mode: the page is tiled into ~1440×2400 pages with an invisible, searchable text layer, sized so each page arrives readable when Claude downsizes it — see [docs/SPEC.md](docs/SPEC.md) for the full design.

## Install (unpacked, for Mitch)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**, select this `fullshot/` folder
4. Pin the FullShot icon to the toolbar if you want quick access to the popup

Chrome will show a "FullShot started debugging this browser" bar briefly during each capture — that's the `chrome.debugger` API doing its job (screenshot + scroll + PDF rendering), and it detaches immediately after each capture. This is expected.

## First-run checklist

Run through the ticket's acceptance criteria on a few real pages (a long article, a page with lazy-loaded images, a page with a sticky header, something over ~16,000px tall):

1. `chrome://extensions` → FullShot → **service worker** link → keep the DevTools console open to catch errors
2. Alt+Shift+S on a normal page → check `Downloads/FullShot/<year-month>/` for a PDF; open it and confirm you can select/search the text
3. Alt+Shift+I → check the file saved AND paste (Cmd+V) into a new message at claude.ai
4. Open the options page (gear icon) and confirm changing base folder / subfolder mode / filename preset updates the example filename and actually changes where files land
5. In the service worker DevTools → **Network** tab, confirm nothing ever appears (no network requests, ever)
6. Try Mode B ("Vector PDF") in options on your ~10 most-captured sites vs Mode A, and pick whichever you prefer as your default

If a capture silently fails, check the service worker console — errors are logged there and the toolbar badge turns red (✗).

## Project layout

```
manifest.json
background/        service worker: capture orchestration, PDF/image building, saving, options
content/           in-page snippets run via CDP Runtime.evaluate (not a declared content script)
offscreen/         offscreen document — the only place that can write to the clipboard
popup/             toolbar popup (PDF / Image buttons)
options/           options page
lib/pdf-lib.min.js vendored pdf-lib UMD build (no CDN)
icons/             generated placeholder icons
docs/SPEC.md        mirror of the originating ticket + build notes
```

## Known limitations (v1)

- If Chrome's "Ask where to save each file" setting is on, Chrome will show a Save dialog regardless — this is a Chrome-level override, not something the extension can suppress.
- The text layer is best-effort: fonts embed only WinAnsi-encodable text (skips CJK/emoji), and position/size are approximated from DOM rects, not exact glyph metrics.
- Vector PDF mode (Mode B) is marked experimental in the ticket and hasn't been picked as a winner yet — that's an open manual-testing task, not something a coding agent can decide.

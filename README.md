# fullshot

Full-page screenshots for Chrome, saved as tiled searchable PDFs or clipboard-ready PNGs. No network access, no accounts, no tracking, and no host permissions on any site.

- **Cmd+Shift+S** (Mac) / **Alt+Shift+S** (Windows/Linux): capture the current page in your default format (PDF unless you change it)
- **Cmd+Shift+I** (Mac) / **Alt+Shift+I** (Windows/Linux): capture the current page as an image, saved to disk and copied to the clipboard
- Toolbar icon: popup with **PDF** / **Image** buttons and a gear for options

## Install

fullshot is loaded unpacked; it is not on the Chrome Web Store.

1. Clone or download this repo
2. Open `chrome://extensions` and turn on **Developer mode**
3. Click **Load unpacked** and select the `fullshot/` folder
4. Pin the icon if you want quick access to the popup

Captures are saved to `Downloads/fullshot/<year-month>/` by default. Folder and filename patterns are configurable in the options page.

## What it does

- **Captures the whole page**, including lazy-loaded content, without repeating sticky headers.
- **Handles app-style pages** (dashboards, chat UIs) where an inner panel scrolls instead of the page itself, by temporarily unclipping that panel for the capture and then restoring it exactly.
- **Handles very tall pages** by capturing in segments and stitching them.
- **Two PDF modes:**
  - **Claude PDF** (default): the page is sliced into ~2400px-tall tiles, one per PDF page, each embedded as an image with an invisible text layer so the PDF stays searchable. It is a pixel-exact screenshot, so it renders the same as the live page.
  - **Vector PDF**: Chrome's own print-to-PDF at full page size, producing a single continuous page with real vector text. It has no tile seams and is usually smaller, but it relies on Chrome's print rendering, which can differ from the screen version on pages with canvas/WebGL content or `@media print` styles.
- **Image mode** saves a PNG or JPEG and always copies a PNG to the clipboard. Optionally it also saves tiles.

## Permissions and privacy

| Permission | Why |
| --- | --- |
| `debugger` | Drives Chrome's DevTools Protocol for the screenshot, scrolling, and print-to-PDF |
| `activeTab` | Reads the current tab's URL and title for filenames, only when you invoke the extension |
| `downloads` | Saves the file |
| `offscreen` + `clipboardWrite` | Copies the image to the clipboard (service workers can't) |
| `storage` | Remembers your options |

There are no `host_permissions` and no network requests anywhere in the shipped code. [pdf-lib](https://github.com/Hopding/pdf-lib) is vendored in `lib/` rather than loaded from a CDN. Everything stays on your machine.

## The "started debugging this browser" bar

Because fullshot uses `chrome.debugger`, Chrome shows a "fullshot started debugging this browser" bar while a capture runs. This is expected, Chrome doesn't let extensions hide it, and fullshot detaches the debugger as soon as the capture finishes. It's also why this project is distributed as source rather than through the Web Store, where the `debugger` permission shows a scary install warning and gets extra review.

## Troubleshooting

- **Nothing happens / red ✗ badge:** open `chrome://extensions`, click the **service worker** link on fullshot's card, and look at the console. Errors are logged there. After changing any code, click the reload icon on the card.
- **A Save As dialog appears:** you have Chrome's "Ask where to save each file before downloading" setting on (`chrome://settings/downloads`). Chrome applies it regardless of what an extension asks for.
- **Shortcut doesn't fire:** check `chrome://extensions/shortcuts`; Chrome sometimes keeps a previously assigned key instead of picking up the manifest default.
- **"Cannot access a chrome-extension:// URL of different extension":** Chrome refuses to attach the debugger when another extension has put content into the page (an injected panel or iframe, as some writing assistants and password managers do). Disable your other extensions on that site, or try an Incognito window with only fullshot enabled.
- **Can't capture a page:** Chrome blocks extensions on `chrome://` pages, the Web Store, and some other internal pages.

## Known limitations

- **Virtualized lists** (rows that don't exist in the DOM until scrolled into view) can't be captured past what's rendered; there is nothing to unclip.
- **Fixed-position UI** such as a chat composer or floating toolbar can land mid-page instead of staying pinned, since unclipping app-style layouts turns some fixed/absolute elements into normal flow for the capture.
- **Claude PDF tiles are cropped at a fixed height**, so a paragraph or table can be split across two pages. Nothing is lost (the text layer is continuous), but it reads less cleanly than Vector PDF.
- **The text layer is best-effort:** it uses a standard font, so characters outside WinAnsi (CJK, emoji) are skipped, and positions are approximated from DOM rects.

## Project layout

```
manifest.json
background/   service worker: capture orchestration, stitching, PDF/image building, saving, options
content/       in-page snippets run via the debugger's Runtime.evaluate (not a declared content script)
offscreen/     offscreen document: clipboard writes and blob: URLs, which a service worker can't do
popup/         toolbar popup
options/       options page
lib/           vendored pdf-lib (MIT)
docs/SPEC.md   design notes and decisions
```

No build step: plain JavaScript, edit and reload.

## License

[MIT](LICENSE). The vendored pdf-lib is MIT-licensed too; see `lib/pdf-lib.LICENSE.md`.

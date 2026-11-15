import { uint8ArrayToBase64 } from "./util.js";

// Chrome only lets a *focused* document write images to the clipboard, and
// the service worker has no document while the offscreen document is never
// focused. So the image is handed to a small focused extension window
// (clipboard/clipboard.html), which writes it and reports back.

const CLIPBOARD_PAGE = "clipboard/clipboard.html";
const TIMEOUT_MS = 20000;

let pending = null; // { payload, finish(message) }

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "clipboard-bridge") return false;

  if (message.type === "ready") {
    sendResponse(pending ? pending.payload : null);
  } else if (message.type === "done") {
    pending?.finish(message);
    sendResponse({ ok: true });
  }
  return false;
});

export async function writeBlobToClipboard(blob) {
  const buffer = await blob.arrayBuffer();
  const payload = {
    base64: uint8ArrayToBase64(new Uint8Array(buffer)),
    mimeType: blob.type || "image/png",
  };

  // Remember where the user was so the helper window can sit in a corner of
  // it and focus can be handed straight back when it closes.
  const previous = await chrome.windows.getLastFocused().catch(() => null);

  let windowId = null;
  let onRemoved = null;
  let timer = null;

  const done = new Promise((resolve, reject) => {
    pending = {
      payload,
      finish: (message) => (message.ok ? resolve() : reject(new Error(message.error || "Clipboard write failed"))),
    };
    timer = setTimeout(() => reject(new Error("Timed out waiting for the clipboard window")), TIMEOUT_MS);
    onRemoved = (id) => {
      if (id === windowId) reject(new Error("The clipboard window was closed before the copy finished"));
    };
    chrome.windows.onRemoved.addListener(onRemoved);
  });

  try {
    const size = { width: 160, height: 70 };
    const position =
      previous && previous.left != null
        ? {
            left: previous.left + previous.width - size.width - 16,
            top: previous.top + previous.height - size.height - 16,
          }
        : {};
    const win = await chrome.windows.create({
      url: chrome.runtime.getURL(CLIPBOARD_PAGE),
      type: "popup",
      focused: true,
      ...size,
      ...position,
    });
    windowId = win.id;
    await done;
  } finally {
    clearTimeout(timer);
    chrome.windows.onRemoved.removeListener(onRemoved);
    pending = null;
    if (windowId != null) await chrome.windows.remove(windowId).catch(() => {});
    if (previous?.id != null) await chrome.windows.update(previous.id, { focused: true }).catch(() => {});
  }
}

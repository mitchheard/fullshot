// A tiny real window used only to put a screenshot on the clipboard.
// Chrome refuses navigator.clipboard.write() unless the document has focus,
// and neither the service worker nor the (hidden) offscreen document can
// ever be focused. This window is opened focused, writes, and is closed by
// the service worker (see background/clipboard.js).

import { base64ToUint8Array } from "../background/util.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForFocus() {
  window.focus();
  for (let i = 0; i < 30 && !document.hasFocus(); i++) await sleep(100);
}

function report(message) {
  return chrome.runtime.sendMessage({ target: "clipboard-bridge", type: "done", ...message });
}

(async () => {
  try {
    const payload = await chrome.runtime.sendMessage({ target: "clipboard-bridge", type: "ready" });
    if (!payload) throw new Error("No image was waiting to be copied");

    const blob = new Blob([base64ToUint8Array(payload.base64)], { type: payload.mimeType });
    await waitForFocus();
    await navigator.clipboard.write([new ClipboardItem({ [payload.mimeType]: blob })]);
    await report({ ok: true });
  } catch (err) {
    await report({ ok: false, error: String(err && err.message ? err.message : err) });
  }
})();

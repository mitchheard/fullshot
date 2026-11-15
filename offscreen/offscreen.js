// Runs inside the extension's offscreen document — a real (but hidden)
// document context. It does what the service worker can't: create a
// blob: URL (via URL.createObjectURL). chrome.downloads isn't available
// from an offscreen document, so the actual download call happens back
// in the service worker using the URL this hands it. It can't write to the
// clipboard because it is never focused; see clipboard/clipboard.js.
//
// Binary payloads arrive as base64 strings, not ArrayBuffers —
// chrome.runtime.sendMessage doesn't reliably preserve ArrayBuffer
// instances across contexts (they can arrive as plain, unusable
// objects), but strings always survive.

import { base64ToUint8Array } from "../background/util.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen") return false;

  if (message.type === "create-object-url") {
    try {
      const bytes = base64ToUint8Array(message.base64);
      const blob = new Blob([bytes], { type: message.mimeType });
      const url = URL.createObjectURL(blob);
      sendResponse({ ok: true, url });
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
    }
    return true;
  }

  if (message.type === "revoke-object-url") {
    try {
      URL.revokeObjectURL(message.url);
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
    }
    return true;
  }

  return false;
});

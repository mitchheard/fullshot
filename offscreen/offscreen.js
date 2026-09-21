// Runs inside the extension's offscreen document — the only place
// with a real document context, needed for navigator.clipboard.write()
// and for URL.createObjectURL() (neither exists in the service
// worker), so both clipboard writes and downloads happen here.

import { performDownload } from "../background/download-core.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen") return false;

  if (message.type === "write-clipboard") {
    (async () => {
      try {
        const blob = new Blob([message.buffer], { type: message.mimeType });
        await navigator.clipboard.write([new ClipboardItem({ [message.mimeType]: blob })]);
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();
    return true;
  }

  if (message.type === "save-download") {
    (async () => {
      try {
        const downloadId = await performDownload(message);
        sendResponse({ ok: true, downloadId });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();
    return true;
  }

  return false;
});

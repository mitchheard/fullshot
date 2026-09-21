// Runs inside the extension's offscreen document. Its only job is
// writing image bytes to the system clipboard, since
// navigator.clipboard.write() needs a document context that a
// service worker doesn't have.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen" || message.type !== "write-clipboard") return false;

  (async () => {
    try {
      const blob = new Blob([message.buffer], { type: message.mimeType });
      await navigator.clipboard.write([new ClipboardItem({ [message.mimeType]: blob })]);
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
    }
  })();

  return true; // keep the message channel open for the async sendResponse
});

// Runs inside the extension's offscreen document — the only place
// with a real document context. It does two things the service worker
// can't: write to the clipboard, and create a blob: URL (via
// URL.createObjectURL). chrome.downloads isn't available from an
// offscreen document, so the actual download call happens back in the
// service worker using the URL this hands it.

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

  if (message.type === "create-object-url") {
    try {
      const blob = new Blob([message.buffer], { type: message.mimeType });
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

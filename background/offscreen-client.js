// Shared helper for talking to the offscreen document — used for
// downloads, since the service worker has no document context
// (no URL.createObjectURL).

const OFFSCREEN_URL = "offscreen/offscreen.html";

export async function ensureOffscreenDocument() {
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["BLOBS"],
      justification: "Mint blob: URLs for downloads.",
    });
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    if (!message.toLowerCase().includes("offscreen document")) throw err;
    // Already exists — fine, reuse it.
  }
}

export async function sendToOffscreen(message) {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({ target: "offscreen", ...message });
  if (!response?.ok) {
    throw new Error(response?.error || `Offscreen message "${message.type}" failed`);
  }
  return response;
}

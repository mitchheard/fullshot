const OFFSCREEN_URL = "offscreen/offscreen.html";

async function ensureOffscreenDocument() {
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["CLIPBOARD"],
      justification: "Write the captured screenshot to the system clipboard.",
    });
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    if (!message.toLowerCase().includes("offscreen document")) throw err;
    // Already exists — fine, reuse it.
  }
}

export async function writeBlobToClipboard(blob) {
  await ensureOffscreenDocument();
  const buffer = await blob.arrayBuffer();
  const response = await chrome.runtime.sendMessage({
    target: "offscreen",
    type: "write-clipboard",
    buffer,
    mimeType: blob.type || "image/png",
  });
  if (!response?.ok) {
    throw new Error(response?.error || "Clipboard write failed");
  }
}

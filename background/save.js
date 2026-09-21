// Saving a Blob requires URL.createObjectURL(), which doesn't exist in
// the service worker — the actual chrome.downloads.download() call
// happens in the offscreen document (see download-core.js); this just
// hands it the bytes and gives lightweight toolbar-badge feedback.

import { sendToOffscreen } from "./offscreen-client.js";

export async function saveBlob(blob, relativePath) {
  const buffer = await blob.arrayBuffer();
  const response = await sendToOffscreen({
    type: "save-download",
    buffer,
    mimeType: blob.type || "application/octet-stream",
    filename: relativePath,
  });
  return response.downloadId;
}

export function tilesDirFor(relativePath) {
  return relativePath.replace(/\.[^./]+$/, "-tiles");
}

let badgeTimer = null;

export function flashBadge(text, color, ms = 2000) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => chrome.action.setBadgeText({ text: "" }), ms);
}

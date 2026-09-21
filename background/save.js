// Saving a Blob needs a blob: URL, which needs URL.createObjectURL() —
// not available in the service worker, only in a real document. So
// the offscreen document mints the URL, and chrome.downloads.download
// (which *is* available here, unlike in the offscreen document) runs
// in the service worker against that URL.

import { sendToOffscreen } from "./offscreen-client.js";

function waitForDownloadSettled(downloadId) {
  return new Promise((resolve, reject) => {
    let settled = false;

    function settle(fn, arg) {
      if (settled) return;
      settled = true;
      chrome.downloads.onChanged.removeListener(onChanged);
      fn(arg);
    }

    function onChanged(delta) {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === "complete") settle(resolve, downloadId);
      else if (delta.state?.current === "interrupted") {
        settle(reject, new Error(delta.error?.current || "Download interrupted"));
      }
    }

    chrome.downloads.onChanged.addListener(onChanged);

    // In case it already settled before the listener was attached.
    chrome.downloads.search({ id: downloadId }, ([item] = []) => {
      if (!item) return;
      if (item.state === "complete") settle(resolve, downloadId);
      else if (item.state === "interrupted") settle(reject, new Error("Download interrupted"));
    });
  });
}

export async function saveBlob(blob, relativePath) {
  const buffer = await blob.arrayBuffer();
  const { url } = await sendToOffscreen({
    type: "create-object-url",
    buffer,
    mimeType: blob.type || "application/octet-stream",
  });

  try {
    const downloadId = await new Promise((resolve, reject) => {
      chrome.downloads.download(
        { url, filename: relativePath, saveAs: false, conflictAction: "uniquify" },
        (id) => {
          if (chrome.runtime.lastError || id === undefined) {
            reject(new Error(chrome.runtime.lastError?.message || "Download failed to start"));
            return;
          }
          resolve(id);
        }
      );
    });
    await waitForDownloadSettled(downloadId);
    return downloadId;
  } finally {
    sendToOffscreen({ type: "revoke-object-url", url }).catch(() => {});
  }
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

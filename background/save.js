// chrome.downloads wrapper: turns a Blob into a saved file at a
// deterministic path under Downloads/, and gives lightweight
// success/failure feedback via the toolbar badge (no "notifications"
// permission needed for that).

function waitForDownloadSettled(downloadId, objectUrl) {
  return new Promise((resolve, reject) => {
    let settled = false;

    function cleanup() {
      chrome.downloads.onChanged.removeListener(onChanged);
      URL.revokeObjectURL(objectUrl);
    }

    function settle(fn, arg) {
      if (settled) return;
      settled = true;
      cleanup();
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
  const url = URL.createObjectURL(blob);
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
  }).catch((err) => {
    URL.revokeObjectURL(url);
    throw err;
  });

  await waitForDownloadSettled(downloadId, url);
  return downloadId;
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

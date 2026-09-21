// Actually performs a chrome.downloads.download() call. Must run in a
// context with URL.createObjectURL (a real document) — the background
// service worker doesn't have it, so this only ever runs inside the
// offscreen document.

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

export async function performDownload({ buffer, mimeType, filename }) {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);

  try {
    const downloadId = await new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename, saveAs: false, conflictAction: "uniquify" }, (id) => {
        if (chrome.runtime.lastError || id === undefined) {
          reject(new Error(chrome.runtime.lastError?.message || "Download failed to start"));
          return;
        }
        resolve(id);
      });
    });
    await waitForDownloadSettled(downloadId);
    return downloadId;
  } finally {
    URL.revokeObjectURL(url);
  }
}

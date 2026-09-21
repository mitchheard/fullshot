// Drives chrome.debugger + the Chrome DevTools Protocol to capture a
// full page: pre-scroll for lazy content, measure the document, then
// capture it in vertical clip segments beyond the viewport (which is
// what avoids repeated sticky/fixed headers, unlike naive
// scroll-and-screenshot approaches).

import {
  preScrollPage,
  collectVisibleTextNodes,
  unclipScrollContainers,
  restoreScrollContainers,
} from "../content/text-extractor.js";

const PROTOCOL_VERSION = "1.3";
const SEGMENT_MAX_CSS_HEIGHT = 4000; // conservative, well under CDP's clip limits

function sendCommand(tabId, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`${method} failed: ${chrome.runtime.lastError.message}`));
        return;
      }
      resolve(result);
    });
  });
}

async function attach(tabId) {
  await new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, PROTOCOL_VERSION, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

async function detach(tabId) {
  await new Promise((resolve) => {
    chrome.debugger.detach({ tabId }, () => {
      // Swallow "not attached" errors; detach is best-effort cleanup.
      void chrome.runtime.lastError;
      resolve();
    });
  });
}

async function runInPage(tabId, fnSource, { awaitPromise = false } = {}) {
  const result = await sendCommand(tabId, "Runtime.evaluate", {
    expression: fnSource,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
    throw new Error(`Page script failed: ${text}`);
  }
  return result.result?.value;
}

async function withDebugger(tabId, fn) {
  await attach(tabId);
  try {
    await sendCommand(tabId, "Page.enable", {});
    // Trigger lazy-loaded content, then settle back at the original scroll spot.
    await runInPage(tabId, `(${preScrollPage.toString()})()`, { awaitPromise: true });
    // Strip clipping off internally-scrolling panes (app-shell layouts,
    // dashboards) so their real content height joins the document's
    // layout — otherwise Page.getLayoutMetrics only sees one viewport.
    await runInPage(tabId, `(${unclipScrollContainers.toString()})()`);
    try {
      return await fn();
    } finally {
      await runInPage(tabId, `(${restoreScrollContainers.toString()})()`).catch(() => {});
    }
  } finally {
    await detach(tabId);
  }
}

/**
 * Captures the full page. Returns raw segment PNGs (base64), overall
 * page dimensions in CSS pixels, and the extracted text-node layout.
 */
export async function captureFullPage(tab) {
  const tabId = tab.id;
  return withDebugger(tabId, async () => {
    const dpr = (await runInPage(tabId, "window.devicePixelRatio")) || 1;

    const metrics = await sendCommand(tabId, "Page.getLayoutMetrics", {});
    const contentSize = metrics.cssContentSize || metrics.contentSize;
    const totalWidth = Math.ceil(contentSize.width);
    const totalHeight = Math.ceil(contentSize.height);

    const textNodes = await runInPage(tabId, `(${collectVisibleTextNodes.toString()})()`);

    const segments = [];
    for (let y = 0; y < totalHeight; y += SEGMENT_MAX_CSS_HEIGHT) {
      const segHeight = Math.min(SEGMENT_MAX_CSS_HEIGHT, totalHeight - y);
      const { data } = await sendCommand(tabId, "Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { x: 0, y, width: totalWidth, height: segHeight, scale: 1 / dpr },
      });
      segments.push({ y, height: segHeight, base64: data });
    }

    return {
      tab,
      width: totalWidth,
      height: totalHeight,
      dpr,
      segments,
      textNodes: textNodes || [],
    };
  });
}

/**
 * Mode B "Vector PDF": let Chrome's native print pipeline render the
 * whole page as a single PDF page sized to the full document.
 * Returns raw PDF bytes (base64) straight from CDP.
 */
export async function captureVectorPdf(tab) {
  const tabId = tab.id;
  return withDebugger(tabId, async () => {
    const metrics = await sendCommand(tabId, "Page.getLayoutMetrics", {});
    const contentSize = metrics.cssContentSize || metrics.contentSize;
    const widthIn = Math.max(1, contentSize.width) / 96;
    const heightIn = Math.max(1, contentSize.height) / 96;

    await sendCommand(tabId, "Emulation.setEmulatedMedia", { media: "screen" });

    const { data } = await sendCommand(tabId, "Page.printToPDF", {
      printBackground: true,
      paperWidth: widthIn,
      paperHeight: heightIn,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      preferCSSPageSize: false,
      scale: 1,
    });

    return { base64: data };
  });
}

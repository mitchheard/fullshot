import { getOptions } from "./options-store.js";
import { buildTokens, buildRelativePath } from "./filename.js";
import { captureFullPage, captureVectorPdf } from "./capture.js";
import { compositeFullPage, canvasToPngBlob, canvasToJpegBlob, sliceIntoTiles } from "./stitch.js";
import { buildClaudePdf } from "./pdf-builder.js";
import { saveBlob, tilesDirFor, flashBadge } from "./save.js";
import { writeBlobToClipboard } from "./clipboard.js";
import { base64ToUint8Array } from "./util.js";

const TILE_HEIGHT_CSS = 2400;

async function saveTiles(bigCanvas, width, height, relativePath) {
  const tiles = await sliceIntoTiles(bigCanvas, width, height, TILE_HEIGHT_CSS);
  const dir = tilesDirFor(relativePath);
  for (let i = 0; i < tiles.length; i++) {
    const name = `${dir}/tile-${String(i + 1).padStart(2, "0")}.png`;
    await saveBlob(tiles[i].blob, name);
  }
}

async function runCapturePdf(tab, options, tokens) {
  let blob;
  if (options.pdfMode === "vector") {
    const { base64 } = await captureVectorPdf(tab);
    blob = new Blob([base64ToUint8Array(base64)], { type: "application/pdf" });
  } else {
    const capture = await captureFullPage(tab);
    const bigCanvas = await compositeFullPage(capture.segments, capture.width, capture.height);
    const tiles = await sliceIntoTiles(bigCanvas, capture.width, capture.height, TILE_HEIGHT_CSS);
    const pdfBytes = await buildClaudePdf(tiles, capture.textNodes);
    blob = new Blob([pdfBytes], { type: "application/pdf" });
  }

  const relativePath = buildRelativePath(options, tokens, "pdf");
  await saveBlob(blob, relativePath);
}

async function runCaptureImage(tab, options, tokens) {
  const capture = await captureFullPage(tab);
  const bigCanvas = await compositeFullPage(capture.segments, capture.width, capture.height);

  // The system clipboard only reliably accepts PNG image data, so the
  // clipboard copy is always PNG regardless of the configured save format.
  const clipboardBlob = await canvasToPngBlob(bigCanvas);

  const useJpeg = options.imageFormat === "jpeg";
  const savedBlob = useJpeg ? await canvasToJpegBlob(bigCanvas, options.jpegQuality) : clipboardBlob;
  const ext = useJpeg ? "jpg" : "png";

  const relativePath = buildRelativePath(options, tokens, ext);
  await saveBlob(savedBlob, relativePath);
  await writeBlobToClipboard(clipboardBlob);

  if (options.alsoSaveTiles) {
    await saveTiles(bigCanvas, capture.width, capture.height, relativePath);
  }
}

async function runCapture(tab, formatOverride) {
  if (!tab?.id || !/^https?:/.test(tab.url || "")) {
    flashBadge("✗", "#dc2626");
    console.warn("FullShot: capture skipped, unsupported page", tab?.url);
    return;
  }

  flashBadge("…", "#2563eb", 60000);

  try {
    const options = await getOptions();
    const format = formatOverride || options.defaultFormat;
    const tokens = buildTokens({ url: tab.url, title: tab.title });

    if (format === "image") {
      await runCaptureImage(tab, options, tokens);
    } else {
      await runCapturePdf(tab, options, tokens);
    }

    flashBadge("✓", "#16a34a");
  } catch (err) {
    console.error("FullShot capture failed:", err);
    flashBadge("✗", "#dc2626", 4000);
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "capture-default") runCapture(tab);
  else if (command === "capture-image") runCapture(tab, "image");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== "background" || message?.type !== "capture") return false;

  (async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await runCapture(activeTab, message.format);
    sendResponse({ ok: true });
  })();

  return true;
});

// Composites captured segments into one full-page canvas, then can
// slice that into fixed-height tiles (for the Claude PDF mode) or
// export it as a single flat image. Runs in the background service
// worker, which supports OffscreenCanvas directly.

import { base64ToUint8Array } from "./util.js";

function base64ToBlob(base64, mime = "image/png") {
  return new Blob([base64ToUint8Array(base64)], { type: mime });
}

export async function compositeFullPage(segments, width, height) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");

  for (const segment of segments) {
    const blob = base64ToBlob(segment.base64);
    const bitmap = await createImageBitmap(blob);
    ctx.drawImage(bitmap, 0, segment.y);
    bitmap.close?.();
  }

  return canvas;
}

export async function canvasToPngBlob(canvas, quality) {
  return canvas.convertToBlob({ type: "image/png", quality });
}

export async function canvasToJpegBlob(canvas, qualityPercent = 90) {
  return canvas.convertToBlob({ type: "image/jpeg", quality: qualityPercent / 100 });
}

/**
 * Slices a full-page canvas into fixed-height horizontal tiles.
 * Returns [{ blob, y, width, height }] in top-to-bottom order.
 */
export async function sliceIntoTiles(fullCanvas, width, totalHeight, tileHeight) {
  const tiles = [];
  for (let y = 0; y < totalHeight; y += tileHeight) {
    const thisHeight = Math.min(tileHeight, totalHeight - y);
    const tileCanvas = new OffscreenCanvas(width, thisHeight);
    const ctx = tileCanvas.getContext("2d");
    ctx.drawImage(fullCanvas, 0, y, width, thisHeight, 0, 0, width, thisHeight);
    const blob = await canvasToPngBlob(tileCanvas);
    tiles.push({ blob, y, width, height: thisHeight });
  }
  return tiles;
}

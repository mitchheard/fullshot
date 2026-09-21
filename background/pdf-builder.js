// Mode A "Claude PDF": one tile per PDF page, each tile embedded as a
// PNG with an invisible (zero-opacity) text layer positioned over the
// matching source text, so the PDF stays searchable/selectable.
//
// Mode B "Vector PDF" doesn't touch pdf-lib at all — it's just the raw
// bytes CDP's Page.printToPDF already produced.

import "../lib/pdf-lib.min.js";
import { clamp } from "./util.js";

const { PDFDocument, StandardFonts } = self.PDFLib;

/**
 * @param {Array<{blob: Blob, y: number, width: number, height: number}>} tiles
 * @param {Array<{text: string, x: number, y: number, width: number, height: number}>} textNodes
 */
export async function buildClaudePdf(tiles, textNodes) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const tile of tiles) {
    const page = pdfDoc.addPage([tile.width, tile.height]);
    const pngBytes = new Uint8Array(await tile.blob.arrayBuffer());
    const pngImage = await pdfDoc.embedPng(pngBytes);
    page.drawImage(pngImage, { x: 0, y: 0, width: tile.width, height: tile.height });

    const tileTop = tile.y;
    const tileBottom = tile.y + tile.height;

    for (const node of textNodes) {
      const nodeTop = node.y;
      const nodeBottom = node.y + node.height;
      if (nodeBottom <= tileTop || nodeTop >= tileBottom) continue;

      const localTop = Math.max(0, nodeTop - tileTop);
      const localBottom = Math.min(tile.height, nodeBottom - tileTop);
      const localHeight = localBottom - localTop;
      if (localHeight < 2 || node.width < 2) continue;

      const fontSize = clamp(localHeight * 0.85, 4, 40);
      const pdfX = clamp(node.x, 0, tile.width);
      const pdfY = clamp(tile.height - localBottom, 0, tile.height);

      try {
        page.drawText(node.text, {
          x: pdfX,
          y: pdfY,
          size: fontSize,
          font,
          opacity: 0,
          maxWidth: Math.max(1, node.width),
        });
      } catch {
        // pdf-lib's standard fonts only encode WinAnsi text; silently
        // skip anything else (emoji, CJK, etc.) rather than failing
        // the whole capture over a best-effort text layer.
      }
    }
  }

  return pdfDoc.save();
}

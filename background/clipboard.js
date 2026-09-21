import { sendToOffscreen } from "./offscreen-client.js";

export async function writeBlobToClipboard(blob) {
  const buffer = await blob.arrayBuffer();
  await sendToOffscreen({
    type: "write-clipboard",
    buffer,
    mimeType: blob.type || "image/png",
  });
}

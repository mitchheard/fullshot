import { sendToOffscreen } from "./offscreen-client.js";
import { uint8ArrayToBase64 } from "./util.js";

export async function writeBlobToClipboard(blob) {
  const buffer = await blob.arrayBuffer();
  await sendToOffscreen({
    type: "write-clipboard",
    base64: uint8ArrayToBase64(new Uint8Array(buffer)),
    mimeType: blob.type || "image/png",
  });
}

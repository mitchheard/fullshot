export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function base64ToUint8Array(base64) {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  return bytes;
}

// chrome.runtime.sendMessage doesn't reliably preserve ArrayBuffer/typed
// array instances across contexts (they can arrive as plain objects) —
// base64 strings always survive, so binary payloads sent between the
// service worker and the offscreen document go through this instead.
export function uint8ArrayToBase64(bytes) {
  const CHUNK_SIZE = 0x8000; // avoid call-stack limits on String.fromCharCode.apply
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

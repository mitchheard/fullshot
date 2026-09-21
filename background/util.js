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

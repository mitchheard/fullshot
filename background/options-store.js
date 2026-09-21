// Shared options schema + storage helpers. Imported by the background
// service worker, the popup, and the options page.

export const DEFAULT_OPTIONS = {
  defaultFormat: "pdf", // "pdf" | "image"
  pdfMode: "claude", // "claude" | "vector"
  imageFormat: "png", // "png" | "jpeg"
  jpegQuality: 90, // 0-100
  baseFolder: "FullShot",
  subfolders: "month", // "none" | "month" | "domain"
  filenamePreset: "domain_date_title", // "domain_date_title" | "title_date" | "date_domain" | "custom"
  customTemplate: "{domain}_{date}-{time}_{title}",
  alsoSaveTiles: false,
};

const STORAGE_KEY = "fullshotOptions";

export async function getOptions() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_OPTIONS, ...(stored[STORAGE_KEY] || {}) };
}

export async function setOptions(partial) {
  const current = await getOptions();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

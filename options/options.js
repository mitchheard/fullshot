import { getOptions, setOptions, DEFAULT_OPTIONS } from "../background/options-store.js";
import { exampleFilename } from "../background/filename.js";

function getRadioValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : undefined;
}

function setRadioValue(name, value) {
  const target = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (target) target.checked = true;
}

const el = {
  jpegQuality: document.getElementById("jpegQuality"),
  baseFolder: document.getElementById("baseFolder"),
  alsoSaveTiles: document.getElementById("alsoSaveTiles"),
  customTemplate: document.getElementById("customTemplate"),
  preview: document.getElementById("preview"),
  saved: document.getElementById("saved-indicator"),
  jpegRow: document.getElementById("jpeg-quality-row"),
  customRow: document.getElementById("custom-template-row"),
};

function readForm() {
  return {
    defaultFormat: getRadioValue("defaultFormat") || DEFAULT_OPTIONS.defaultFormat,
    pdfMode: getRadioValue("pdfMode") || DEFAULT_OPTIONS.pdfMode,
    imageFormat: getRadioValue("imageFormat") || DEFAULT_OPTIONS.imageFormat,
    jpegQuality: Number(el.jpegQuality.value) || DEFAULT_OPTIONS.jpegQuality,
    baseFolder: el.baseFolder.value.trim() || DEFAULT_OPTIONS.baseFolder,
    subfolders: getRadioValue("subfolders") || DEFAULT_OPTIONS.subfolders,
    filenamePreset: getRadioValue("filenamePreset") || DEFAULT_OPTIONS.filenamePreset,
    customTemplate: el.customTemplate.value.trim() || DEFAULT_OPTIONS.customTemplate,
    alsoSaveTiles: el.alsoSaveTiles.checked,
  };
}

function updateVisibility(options) {
  el.jpegRow.style.display = options.imageFormat === "jpeg" ? "inline-flex" : "none";
  el.customRow.style.display = options.filenamePreset === "custom" ? "flex" : "none";
}

function updatePreview(options) {
  el.preview.textContent = exampleFilename(options);
}

function applyToForm(options) {
  setRadioValue("defaultFormat", options.defaultFormat);
  setRadioValue("pdfMode", options.pdfMode);
  setRadioValue("imageFormat", options.imageFormat);
  el.jpegQuality.value = options.jpegQuality;
  el.baseFolder.value = options.baseFolder;
  setRadioValue("subfolders", options.subfolders);
  setRadioValue("filenamePreset", options.filenamePreset);
  el.customTemplate.value = options.customTemplate;
  el.alsoSaveTiles.checked = options.alsoSaveTiles;
  updateVisibility(options);
  updatePreview(options);
}

let savedIndicatorTimer = null;

async function onChange() {
  const options = readForm();
  updateVisibility(options);
  updatePreview(options);
  await setOptions(options);
  el.saved.textContent = "Saved";
  clearTimeout(savedIndicatorTimer);
  savedIndicatorTimer = setTimeout(() => {
    el.saved.textContent = "";
  }, 1200);
}

document.querySelectorAll("input").forEach((input) => {
  input.addEventListener("change", onChange);
  if (input.type === "text" || input.type === "number") {
    input.addEventListener("input", onChange);
  }
});

getOptions().then(applyToForm);

const statusEl = document.getElementById("status");

document.getElementById("gear").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

function trigger(format) {
  chrome.runtime.sendMessage({ target: "background", type: "capture", format });
  statusEl.classList.remove("error");
  statusEl.textContent = "Capturing… you can close this.";
  setTimeout(() => window.close(), 600);
}

document.getElementById("btn-pdf").addEventListener("click", () => trigger("pdf"));
document.getElementById("btn-image").addEventListener("click", () => trigger("image"));

chrome.storage.local.get("lastError").then(({ lastError }) => {
  if (!lastError) return;
  const message = lastError.message.length > 240 ? `${lastError.message.slice(0, 240)}…` : lastError.message;
  statusEl.classList.add("error");
  statusEl.textContent = `Last capture failed: ${message}`;
});

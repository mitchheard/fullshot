document.getElementById("gear").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

function trigger(format) {
  chrome.runtime.sendMessage({ target: "background", type: "capture", format });
  document.getElementById("status").textContent = "Capturing… you can close this.";
  setTimeout(() => window.close(), 600);
}

document.getElementById("btn-pdf").addEventListener("click", () => trigger("pdf"));
document.getElementById("btn-image").addEventListener("click", () => trigger("image"));

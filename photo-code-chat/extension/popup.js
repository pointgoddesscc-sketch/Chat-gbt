const domainInput = document.getElementById("domain");
const statusEl = document.getElementById("status");

chrome.storage.local.get(["domain"], (data) => {
  domainInput.value = data.domain || "https://yourdomain.com";
});

document.getElementById("save").onclick = () => {
  chrome.storage.local.set({ domain: normalizeDomain(domainInput.value) });
  statusEl.textContent = "Domain saved.";
};

document.getElementById("capture").onclick = async () => {
  const domain = normalizeDomain(domainInput.value);

  if (!domain) {
    statusEl.textContent = "Enter your PhotoCode website URL first.";
    return;
  }

  chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = chrome.runtime.lastError.message;
      return;
    }

    chrome.tabs.create({
      url: `${domain}/?captured=${encodeURIComponent(dataUrl)}`
    });
  });
};

function normalizeDomain(value) {
  return value.trim().replace(/\/$/, "");
}

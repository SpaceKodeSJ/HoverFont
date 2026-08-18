const ENABLED_KEY = "hoverFontEnabled";
const toggleButton = document.getElementById("toggleButton");
const statusText = document.getElementById("status");

function renderState(enabled) {
  toggleButton.textContent = enabled
    ? "Turn HoverFont off"
    : "Turn HoverFont on";

  statusText.textContent = enabled
    ? "HoverFont is on for normal webpages. Ctrl+Shift+F toggles it."
    : "HoverFont is off. Ctrl+Shift+F toggles it.";

  statusText.dataset.type = enabled ? "success" : "neutral";
}

async function getEnabled() {
  const result = await chrome.storage.local.get({ [ENABLED_KEY]: false });
  return Boolean(result[ENABLED_KEY]);
}

async function ensureCurrentPageHasHoverFont() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    try {
      await chrome.tabs.sendMessage(tab.id, { action: "ping" });
    } catch (_error) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
    }
  } catch (_error) {
    // Restricted Chrome pages cannot be scripted. The global state is still saved
    // and will apply automatically on the next normal webpage.
  }
}

async function setEnabled(enabled) {
  await chrome.storage.local.set({ [ENABLED_KEY]: Boolean(enabled) });
  await ensureCurrentPageHasHoverFont();
  renderState(Boolean(enabled));
}

toggleButton.addEventListener("click", async () => {
  toggleButton.disabled = true;

  try {
    const enabled = await getEnabled();
    await setEnabled(!enabled);
  } catch (error) {
    console.error("HoverFont toggle failed:", error);
    statusText.textContent = "HoverFont could not change state. Try reloading the extension.";
    statusText.dataset.type = "error";
  } finally {
    toggleButton.disabled = false;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[ENABLED_KEY]) return;
  renderState(Boolean(changes[ENABLED_KEY].newValue));
});

getEnabled()
  .then(renderState)
  .catch((error) => {
    console.error("HoverFont state read failed:", error);
    statusText.textContent = "Could not read HoverFont state.";
    statusText.dataset.type = "error";
  });

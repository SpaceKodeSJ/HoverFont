const ENABLED_KEY = "hoverFontEnabled";

async function getEnabled() {
  const result = await chrome.storage.local.get({ [ENABLED_KEY]: false });
  return Boolean(result[ENABLED_KEY]);
}

async function setEnabled(enabled) {
  await chrome.storage.local.set({ [ENABLED_KEY]: Boolean(enabled) });
}

async function toggleEnabled() {
  const enabled = await getEnabled();
  await setEnabled(!enabled);
  return !enabled;
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(ENABLED_KEY);
  if (typeof current[ENABLED_KEY] !== "boolean") {
    await setEnabled(false);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-hoverfont") {
    toggleEnabled().catch((error) => {
      console.error("HoverFont shortcut toggle failed:", error);
    });
  }
});

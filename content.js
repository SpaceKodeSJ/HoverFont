(() => {
  if (globalThis.__hoverFontLoaded) {
    return;
  }
  globalThis.__hoverFontLoaded = true;

  let active = false;
  let uiHost = null;
  let shadowRoot = null;
  let tooltip = null;
  let statusBadge = null;
  let lastHoveredElement = null;
  let savedFonts = new Set();

  const UI_Z_INDEX = "2147483647";
  const TOOLTIP_OFFSET = 14;
  const VIEWPORT_MARGIN = 10;

  const SIMILAR_FONT_MAP = {
    wiredDisplay: ["Oswald", "Roboto Condensed", "Barlow Condensed"],
    inter: ["Manrope", "DM Sans", "Roboto"],
    arial: ["Helvetica", "Roboto", "Liberation Sans"],
    helvetica: ["Arial", "Inter", "Roboto"],
    roboto: ["Inter", "Open Sans", "Noto Sans"],
    "open sans": ["Roboto", "Lato", "Noto Sans"],
    lato: ["Open Sans", "Roboto", "Source Sans 3"],
    montserrat: ["Poppins", "Raleway", "Gotham"],
    poppins: ["Montserrat", "Nunito Sans", "DM Sans"],
    raleway: ["Montserrat", "Avenir", "Nunito Sans"],
    "dm sans": ["Inter", "Manrope", "Plus Jakarta Sans"],
    manrope: ["Inter", "DM Sans", "Plus Jakarta Sans"],
    "plus jakarta sans": ["Manrope", "DM Sans", "Inter"],
    avenir: ["Montserrat", "Nunito Sans", "Century Gothic"],
    futura: ["Century Gothic", "Montserrat", "Avenir"],
    gotham: ["Montserrat", "Proxima Nova", "Avenir"],
    "proxima nova": ["Montserrat", "Avenir", "Inter"],
    nunito: ["Quicksand", "Varela Round", "Nunito Sans"],
    "nunito sans": ["DM Sans", "Poppins", "Inter"],
    quicksand: ["Nunito", "Varela Round", "Comfortaa"],
    oswald: ["Roboto Condensed", "Barlow Condensed", "Bebas Neue"],
    "roboto condensed": ["Oswald", "Barlow Condensed", "Archivo Narrow"],
    "barlow condensed": ["Roboto Condensed", "Oswald", "Archivo Narrow"],
    "bebas neue": ["Oswald", "Anton", "Barlow Condensed"],
    georgia: ["Merriweather", "Lora", "Libre Baskerville"],
    "times new roman": ["Libre Baskerville", "Lora", "Source Serif 4"],
    merriweather: ["Lora", "Libre Baskerville", "Source Serif 4"],
    lora: ["Merriweather", "Libre Baskerville", "Cormorant Garamond"],
    garamond: ["Cormorant Garamond", "EB Garamond", "Libre Baskerville"],
    "courier new": ["Roboto Mono", "IBM Plex Mono", "Source Code Pro"],
    monospace: ["Roboto Mono", "IBM Plex Mono", "Source Code Pro"]
  };

  function cleanFontName(fontName) {
    return String(fontName || "")
      .replace(/["']/g, "")
      .trim();
  }

  function getPrimaryFontName(fontFamily) {
    return cleanFontName(String(fontFamily || "").split(",")[0]);
  }

  function getSimilarFonts(fontFamily) {
    const primaryFont = getPrimaryFontName(fontFamily);
    const key = primaryFont.toLowerCase();

    if (key === "wireddisplay") {
      return SIMILAR_FONT_MAP.wiredDisplay;
    }

    if (SIMILAR_FONT_MAP[key]) {
      return SIMILAR_FONT_MAP[key];
    }

    const family = String(fontFamily || "").toLowerCase();
    const combined = `${key} ${family}`;

    if (/mono|code|courier|console|terminal/.test(combined)) {
      return ["Roboto Mono", "IBM Plex Mono", "Source Code Pro"];
    }

    if (/condensed|narrow|compressed|display/.test(combined)) {
      return ["Oswald", "Roboto Condensed", "Barlow Condensed"];
    }

    if (/rounded|round|soft/.test(combined)) {
      return ["Nunito", "Quicksand", "Varela Round"];
    }

    if (/slab/.test(combined)) {
      return ["Roboto Slab", "Zilla Slab", "Arvo"];
    }

    if (/serif/.test(family) && !/sans-serif/.test(family)) {
      return ["Lora", "Merriweather", "Libre Baskerville"];
    }

    return ["Inter", "Roboto", "Open Sans"];
  }

  chrome.storage.local.get(["savedFonts"], (result) => {
    if (Array.isArray(result.savedFonts)) {
      savedFonts = new Set(result.savedFonts);
    }
  });

  function ensureUI() {
    if (uiHost && shadowRoot && tooltip && statusBadge) {
      return;
    }

    uiHost = document.createElement("div");
    uiHost.id = "hoverfont-ui-host";
    uiHost.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      z-index: ${UI_Z_INDEX} !important;
      pointer-events: none !important;
      display: block !important;
    `;

    shadowRoot = uiHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      * {
        box-sizing: border-box;
      }

      #hoverfont-tooltip {
        position: fixed;
        display: none;
        width: max-content;
        min-width: 230px;
        max-width: 340px;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        background: #1f1f1f;
        color: #ffffff;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.32);
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        pointer-events: auto;
      }

      .preview {
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        color: #ffffff;
        overflow-wrap: anywhere;
      }

      .font-identity {
        margin-bottom: 8px;
      }

      .primary-font {
        color: #ffffff;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }

      .similar-fonts {
        margin-top: 3px;
        color: #d7d7d7;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11px;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }

      .font-stack {
        margin-top: 7px;
        color: #9f9f9f;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 9px;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }

      .details {
        margin: 0;
        color: #eeeeee;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 11px;
        line-height: 1.55;
        white-space: pre-wrap;
      }

      .contrast {
        margin-top: 8px;
        color: #d7d7d7;
        font-size: 11px;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }

      button,
      a.action-link {
        min-height: 28px;
        border: 0;
        border-radius: 6px;
        padding: 6px 8px;
        background: #ffffff;
        color: #171717;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11px;
        line-height: 16px;
        text-decoration: none;
        cursor: pointer;
      }

      button:hover,
      a.action-link:hover {
        opacity: 0.88;
      }

      #hoverfont-status {
        position: fixed;
        right: 18px;
        bottom: 18px;
        display: block;
        padding: 7px 10px;
        border-radius: 999px;
        background: #111111;
        color: #ff8a8a;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11px;
        font-weight: 700;
        pointer-events: none;
      }

      #hoverfont-status[data-state="on"] {
        color: #8ff0a4;
      }

      #hoverfont-status[data-state="off"] {
        color: #ff8a8a;
      }
    `;

    tooltip = document.createElement("div");
    tooltip.id = "hoverfont-tooltip";

    statusBadge = document.createElement("div");
    statusBadge.id = "hoverfont-status";
    statusBadge.textContent = "HoverFont: OFF";
    statusBadge.dataset.state = "off";

    shadowRoot.append(style, tooltip, statusBadge);
    (document.documentElement || document.body).appendChild(uiHost);
  }

  function parseRgb(cssColor) {
    if (typeof cssColor !== "string") {
      return null;
    }

    const match = cssColor.match(
      /rgba?\(\s*(\d+(?:\.\d+)?)\s*[,\s]+\s*(\d+(?:\.\d+)?)\s*[,\s]+\s*(\d+(?:\.\d+)?)/i
    );

    if (!match) {
      return null;
    }

    return [
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    ].map((value) => Math.max(0, Math.min(255, value)));
  }

  function getLuminance(rgb) {
    const channels = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4);
    });

    return (
      0.2126 * channels[0] +
      0.7152 * channels[1] +
      0.0722 * channels[2]
    );
  }

  function getContrastRatio(foreground, background) {
    const foregroundLuminance = getLuminance(foreground);
    const backgroundLuminance = getLuminance(background);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function getEffectiveBackgroundColor(element) {
    let current = element;

    while (current && current instanceof Element) {
      const background = window.getComputedStyle(current).backgroundColor;
      const rgba = parseRgb(background);

      if (rgba && background !== "rgba(0, 0, 0, 0)") {
        const alphaMatch = background.match(/rgba\([^)]*,\s*(\d*(?:\.\d+)?)\s*\)/i);
        const alpha = alphaMatch ? Number(alphaMatch[1]) : 1;

        if (alpha > 0) {
          return background;
        }
      }

      current = current.parentElement;
    }

    return "rgb(255, 255, 255)";
  }

  function hasVisibleText(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const text = element.textContent?.trim();
    if (!text) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function persistSavedFonts() {
    chrome.storage.local.set({ savedFonts: Array.from(savedFonts) });
  }

  async function copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
    } catch (_error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px;";
      document.documentElement.appendChild(textarea);
      textarea.select();

      const didCopy = document.execCommand("copy");
      textarea.remove();
      button.textContent = didCopy ? "Copied" : "Copy failed";
    }

    setTimeout(() => {
      if (button.isConnected) {
        button.textContent = "Copy styles";
      }
    }, 1200);
  }

  function exportSavedFonts(button) {
    if (savedFonts.size === 0) {
      button.textContent = "Save a font first";
      setTimeout(() => {
        if (button.isConnected) {
          button.textContent = "Export fonts";
        }
      }, 1200);
      return;
    }

    const contents = Array.from(savedFonts).sort().join("\n");
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hoverfont-saved-fonts.txt";
    link.style.display = "none";
    document.documentElement.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function positionTooltip(pointerX, pointerY) {
    const bounds = tooltip.getBoundingClientRect();

    let left = pointerX + TOOLTIP_OFFSET;
    let top = pointerY + TOOLTIP_OFFSET;

    if (left + bounds.width > window.innerWidth - VIEWPORT_MARGIN) {
      left = pointerX - bounds.width - TOOLTIP_OFFSET;
    }

    if (top + bounds.height > window.innerHeight - VIEWPORT_MARGIN) {
      top = pointerY - bounds.height - TOOLTIP_OFFSET;
    }

    left = Math.max(VIEWPORT_MARGIN, left);
    top = Math.max(VIEWPORT_MARGIN, top);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function renderTooltip(element, pointerX, pointerY) {
    ensureUI();

    const style = window.getComputedStyle(element);
    const fontFamily = style.fontFamily || "Unknown";
    const fontSize = style.fontSize || "Unknown";
    const fontWeight = style.fontWeight || "Unknown";
    const fontStyle = style.fontStyle || "Unknown";
    const lineHeight = style.lineHeight || "Unknown";
    const letterSpacing = style.letterSpacing || "Unknown";
    const color = style.color || "Unknown";
    const backgroundColor = getEffectiveBackgroundColor(element);

    const primaryFont = getPrimaryFontName(fontFamily);
    const similarFonts = getSimilarFonts(fontFamily);

    const details = [
      `Size: ${fontSize}`,
      `Weight: ${fontWeight}`,
      `Style: ${fontStyle}`,
      `Line height: ${lineHeight}`,
      `Letter spacing: ${letterSpacing}`,
      `Colour: ${color}`
    ].join("\n");

    const copyDetails = [
      `Font: ${primaryFont}`,
      `Font stack: ${fontFamily}`,
      ...details.split("\n")
    ].join("\n");

    tooltip.replaceChildren();

    const preview = document.createElement("div");
    preview.className = "preview";
    preview.textContent = "The quick brown fox jumps over the lazy dog";
    preview.style.fontFamily = fontFamily;
    preview.style.fontWeight = fontWeight;
    preview.style.fontStyle = fontStyle;
    preview.style.fontSize = "16px";

    const fontIdentity = document.createElement("div");
    fontIdentity.className = "font-identity";

    const primaryFontLabel = document.createElement("div");
    primaryFontLabel.className = "primary-font";
    primaryFontLabel.textContent = primaryFont;

    const similarFontLabel = document.createElement("div");
    similarFontLabel.className = "similar-fonts";
    similarFontLabel.textContent = `Similar: ${similarFonts.join(" · ")}`;

    fontIdentity.append(primaryFontLabel, similarFontLabel);

    const detailsBlock = document.createElement("pre");
    detailsBlock.className = "details";
    detailsBlock.textContent = details;

    const stackDetail = document.createElement("div");
    stackDetail.className = "font-stack";
    stackDetail.textContent = `Font stack: ${fontFamily}`;

    const contrast = document.createElement("div");
    contrast.className = "contrast";

    const foregroundRgb = parseRgb(color);
    const backgroundRgb = parseRgb(backgroundColor);

    if (foregroundRgb && backgroundRgb) {
      const ratio = getContrastRatio(foregroundRgb, backgroundRgb);
      const passesAaNormal = ratio >= 4.5;
      contrast.textContent = `Contrast: ${ratio.toFixed(2)}:1 ${
        passesAaNormal ? "✓ AA" : "• below AA for normal text"
      }`;
    } else {
      contrast.textContent = "Contrast: unavailable for this colour format";
    }

    const actions = document.createElement("div");
    actions.className = "actions";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Copy styles";
    copyButton.addEventListener("click", () => copyToClipboard(copyDetails, copyButton));

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = savedFonts.has(fontFamily) ? "Saved ✓" : "Save font";
    saveButton.addEventListener("click", () => {
      savedFonts.add(fontFamily);
      persistSavedFonts();
      saveButton.textContent = "Saved ✓";
    });

    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = "Export fonts";
    exportButton.addEventListener("click", () => exportSavedFonts(exportButton));

    const googleFontLink = document.createElement("a");
    googleFontLink.className = "action-link";
    googleFontLink.target = "_blank";
    googleFontLink.rel = "noopener noreferrer";
    googleFontLink.textContent = "Google Fonts";

    googleFontLink.href = `https://fonts.google.com/?query=${encodeURIComponent(primaryFont)}`;

    actions.append(copyButton, saveButton, exportButton, googleFontLink);
    tooltip.append(preview, fontIdentity, detailsBlock, stackDetail, contrast, actions);
    tooltip.style.display = "block";

    requestAnimationFrame(() => positionTooltip(pointerX, pointerY));
  }

  function hideTooltip() {
    if (tooltip) {
      tooltip.style.display = "none";
    }
    lastHoveredElement = null;
  }

  function handleMouseMove(event) {
    if (!active) {
      return;
    }

    const path = event.composedPath();
    if (uiHost && path.includes(uiHost)) {
      return;
    }

    const element = event.target;

    if (!hasVisibleText(element)) {
      hideTooltip();
      return;
    }

    if (element !== lastHoveredElement) {
      lastHoveredElement = element;
      renderTooltip(element, event.clientX, event.clientY);
    } else if (tooltip?.style.display === "block") {
      positionTooltip(event.clientX, event.clientY);
    }
  }

  function updateStatusBadge() {
    ensureUI();
    statusBadge.textContent = `HoverFont: ${active ? "ON" : "OFF"}`;
    statusBadge.dataset.state = active ? "on" : "off";
  }

  function enableHoverFont() {
    ensureUI();

    if (!active) {
      active = true;
      document.addEventListener("mousemove", handleMouseMove, true);
    }

    updateStatusBadge();
  }

  function disableHoverFont() {
    if (active) {
      active = false;
      document.removeEventListener("mousemove", handleMouseMove, true);
      hideTooltip();
    }

    updateStatusBadge();
  }

  function applyEnabledState(enabled) {
    if (enabled) {
      enableHoverFont();
    } else {
      disableHoverFont();
    }
  }

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (!request || typeof request.action !== "string") {
      return;
    }

    if (request.action === "ping") {
      sendResponse({ loaded: true, active });
      return;
    }

    if (request.action === "getStatus") {
      sendResponse({ active });
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.hoverFontEnabled) {
      return;
    }

    applyEnabledState(Boolean(changes.hoverFontEnabled.newValue));
  });

  ensureUI();

  chrome.storage.local.get({ hoverFontEnabled: false }, (result) => {
    applyEnabledState(Boolean(result.hoverFontEnabled));
  });
})();

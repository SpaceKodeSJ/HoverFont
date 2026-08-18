# HoverFont 1.0.4

HoverFont is a free Chrome extension for inspecting typography directly on webpages.

## Behaviour

- HoverFont automatically loads on normal HTTP/HTTPS webpages.
- The bottom-right badge always shows whether HoverFont is ON or OFF.
- The ON/OFF state persists when you navigate to another webpage or restart Chrome.
- Toggle from the popup or with `Ctrl+Shift+F` (`Command+Shift+F` on macOS).
- All current inspection features are free.

## Local install

1. Extract this folder somewhere permanent.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder containing `manifest.json`.
6. Refresh any webpages that were already open when you loaded/reloaded the extension.

Chrome internal pages such as `chrome://extensions` cannot run content scripts.

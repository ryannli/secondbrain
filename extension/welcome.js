// Welcome page logic: live connection check + Twitter auto-capture toggle.
// Server probing happens in the background worker (same context that
// captures use), so the status shown here matches real capture behavior.

const dot = document.getElementById("status-dot");
const text = document.getElementById("status-text");
const hint = document.getElementById("status-hint");
const retryBtn = document.getElementById("retry-btn");
const openBtn = document.getElementById("open-app-btn");

async function checkConnection() {
  dot.className = "dot";
  text.textContent = "Checking for Second Brain…";
  retryBtn.hidden = true;
  openBtn.hidden = true;
  hint.hidden = true;

  const res = await chrome.runtime.sendMessage({ action: "probe" }).catch(() => null);
  if (res?.port) {
    dot.className = "dot ok";
    text.textContent = `Connected to Second Brain on localhost:${res.port}`;
    openBtn.hidden = false;
  } else {
    dot.className = "dot fail";
    text.textContent = "Second Brain isn't running";
    retryBtn.hidden = false;
    hint.hidden = false;
  }
}

retryBtn.addEventListener("click", checkConnection);
openBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "openApp" });
});

// Preference toggles (both default to enabled)
const floatToggle = document.getElementById("float-toggle");
const twitterToggle = document.getElementById("twitter-toggle");
chrome.storage.local.get(["floatingButtonEnabled", "twitterAutocaptureEnabled"]).then((prefs) => {
  floatToggle.checked = prefs.floatingButtonEnabled !== false;
  twitterToggle.checked = prefs.twitterAutocaptureEnabled !== false;
});
floatToggle.addEventListener("change", () => {
  chrome.storage.local.set({ floatingButtonEnabled: floatToggle.checked });
});
twitterToggle.addEventListener("change", () => {
  chrome.storage.local.set({ twitterAutocaptureEnabled: twitterToggle.checked });
});

// Floating-button demo: clicking plays the real capture state sequence
const demoFloat = document.getElementById("demo-float");
const demoLabel = document.getElementById("demo-float-label");
let demoPlaying = false;
demoFloat.addEventListener("click", () => {
  if (demoPlaying) return;
  demoPlaying = true;
  demoFloat.classList.add("capturing");
  demoLabel.textContent = "Capturing...";
  setTimeout(() => {
    demoFloat.classList.remove("capturing");
    demoFloat.classList.add("success");
    demoLabel.textContent = "Captured! Open →";
    setTimeout(() => {
      demoFloat.classList.remove("success");
      demoLabel.textContent = "Capture";
      demoPlaying = false;
    }, 2200);
  }, 1000);
});

checkConnection();

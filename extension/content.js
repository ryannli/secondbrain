// Second Brain floating capture button
const POSITION_KEY = "secondbrain-button-position";

// On Second Brain's own pages, announce that the extension is installed so
// the app can stop nudging the user to set it up. The attribute is the only
// thing injected there — no capture UI on localhost.
if (window.location.hostname === "localhost") {
  document.documentElement.setAttribute(
    "data-secondbrain-extension",
    chrome.runtime.getManifest().version
  );
}

// Create floating button
function createFloatingButton() {
  // Don't inject on localhost (Second Brain itself)
  if (window.location.hostname === "localhost") return;

  const container = document.createElement("div");
  container.id = "secondbrain-float";
  container.innerHTML = `
    <div class="sb-icon">
      <svg viewBox="0 0 64 64" fill="currentColor">
        <circle cx="32" cy="32" r="28" opacity="0.25"/>
        <circle cx="32" cy="32" r="20" opacity="0.4"/>
        <circle cx="32" cy="32" r="12" opacity="0.6"/>
        <circle cx="32" cy="32" r="5"/>
      </svg>
    </div>
    <span class="sb-label">Capture</span>
  `;

  // Restore saved position or use default
  const savedPosition = localStorage.getItem(POSITION_KEY);
  if (savedPosition) {
    const { x, y } = JSON.parse(savedPosition);
    container.style.right = "auto";
    container.style.bottom = "auto";
    container.style.left = `${Math.min(x, window.innerWidth - 50)}px`;
    container.style.top = `${Math.min(y, window.innerHeight - 50)}px`;
  }

  // Drag state
  let isDragging = false;
  let wasDragged = false;
  let startX, startY, initialX, initialY;

  container.addEventListener("mousedown", (e) => {
    isDragging = true;
    wasDragged = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = container.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    container.classList.add("sb-dragging");
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      wasDragged = true;
    }

    let newX = initialX + dx;
    let newY = initialY + dy;

    newX = Math.max(0, Math.min(newX, window.innerWidth - container.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - container.offsetHeight));

    container.style.right = "auto";
    container.style.bottom = "auto";
    container.style.left = `${newX}px`;
    container.style.top = `${newY}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      container.classList.remove("sb-dragging");

      const rect = container.getBoundingClientRect();
      localStorage.setItem(POSITION_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
    }
  });

  container.addEventListener("click", (e) => {
    if (wasDragged) return;
    // Right after a successful capture, a click opens the app instead
    if (container.classList.contains("sb-success")) {
      chrome.runtime.sendMessage({ action: "openApp" });
      return;
    }
    handleCapture();
  });

  document.body.appendChild(container);
}

// Wait for dynamic content to render (for SPAs like Twitter)
async function waitForContent() {
  const hostname = window.location.hostname;

  // Twitter/X: wait for tweet content to render
  if (hostname.includes("x.com") || hostname.includes("twitter.com")) {
    // Wait for tweet text or up to 3 seconds
    for (let i = 0; i < 30; i++) {
      if (document.querySelector('[data-testid="tweetText"]')) {
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

async function handleCapture() {
  const container = document.getElementById("secondbrain-float");
  const label = container.querySelector(".sb-label");

  container.classList.add("sb-capturing");
  label.textContent = "Capturing...";

  // Wait for dynamic content if needed
  await waitForContent();

  const html = document.documentElement.outerHTML;
  const title = document.title;
  const url = window.location.href;

  // Send to background script (avoids CORS/Private Network Access issues)
  chrome.runtime.sendMessage(
    { action: "capture", html, title, url },
    (response) => {
      if (response && response.success) {
        container.classList.remove("sb-capturing");
        container.classList.add("sb-success");
        label.textContent = "Captured! Open →";
        setTimeout(() => {
          container.classList.remove("sb-success");
          label.textContent = "Capture";
        }, 4000);
      } else {
        container.classList.remove("sb-capturing");
        container.classList.add("sb-error");
        label.textContent = "Failed";
        setTimeout(() => {
          container.classList.remove("sb-error");
          label.textContent = "Capture";
        }, 2000);
      }
    }
  );

  setTimeout(() => {
    if (container.classList.contains("sb-capturing")) {
      label.textContent = "Processing...";
    }
  }, 500);
}

// Initialize — the floating button is on by default and can be disabled
// from the extension's welcome/options page
function initFloatingButton() {
  chrome.storage.local.get("floatingButtonEnabled", ({ floatingButtonEnabled }) => {
    if (floatingButtonEnabled !== false) {
      createFloatingButton();
    }
  });
}

// React to the setting live, without requiring a page refresh
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !("floatingButtonEnabled" in changes)) return;
  const enabled = changes.floatingButtonEnabled.newValue !== false;
  const existing = document.getElementById("secondbrain-float");
  if (enabled && !existing) {
    createFloatingButton();
  } else if (!enabled && existing) {
    existing.remove();
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFloatingButton);
} else {
  initFloatingButton();
}

// Second Brain server discovery.
// The web app runs on 3000 by default, but `next dev` auto-increments when
// the port is taken; 41932 is the desktop build. Probe candidates in
// parallel, and verify the responder is actually Second Brain before any
// page content is sent — another app could be squatting on the port.
const PORTS = [3000, 3001, 3002, 3003, 41932];

async function probePort(port) {
  const res = await fetch(`http://localhost:${port}/api/config`, {
    signal: AbortSignal.timeout(800),
  });
  if (!res.ok) throw new Error(`port ${port}: not ok`);
  const data = await res.json();
  if (data?.app !== "secondbrain") throw new Error(`port ${port}: not Second Brain`);
  return port;
}

async function getApiUrl() {
  // Fast path: the port that worked last time
  try {
    const { lastPort } = await chrome.storage.local.get("lastPort");
    if (lastPort) {
      return `http://localhost:${await probePort(lastPort)}/api/capture`;
    }
  } catch {}

  // Probe all candidates in parallel; first verified server wins
  try {
    const port = await Promise.any(PORTS.map(probePort));
    await chrome.storage.local.set({ lastPort: port });
    return `http://localhost:${port}/api/capture`;
  } catch {
    return null;
  }
}

// Open the welcome page on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
});

async function openApp() {
  const { lastPort } = await chrome.storage.local.get("lastPort");
  chrome.tabs.create({ url: `http://localhost:${lastPort || 3000}` });
}

// Handle messages from content scripts and the welcome page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "capture") {
    captureFromContent(message.html, message.title, message.url)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  if (message.action === "probe") {
    getApiUrl()
      .then((apiUrl) => sendResponse({ port: apiUrl ? new URL(apiUrl).port : null }))
      .catch(() => sendResponse({ port: null }));
    return true;
  }
  if (message.action === "openApp") {
    openApp();
  }
});

async function captureFromContent(html, title, url) {
  const apiUrl = await getApiUrl();
  if (!apiUrl) {
    return { success: false, error: "Second Brain is not running" };
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, title, url }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Capture error:", error);
    return { success: false, error: error.message };
  }
}

// Handle extension icon click (toolbar button)
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Show immediate feedback
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showNotification,
      args: ["Capturing...", "success"],
    });

    // Detect server
    const apiUrl = await getApiUrl();
    if (!apiUrl) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: showNotification,
        args: ["Second Brain is not running", "error"],
      });
      return;
    }

    // Get page content
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getPageContent,
    });

    const { html, title } = results[0].result;

    // Send to API
    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, title, url: tab.url }),
    }).then(async (response) => {
      const data = await response.json();
      if (data.success) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showNotification,
          args: ["Captured! Click to open Second Brain →", "success", true],
        });
      } else {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showNotification,
          args: [data.error || "Failed to process", "error"],
        });
      }
    }).catch((error) => {
      console.error("Capture error:", error);
    });

  } catch (error) {
    console.error("Capture error:", error);
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showNotification,
      args: ["Failed to capture page content", "error"],
    });
  }
});

function getPageContent() {
  return {
    html: document.documentElement.outerHTML,
    title: document.title,
  };
}

function showNotification(message, type, clickToOpen = false) {
  const existing = document.getElementById("secondbrain-notification");
  if (existing) existing.remove();

  const div = document.createElement("div");
  div.id = "secondbrain-notification";
  div.textContent = message;
  div.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: opacity 0.3s;
    ${clickToOpen ? "cursor: pointer;" : ""}
    ${type === "success"
      ? "background: #3b6044; color: white;"
      : "background: #ef4444; color: white;"}
  `;
  if (clickToOpen) {
    div.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "openApp" });
      div.remove();
    });
  }
  document.body.appendChild(div);

  setTimeout(() => {
    div.style.opacity = "0";
    setTimeout(() => div.remove(), 300);
  }, clickToOpen ? 6000 : 4000);
}

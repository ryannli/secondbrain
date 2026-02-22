// Second Brain - auto-detect which port the server is running on
const PORTS = [3000, 41932];

async function getApiUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://localhost:${port}/api/config`, {
        signal: AbortSignal.timeout(500),
      });
      if (res.ok) return `http://localhost:${port}/api/capture`;
    } catch {}
  }
  return null;
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "capture") {
    captureFromContent(message.html, message.title, message.url)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
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

// Check if a URL is Twitter/X
function isTwitterUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes("twitter.com") || hostname.includes("x.com");
  } catch {
    return false;
  }
}

// Update badge for a tab based on auto-capture state
async function updateBadge(tabId, url) {
  if (!isTwitterUrl(url)) {
    chrome.action.setBadgeText({ text: "", tabId });
    return;
  }
  const { twitterAutoCapture } = await chrome.storage.local.get("twitterAutoCapture");
  chrome.action.setBadgeText({ text: twitterAutoCapture ? "AUTO" : "", tabId });
  chrome.action.setBadgeBackgroundColor({ color: "#3b6044", tabId });
}

// Update badge when navigating
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    updateBadge(tabId, tab.url);
  }
});

// Update all Twitter tabs when toggle changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.twitterAutoCapture) {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (isTwitterUrl(tab.url)) {
          updateBadge(tab.id, tab.url);
        }
      }
    });
  }
});

// Handle extension icon click (toolbar button)
chrome.action.onClicked.addListener(async (tab) => {
  // On Twitter/X: toggle auto-capture
  if (isTwitterUrl(tab.url)) {
    const { twitterAutoCapture } = await chrome.storage.local.get("twitterAutoCapture");
    const newValue = !twitterAutoCapture;
    await chrome.storage.local.set({ twitterAutoCapture: newValue });

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showNotification,
      args: [
        newValue ? "Auto-capture ON — liked tweets will be saved" : "Auto-capture OFF",
        "success",
      ],
    });
    return;
  }

  // On other sites: capture page as before
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
          args: ["Captured! Processing in background...", "success"],
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

function showNotification(message, type) {
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
    ${type === "success"
      ? "background: #3b6044; color: white;"
      : "background: #ef4444; color: white;"}
  `;
  document.body.appendChild(div);

  setTimeout(() => {
    div.style.opacity = "0";
    setTimeout(() => div.remove(), 300);
  }, 4000);
}

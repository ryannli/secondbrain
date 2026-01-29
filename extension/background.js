// Second Brain API endpoint
const API_URL = "http://localhost:3000/api/capture";

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
  try {
    const response = await fetch(API_URL, {
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
      args: ["Captured! Processing in background...", "success"],
    });

    // Get page content
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getPageContent,
    });

    const { html, title } = results[0].result;

    // Send to API
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, title, url: tab.url }),
    }).then(async (response) => {
      const data = await response.json();
      if (!data.success) {
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

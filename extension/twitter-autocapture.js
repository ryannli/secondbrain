// Twitter/X auto-capture: liked tweets automatically sent to Second Brain

(function () {
  if (window.__sbTwitterAutocapture) return;
  window.__sbTwitterAutocapture = true;

  const CAPTURED_KEY = "sb-captured-tweets";
  let enabled = false;

  // Load initial state
  chrome.storage.local.get("twitterAutoCapture", (result) => {
    enabled = !!result.twitterAutoCapture;
  });

  // React to toggle changes from background script
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.twitterAutoCapture) {
      enabled = !!changes.twitterAutoCapture.newValue;
    }
  });

  // Detect like clicks (capture phase to catch before React handles it)
  document.addEventListener(
    "click",
    (e) => {
      if (!enabled) return;

      const likeButton = e.target.closest('[data-testid="like"]');
      if (!likeButton) return;

      // Walk up to the tweet article
      const article = likeButton.closest('article[data-testid="tweet"]');
      if (!article) return;

      // Extract tweet URL from the time element's parent link
      const timeLink = article.querySelector("a[href*='/status/'] time")
        ?.closest("a[href*='/status/']");
      if (!timeLink) return;

      const tweetUrl = new URL(timeLink.href, window.location.origin).href;

      // Dedup check
      chrome.storage.local.get(CAPTURED_KEY, (result) => {
        const captured = result[CAPTURED_KEY] || [];
        if (captured.includes(tweetUrl)) return;

        // Mark as captured (keep last 500 to avoid unbounded growth)
        const updated = [...captured, tweetUrl].slice(-500);
        chrome.storage.local.set({ [CAPTURED_KEY]: updated });

        // Extract content and send
        const html = article.outerHTML;
        const title = article.querySelector('[data-testid="tweetText"]')
          ?.textContent?.slice(0, 80) || "Tweet";

        chrome.runtime.sendMessage(
          { action: "capture", html, title, url: tweetUrl },
          (response) => {
            if (response?.success) {
              showToast("Liked tweet captured");
            } else {
              showToast("Capture failed", true);
            }
          }
        );
      });
    },
    true // capture phase
  );

  function showToast(message, isError = false) {
    const existing = document.getElementById("sb-autocapture-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "sb-autocapture-toast";
    if (isError) toast.classList.add("sb-toast-error");
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
})();

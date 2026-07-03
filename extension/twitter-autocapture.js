// Twitter/X auto-capture: liked tweets automatically sent to Second Brain

(function () {
  if (window.__sbTwitterAutocapture) return;
  window.__sbTwitterAutocapture = true;

  const CAPTURED_KEY = "sb-captured-tweets";
  // Detect bookmark clicks (capture phase to catch before React handles it)
  document.addEventListener(
    "click",
    (e) => {

      const bookmarkButton = e.target.closest('[data-testid="bookmark"]');
      if (!bookmarkButton) return;

      console.log("[SB] bookmark button clicked!", e.target, bookmarkButton);

      // Try to find the tweet article (works in timeline view)
      const article = bookmarkButton.closest('article[data-testid="tweet"]');

      // Determine tweet URL: from article's time link, or fall back to page URL
      let tweetUrl;
      if (article) {
        const timeLink = article.querySelector("a[href*='/status/'] time")
          ?.closest("a[href*='/status/']");
        if (timeLink) {
          tweetUrl = new URL(timeLink.href, window.location.origin).href;
        }
      }
      if (!tweetUrl && /\/status\/\d+/.test(window.location.pathname)) {
        tweetUrl = window.location.href.split("?")[0];
      }
      if (!tweetUrl) {
        console.log("[SB] could not determine tweet URL");
        return;
      }

      // Dedup check + settings (auto-capture can be disabled from the welcome page)
      chrome.storage.local.get([CAPTURED_KEY, "twitterAutocaptureEnabled", "sbTwitterNoticeShown"], (result) => {
        if (result.twitterAutocaptureEnabled === false) return;

        const captured = result[CAPTURED_KEY] || [];
        if (captured.includes(tweetUrl)) return;

        // Mark as captured (keep last 500 to avoid unbounded growth)
        const updated = [...captured, tweetUrl].slice(-500);
        chrome.storage.local.set({ [CAPTURED_KEY]: updated });

        // Use full page HTML + document.title, same as manual capture
        const html = document.documentElement.outerHTML;
        const title = document.title;

        chrome.runtime.sendMessage(
          { action: "capture", html, title, url: tweetUrl },
          (response) => {
            if (response?.success) {
              if (!result.sbTwitterNoticeShown) {
                // First time: explain what just happened and where to turn it off
                chrome.storage.local.set({ sbTwitterNoticeShown: true });
                showToast("Saved to Second Brain — bookmarked tweets are auto-captured. Turn this off on the extension's welcome page.", false, 7000);
              } else {
                showToast("Bookmarked tweet captured");
              }
            } else {
              showToast("Capture failed", true);
            }
          }
        );
      });
    },
    true // capture phase
  );

  function showToast(message, isError = false, durationMs = 2000) {
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
    }, durationMs);
  }
})();

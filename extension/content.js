// Second Brain floating capture button
const POSITION_KEY = "secondbrain-button-position";

// Create floating button
function createFloatingButton() {
  // Don't inject on localhost (Second Brain itself)
  if (window.location.hostname === "localhost") return;

  const container = document.createElement("div");
  container.id = "secondbrain-float";
  container.innerHTML = `
    <div class="sb-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
        <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
        <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
        <path d="M12 18v-6"/>
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
    container.style.transition = "none";
    container.style.cursor = "grabbing";
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
      container.style.transition = "";
      container.style.cursor = "";

      const rect = container.getBoundingClientRect();
      localStorage.setItem(POSITION_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
    }
  });

  container.addEventListener("click", (e) => {
    if (!wasDragged) {
      handleCapture();
    }
  });

  document.body.appendChild(container);
}

function handleCapture() {
  const container = document.getElementById("secondbrain-float");
  const label = container.querySelector(".sb-label");

  container.classList.add("sb-capturing");
  label.textContent = "Capturing...";

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
        label.textContent = "Captured!";
        setTimeout(() => {
          container.classList.remove("sb-success");
          label.textContent = "Capture";
        }, 2000);
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

// Initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createFloatingButton);
} else {
  createFloatingButton();
}

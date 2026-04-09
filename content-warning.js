// Injected into unlocked site tabs to show exit warning info.
// Receives visit config via "initWarning" message from background.js.

let warningState = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "initWarning") {
    warningState = {
      visitCount: message.visitCount,
      visitsPerPeriod: message.visitsPerPeriod,
    };
    showBanner();
  }
});

// --- Persistent info banner ---

function getWarningText() {
  if (!warningState) return null;
  const { visitCount, visitsPerPeriod } = warningState;

  if (visitsPerPeriod === 0) {
    // Unlimited visits
    return "This site will be blocked when you close this tab.";
  }

  const remaining = visitsPerPeriod - visitCount - 1; // -1 because current visit hasn't been counted yet
  if (remaining <= 0) {
    return "This is your last visit this period. The site will be blocked when you leave.";
  }
  return `When you leave, this site will be blocked. You'll have ${remaining} ${remaining === 1 ? "visit" : "visits"} remaining this period.`;
}

function showBanner() {
  if (document.getElementById("sb-exit-banner")) return;

  const text = getWarningText();
  if (!text) return;

  const style = document.createElement("style");
  style.id = "sb-exit-banner-style";
  style.textContent = `
    #sb-exit-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(20, 20, 20, 0.92);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: #ccc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 2147483645;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.3);
    }
    #sb-exit-banner-text {
      flex: 1;
      margin: 0;
    }
    #sb-exit-banner-text strong {
      color: #fff;
    }
    #sb-exit-banner-dismiss {
      background: none;
      border: none;
      color: #666;
      font-size: 18px;
      cursor: pointer;
      padding: 0 0 0 12px;
      line-height: 1;
    }
    #sb-exit-banner-dismiss:hover {
      color: #aaa;
    }

    #sb-exit-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
    }
    #sb-exit-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
    }
    #sb-exit-card {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #1a1a1a;
      color: #e0e0e0;
      border: 1px solid #333;
      border-radius: 14px;
      padding: 28px 32px;
      max-width: 400px;
      text-align: center;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    }
    #sb-exit-card p {
      font-size: 15px;
      line-height: 1.5;
      margin: 0 0 20px 0;
      color: #ccc;
    }
    #sb-exit-card strong {
      color: #fff;
    }
    .sb-exit-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    .sb-exit-btn {
      padding: 10px 24px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      border: none;
      transition: background 0.2s;
    }
    .sb-exit-stay {
      background: #333;
      color: #e0e0e0;
    }
    .sb-exit-stay:hover {
      background: #444;
    }
    .sb-exit-leave {
      background: #e74c3c;
      color: #fff;
    }
    .sb-exit-leave:hover {
      background: #c0392b;
    }
  `;
  document.head.appendChild(style);

  const banner = document.createElement("div");
  banner.id = "sb-exit-banner";
  banner.innerHTML = `
    <p id="sb-exit-banner-text"><strong>Social Blocker:</strong> ${text}</p>
    <button id="sb-exit-banner-dismiss">&times;</button>
  `;
  document.body.appendChild(banner);

  document.getElementById("sb-exit-banner-dismiss").addEventListener("click", () => {
    banner.remove();
  });
}

// --- Custom exit confirmation on link clicks ---

let pendingNavigation = null;

document.addEventListener("click", (e) => {
  if (!warningState) return;

  // Find the closest <a> with an href that would navigate away
  const link = e.target.closest("a[href]");
  if (!link) return;

  const href = link.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

  // Check if it's an external navigation (different origin or full URL)
  try {
    const target = new URL(href, window.location.href);
    if (target.origin === window.location.origin && target.pathname === window.location.pathname) return;
  } catch {
    return;
  }

  // Don't intercept if opening in new tab
  if (link.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey) return;

  // Show custom confirmation
  e.preventDefault();
  e.stopPropagation();
  pendingNavigation = link.href;
  showExitModal();
}, true); // capture phase

function showExitModal() {
  if (document.getElementById("sb-exit-overlay")) return;

  const text = getWarningText();

  const overlay = document.createElement("div");
  overlay.id = "sb-exit-overlay";
  overlay.innerHTML = `
    <div id="sb-exit-backdrop"></div>
    <div id="sb-exit-card">
      <p>${text || "This site will be blocked when you leave."}</p>
      <div class="sb-exit-actions">
        <button class="sb-exit-btn sb-exit-stay">Stay on page</button>
        <button class="sb-exit-btn sb-exit-leave">Leave anyway</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector(".sb-exit-stay").addEventListener("click", () => {
    pendingNavigation = null;
    overlay.remove();
  });

  overlay.querySelector("#sb-exit-backdrop").addEventListener("click", () => {
    pendingNavigation = null;
    overlay.remove();
  });

  overlay.querySelector(".sb-exit-leave").addEventListener("click", () => {
    overlay.remove();
    if (pendingNavigation) {
      // Temporarily disable beforeunload so the browser dialog doesn't double-prompt
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.location.href = pendingNavigation;
    }
  });
}

// --- Fallback: browser beforeunload for tab close / URL bar / back button ---

function onBeforeUnload(e) {
  e.preventDefault();
  e.returnValue = "";
}

window.addEventListener("beforeunload", onBeforeUnload);

// Injected into unlocked site tabs to nudge the user after a set time.
// Receives nudgeMinutes via message from background.js after injection.

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "startNudgeTimer") {
    startNudge(message.nudgeMinutes);
  }
});

function startNudge(minutes) {
  if (!minutes || minutes <= 0) return;

  setTimeout(() => {
    showNudge(minutes);
  }, minutes * 60 * 1000);
}

function showNudge(minutes) {
  // Don't double-show
  if (document.getElementById("social-blocker-nudge")) return;

  const overlay = document.createElement("div");
  overlay.id = "social-blocker-nudge";
  overlay.innerHTML = `
    <div id="sb-nudge-backdrop"></div>
    <div id="sb-nudge-card">
      <p id="sb-nudge-text">You've been on this site for <strong>${minutes} minutes</strong>. Maybe it's time to move on?</p>
      <button id="sb-nudge-dismiss">Got it</button>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #sb-nudge-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 2147483646;
    }
    #sb-nudge-card {
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
    #sb-nudge-text {
      font-size: 16px;
      line-height: 1.5;
      margin: 0 0 20px 0;
      color: #ccc;
    }
    #sb-nudge-text strong {
      color: #fff;
    }
    #sb-nudge-dismiss {
      background: #333;
      color: #e0e0e0;
      border: none;
      padding: 10px 24px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    #sb-nudge-dismiss:hover {
      background: #444;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  document.getElementById("sb-nudge-dismiss").addEventListener("click", () => {
    overlay.remove();
    style.remove();
  });

  document.getElementById("sb-nudge-backdrop").addEventListener("click", () => {
    overlay.remove();
    style.remove();
  });
}

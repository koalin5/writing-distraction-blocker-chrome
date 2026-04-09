const params = new URLSearchParams(window.location.search);
const siteId = params.get("site");
const domain = params.get("domain");
const label = params.get("label") || domain;

document.getElementById("siteName").textContent = label;
document.title = `${label} is blocked — Social Blocker`;

let unlockBtn = document.getElementById("unlockBtn");
const emergencyBtn = document.getElementById("emergencyBtn");
const errorMsg = document.getElementById("errorMsg");

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
}

async function loadState() {
  const state = await chrome.runtime.sendMessage({ action: "getState" });

  document.getElementById("periodLabel").textContent = state.period.label;

  // Clear any previous click handlers by replacing the button element
  const oldBtn = document.getElementById("unlockBtn");
  const newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);
  unlockBtn = newBtn;

  const visitCount = state.unlockState.usedSitesThisPeriod[siteId] || 0;
  const limit = state.settings.visitsPerPeriod; // 1, 3, or 0 (unlimited)
  const exhausted = limit > 0 && visitCount >= limit;
  const hasWritten = visitCount > 0 || state.unlockState.unlockedSites[siteId];

  if (exhausted) {
    const label = limit === 1 ? "your visit" : `all ${limit} visits`;
    document.getElementById("periodStatus").textContent =
      `You've used ${label} for this site during this period.`;
    unlockBtn.disabled = true;
    unlockBtn.textContent = "All visits used this period";
  } else if (hasWritten && !state.unlockState.unlockedSites[siteId]) {
    // Has visits remaining and already completed writing — go straight through
    document.getElementById("periodStatus").textContent =
      `Visit ${visitCount + 1}${limit > 0 ? ` of ${limit}` : ""} — you've already completed a writing exercise.`;
    unlockBtn.textContent = "Go to site";
    unlockBtn.addEventListener("click", async () => {
      const currentTab = await chrome.tabs.getCurrent();
      const response = await chrome.runtime.sendMessage({
        action: "unlockSite",
        siteId,
        tabId: currentTab.id,
      });
      if (response.success) {
        window.location.href = `https://${domain}`;
      } else if (response.error === "alreadyUsedThisPeriod") {
        // Visits were exhausted between page load and click — reload to show current state
        loadState();
      } else {
        showError("Something went wrong. Please try again.");
      }
    });
    return;
  } else if (state.unlockState.unlockedSites[siteId]) {
    const info = state.unlockState.unlockedSites[siteId];
    if (info.tabId === null) {
      // Unlock-all mode: site is unlocked but no tab claimed yet — let them through
      document.getElementById("periodStatus").textContent =
        "This site is unlocked for this period. Click below to visit.";
      unlockBtn.textContent = "Go to site";
      unlockBtn.addEventListener("click", async () => {
        const currentTab = await chrome.tabs.getCurrent();
        await chrome.runtime.sendMessage({
          action: "claimTab",
          siteId,
          tabId: currentTab.id,
        });
        window.location.href = `https://${domain}`;
      }, { once: true });
      return; // skip the default unlock click handler
    }
    document.getElementById("periodStatus").textContent =
      "This site is currently unlocked in another tab.";
    unlockBtn.disabled = true;
  } else {
    document.getElementById("periodStatus").textContent =
      "You have an unlock available for this site.";
  }

  const remaining = state.settings.emergencyUnlocksPerWeek - state.emergency.usedThisWeek;
  document.getElementById("emergencyCount").textContent = `${remaining} left this week`;
  if (remaining <= 0) {
    emergencyBtn.disabled = true;
  }

  // Default action: writing exercise (only when no other handler was set above)
  unlockBtn.addEventListener("click", () => {
    window.location.href = chrome.runtime.getURL(
      `writing/writing.html?site=${encodeURIComponent(siteId)}&domain=${encodeURIComponent(domain)}&label=${encodeURIComponent(label)}`
    );
  });
}

emergencyBtn.addEventListener("click", async () => {
  const currentTab = await chrome.tabs.getCurrent();
  const response = await chrome.runtime.sendMessage({
    action: "emergencyUnlock",
    siteId,
    tabId: currentTab.id,
  });

  if (response.error === "noEmergencyUnlocksRemaining") {
    showError("No emergency unlocks remaining this week.");
  } else if (response.success) {
    window.location.href = `https://${domain}`;
  } else {
    showError("Something went wrong. Please try again.");
  }
});

loadState();

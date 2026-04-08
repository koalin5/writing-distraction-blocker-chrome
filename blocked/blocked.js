const params = new URLSearchParams(window.location.search);
const siteId = params.get("site");
const domain = params.get("domain");
const label = params.get("label") || domain;

document.getElementById("siteName").textContent = label;
document.title = `${label} is blocked — Social Blocker`;

const unlockBtn = document.getElementById("unlockBtn");
const emergencyBtn = document.getElementById("emergencyBtn");
const errorMsg = document.getElementById("errorMsg");

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
}

async function loadState() {
  const state = await chrome.runtime.sendMessage({ action: "getState" });

  document.getElementById("periodLabel").textContent = state.period.label;

  if (state.unlockState.usedSitesThisPeriod[siteId]) {
    document.getElementById("periodStatus").textContent =
      "You already used your unlock for this site during this period.";
    unlockBtn.disabled = true;
    unlockBtn.textContent = "Already unlocked this period";
  } else if (state.unlockState.unlockedSites[siteId]) {
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
}

unlockBtn.addEventListener("click", () => {
  window.location.href = chrome.runtime.getURL(
    `writing/writing.html?site=${encodeURIComponent(siteId)}&domain=${encodeURIComponent(domain)}&label=${encodeURIComponent(label)}`
  );
});

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

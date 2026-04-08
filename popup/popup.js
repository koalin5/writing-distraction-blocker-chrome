// --- Tab switching ---
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tabContents.forEach(tc => tc.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");

    // Load data when switching tabs
    if (tab.dataset.tab === "history") loadHistory();
    if (tab.dataset.tab === "stats") loadStats();
    if (tab.dataset.tab === "settings") loadSettings();
  });
});

// --- Dashboard ---

async function loadDashboard() {
  const state = await chrome.runtime.sendMessage({ action: "getState" });

  document.getElementById("periodBadge").textContent = state.period.label;

  const remaining = state.settings.emergencyUnlocksPerWeek - state.emergency.usedThisWeek;
  document.getElementById("emergencyRemaining").textContent = `${remaining} / ${state.settings.emergencyUnlocksPerWeek} left this week`;

  const sitesList = document.getElementById("sitesList");
  sitesList.innerHTML = "";

  state.settings.blockedSites.forEach(site => {
    const row = document.createElement("div");
    row.className = "site-row";

    const limit = state.settings.visitsPerPeriod;
    const visitCount = state.unlockState.usedSitesThisPeriod[site.id] || 0;
    const exhausted = limit > 0 && visitCount >= limit;

    let statusClass, statusText;
    if (!site.enabled) {
      statusClass = "disabled";
      statusText = "Disabled";
    } else if (state.unlockState.unlockedSites[site.id]) {
      statusClass = "unlocked";
      statusText = "Unlocked";
    } else if (visitCount > 0 && exhausted) {
      statusClass = "used";
      statusText = limit === 1 ? "Used" : `${visitCount}/${limit} used`;
    } else if (visitCount > 0 && !exhausted) {
      statusClass = "unlocked";
      statusText = limit === 0 ? `${visitCount} visits` : `${visitCount}/${limit} visits`;
    } else {
      statusClass = "blocked";
      statusText = "Blocked";
    }

    row.innerHTML = `
      <span class="site-name">${site.label}</span>
      <span class="site-status ${statusClass}">${statusText}</span>
    `;
    sitesList.appendChild(row);
  });
}

// --- Settings ---

async function loadSettings() {
  const state = await chrome.runtime.sendMessage({ action: "getState" });
  const settings = state.settings;

  // Word minimum
  document.querySelectorAll('input[name="wordMin"]').forEach(input => {
    input.checked = parseInt(input.value) === settings.wordMinimum;
  });

  // Unlock all mode
  document.getElementById("unlockAllToggle").checked = settings.unlockAllMode || false;

  // Visits per period
  const visitsVal = settings.visitsPerPeriod ?? 1;
  document.querySelectorAll('input[name="visits"]').forEach(input => {
    input.checked = parseInt(input.value) === visitsVal;
  });

  // Nudge minutes
  document.getElementById("nudgeMinutes").value = settings.nudgeMinutes ?? 10;

  // Emergency limit
  document.getElementById("emergencyLimit").value = settings.emergencyUnlocksPerWeek;

  // Sites list
  const list = document.getElementById("manageSitesList");
  list.innerHTML = "";

  settings.blockedSites.forEach(site => {
    const row = document.createElement("div");
    row.className = "manage-site-row";

    const toggleClass = site.enabled ? "enabled" : "";
    const toggleText = site.enabled ? "On" : "Off";

    row.innerHTML = `
      <div class="site-info">
        <span class="site-label">${site.label}</span>
        <span class="site-domain">${site.domain}</span>
      </div>
      <div class="site-actions">
        <button class="btn-toggle ${toggleClass}" data-site="${site.id}" data-enabled="${site.enabled}" data-label="${site.label}">${toggleText}</button>
        <button class="btn-remove" data-site="${site.id}" data-label="${site.label}">Remove</button>
      </div>
    `;
    list.appendChild(row);
  });
}

// Settings event listeners
document.getElementById("wordMinGroup").addEventListener("change", async (e) => {
  if (e.target.name === "wordMin") {
    await chrome.runtime.sendMessage({
      action: "updateSettings",
      wordMinimum: parseInt(e.target.value),
    });
  }
});

document.getElementById("unlockAllToggle").addEventListener("change", async (e) => {
  await chrome.runtime.sendMessage({
    action: "updateSettings",
    unlockAllMode: e.target.checked,
  });
});

document.getElementById("visitsGroup").addEventListener("change", async (e) => {
  if (e.target.name === "visits") {
    await chrome.runtime.sendMessage({
      action: "updateSettings",
      visitsPerPeriod: parseInt(e.target.value),
    });
  }
});

document.getElementById("nudgeMinutes").addEventListener("change", async (e) => {
  await chrome.runtime.sendMessage({
    action: "updateSettings",
    nudgeMinutes: Math.max(0, parseInt(e.target.value) || 0),
  });
});

document.getElementById("emergencyLimit").addEventListener("change", async (e) => {
  await chrome.runtime.sendMessage({
    action: "updateSettings",
    emergencyUnlocksPerWeek: parseInt(e.target.value) || 3,
  });
});

document.getElementById("manageSitesList").addEventListener("click", async (e) => {
  if (e.target.classList.contains("btn-toggle")) {
    const siteId = e.target.dataset.site;
    const siteLabel = e.target.dataset.label;
    const currentlyEnabled = e.target.dataset.enabled === "true";

    if (currentlyEnabled) {
      // Disabling a site costs an emergency unlock
      const state = await chrome.runtime.sendMessage({ action: "getState" });
      const remaining = state.settings.emergencyUnlocksPerWeek - state.emergency.usedThisWeek;

      if (remaining <= 0) {
        showConfirmDialog(
          `No emergency unlocks remaining`,
          `You have no emergency unlocks left this week. You cannot temporarily disable ${siteLabel} right now. You can still permanently remove it.`,
          null
        );
        return;
      }

      showConfirmDialog(
        `Disable ${siteLabel}?`,
        `Temporarily disabling a site uses 1 emergency unlock (${remaining} remaining this week). This is tracked in your stats. To re-enable, toggle it back on for free.`,
        async () => {
          await chrome.runtime.sendMessage({
            action: "toggleSite",
            siteId,
            enabled: false,
          });
          loadSettings();
          loadDashboard();
        }
      );
    } else {
      // Re-enabling is free
      await chrome.runtime.sendMessage({
        action: "toggleSite",
        siteId,
        enabled: true,
      });
      loadSettings();
      loadDashboard();
    }
  }

  if (e.target.classList.contains("btn-remove")) {
    const siteId = e.target.dataset.site;
    const siteLabel = e.target.dataset.label;
    showConfirmDialog(
      `Remove ${siteLabel}?`,
      `This permanently removes ${siteLabel} from your block list. This is free but will be recorded in your stats. You can always add it back later.`,
      async () => {
        await chrome.runtime.sendMessage({ action: "removeSite", siteId });
        loadSettings();
        loadDashboard();
      }
    );
  }
});

document.getElementById("addSiteBtn").addEventListener("click", async () => {
  const input = document.getElementById("newSiteDomain");
  let domain = input.value.trim().toLowerCase();
  if (!domain) return;

  // Clean up input
  domain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

  const response = await chrome.runtime.sendMessage({
    action: "addSite",
    domain,
    label: domain,
  });

  if (response.error === "siteAlreadyExists") {
    // Could show an error, but just clear for now
  }

  input.value = "";
  loadSettings();
  loadDashboard();
});

// --- History ---

async function loadHistory() {
  const history = await chrome.runtime.sendMessage({ action: "getWritingHistory" });
  const list = document.getElementById("historyList");

  if (!history || history.length === 0) {
    list.innerHTML = '<p class="empty-state">No writing exercises completed yet.</p>';
    return;
  }

  list.innerHTML = "";

  // Show most recent first
  const sorted = [...history].reverse();
  sorted.forEach(entry => {
    const date = new Date(entry.completedAt);
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const promptSnippet = entry.prompt.length > 80
      ? entry.prompt.substring(0, 80) + "..."
      : entry.prompt;

    const div = document.createElement("div");
    div.className = "history-entry";
    div.innerHTML = `
      <div class="history-summary">
        <div class="history-meta">
          <span class="history-site">${entry.siteId}</span>
          <span class="history-date">${dateStr}</span>
        </div>
        <div class="history-prompt">${promptSnippet}</div>
        <div class="history-words">${entry.wordCount} words · click to read</div>
      </div>
      <div class="history-detail hidden">
        <div class="history-full-prompt"><strong>Prompt:</strong> ${escapeHtml(entry.prompt)}</div>
        <div class="history-full-text">${escapeHtml(entry.text || "")}</div>
      </div>
    `;
    div.querySelector(".history-summary").addEventListener("click", () => {
      div.querySelector(".history-detail").classList.toggle("hidden");
      div.classList.toggle("expanded");
    });
    list.appendChild(div);
  });
}

// --- Stats ---

async function loadStats() {
  const analytics = await chrome.runtime.sendMessage({ action: "getAnalytics" });

  document.getElementById("statTotalUnlocks").textContent = analytics.totalUnlocks || 0;
  document.getElementById("statTotalWriting").textContent = analytics.totalWritingExercises || 0;
  document.getElementById("statTotalWords").textContent = (analytics.totalWordsWritten || 0).toLocaleString();
  document.getElementById("statEmergency").textContent = analytics.totalEmergencyUnlocks || 0;
  document.getElementById("statToggles").textContent = analytics.totalSiteToggles || 0;
  document.getElementById("statRemovals").textContent = analytics.totalSiteRemovals || 0;

  const siteStatsList = document.getElementById("siteStatsList");
  siteStatsList.innerHTML = "";

  const entries = Object.entries(analytics.unlocksBySite || {}).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    document.getElementById("siteStatsSection").style.display = "none";
    return;
  }

  document.getElementById("siteStatsSection").style.display = "block";
  entries.forEach(([site, count]) => {
    const row = document.createElement("div");
    row.className = "site-stat-row";
    row.innerHTML = `<span class="name">${site}</span><span class="count">${count}</span>`;
    siteStatsList.appendChild(row);
  });
}

// --- Helpers ---

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showConfirmDialog(title, message, onConfirm) {
  // Remove any existing dialog
  const existing = document.getElementById("confirmDialog");
  if (existing) existing.remove();

  const dialog = document.createElement("div");
  dialog.id = "confirmDialog";
  dialog.innerHTML = `
    <div class="dialog-backdrop"></div>
    <div class="dialog-card">
      <h4 class="dialog-title">${escapeHtml(title)}</h4>
      <p class="dialog-message">${escapeHtml(message)}</p>
      <div class="dialog-actions">
        <button class="dialog-btn dialog-cancel">Cancel</button>
        ${onConfirm ? '<button class="dialog-btn dialog-confirm">Confirm</button>' : ''}
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  dialog.querySelector(".dialog-cancel").addEventListener("click", () => dialog.remove());
  dialog.querySelector(".dialog-backdrop").addEventListener("click", () => dialog.remove());
  if (onConfirm) {
    dialog.querySelector(".dialog-confirm").addEventListener("click", async () => {
      dialog.remove();
      await onConfirm();
    });
  }
}

// --- Init ---
loadDashboard();

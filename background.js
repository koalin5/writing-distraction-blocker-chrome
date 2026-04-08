importScripts("storage.js");

// Rule ID scheme: site index * 10 + 1000 (extra rules for multi-domain sites use +1, +2, etc.)
const RULE_ID_BASE = 1000;

// --- Rule Management ---

function buildRulesForSite(site, index) {
  const rules = [];
  const baseId = RULE_ID_BASE + index * 10;
  const domains = [site.domain];
  if (site.extraDomains) domains.push(...site.extraDomains);

  rules.push({
    id: baseId,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: `/blocked/blocked.html?site=${encodeURIComponent(site.id)}&domain=${encodeURIComponent(site.domain)}&label=${encodeURIComponent(site.label)}`
      }
    },
    condition: {
      requestDomains: domains,
      resourceTypes: ["main_frame"]
    }
  });
  return rules;
}

async function createAllBlockingRules() {
  const settings = await getSettings();
  const rules = [];
  settings.blockedSites.forEach((site, index) => {
    if (site.enabled) {
      rules.push(...buildRulesForSite(site, index));
    }
  });

  // Clear all existing dynamic rules first
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map(r => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: rules,
  });
}

function getRuleIdForSite(siteId, settings) {
  const index = settings.blockedSites.findIndex(s => s.id === siteId);
  if (index === -1) return null;
  return RULE_ID_BASE + index * 10;
}

async function removeSiteBlockingRule(siteId) {
  const settings = await getSettings();
  const ruleId = getRuleIdForSite(siteId, settings);
  if (ruleId === null) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [ruleId],
  });
}

async function addSiteBlockingRule(siteId) {
  const settings = await getSettings();
  const index = settings.blockedSites.findIndex(s => s.id === siteId);
  if (index === -1) return;
  const site = settings.blockedSites[index];
  const rules = buildRulesForSite(site, index);
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: rules,
  });
}

// --- Period Management ---

async function ensurePeriodState() {
  const period = getCurrentPeriod();
  const unlockState = await getUnlockState();

  if (unlockState.currentPeriodStart !== period.periodStart) {
    // Period changed — re-block all unlocked sites and reset state
    for (const siteId of Object.keys(unlockState.unlockedSites)) {
      await addSiteBlockingRule(siteId);
    }
    await saveUnlockState({
      currentPeriodStart: period.periodStart,
      unlockedSites: {},
      usedSitesThisPeriod: {},
    });
  }

  // Check weekly emergency unlock reset
  const emergency = await getEmergencyUnlocks();
  const currentWeekStart = getMonday(new Date());
  if (emergency.weekStart !== currentWeekStart) {
    await saveEmergencyUnlocks({ weekStart: currentWeekStart, usedThisWeek: 0 });
  }
}

function schedulePeriodAlarm() {
  const period = getCurrentPeriod();
  const msUntilEnd = period.periodEnd - Date.now();
  chrome.alarms.create("periodTransition", {
    delayInMinutes: Math.max(msUntilEnd / 60000, 0.1),
  });
}

// --- Warning Injection ---

async function injectExitWarning(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-warning.js"],
    });
  } catch {
    // Tab may not be ready yet — we'll retry via onUpdated
  }
}

// --- Tab Tracking ---

function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function urlMatchesSite(url, site) {
  const hostname = getDomainFromUrl(url);
  if (!hostname) return false;
  const domains = [site.domain];
  if (site.extraDomains) domains.push(...site.extraDomains);
  return domains.some(d => hostname === d || hostname.endsWith("." + d));
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const unlockState = await getUnlockState();
  for (const [siteId, info] of Object.entries(unlockState.unlockedSites)) {
    if (info.tabId === tabId) {
      await addSiteBlockingRule(siteId);
      unlockState.usedSitesThisPeriod[siteId] = true;
      delete unlockState.unlockedSites[siteId];
      await saveUnlockState(unlockState);
      break;
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const unlockState = await getUnlockState();
  const settings = await getSettings();

  for (const [siteId, info] of Object.entries(unlockState.unlockedSites)) {
    // Claim unclaimed tabs (unlock-all mode: tabId is null until first visit)
    if (info.tabId === null && changeInfo.url) {
      const site = settings.blockedSites.find(s => s.id === siteId);
      if (site && urlMatchesSite(changeInfo.url, site)) {
        unlockState.unlockedSites[siteId] = { tabId, unlockedAt: info.unlockedAt };
        await saveUnlockState(unlockState);
        if (changeInfo.status === "complete" || !changeInfo.status) {
          injectExitWarning(tabId);
        }
        return;
      }
      continue;
    }

    if (info.tabId !== tabId) continue;

    // If URL changed, check if they navigated away from the unlocked site
    if (changeInfo.url) {
      const site = settings.blockedSites.find(s => s.id === siteId);
      if (site && !urlMatchesSite(changeInfo.url, site)) {
        await addSiteBlockingRule(siteId);
        unlockState.usedSitesThisPeriod[siteId] = true;
        delete unlockState.unlockedSites[siteId];
        await saveUnlockState(unlockState);
        return;
      }
    }

    // Inject exit warning once the page finishes loading
    if (changeInfo.status === "complete") {
      injectExitWarning(tabId);
    }
    break;
  }
});

// --- Message Handling ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(err => {
    sendResponse({ error: err.message });
  });
  return true; // async response
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case "getState": {
      await ensurePeriodState();
      const settings = await getSettings();
      const unlockState = await getUnlockState();
      const emergency = await getEmergencyUnlocks();
      const period = getCurrentPeriod();
      return {
        settings,
        unlockState,
        emergency,
        period: { ...period, label: getPeriodLabel(period.periodIndex) },
      };
    }

    case "unlockSite": {
      const { siteId, tabId } = message;
      await ensurePeriodState();
      const settings = await getSettings();
      const unlockState = await getUnlockState();

      // Check if already used this period
      if (unlockState.usedSitesThisPeriod[siteId]) {
        return { error: "alreadyUsedThisPeriod" };
      }

      if (settings.unlockAllMode) {
        // Unlock ALL enabled sites for this period (still one tab visit each)
        const enabledSites = settings.blockedSites.filter(s => s.enabled);
        for (const site of enabledSites) {
          if (!unlockState.unlockedSites[site.id] && !unlockState.usedSitesThisPeriod[site.id]) {
            unlockState.unlockedSites[site.id] = { tabId: null, unlockedAt: Date.now() };
            await removeSiteBlockingRule(site.id);
            await updateAnalytics({ unlock: site.id });
          }
        }
        // Set the requesting site's tab for tracking
        unlockState.unlockedSites[siteId] = { tabId, unlockedAt: Date.now() };
        await saveUnlockState(unlockState);
      } else {
        // Standard mode: unlock only the requested site
        unlockState.unlockedSites[siteId] = { tabId, unlockedAt: Date.now() };
        await saveUnlockState(unlockState);
        await removeSiteBlockingRule(siteId);
        await updateAnalytics({ unlock: siteId });
      }

      return { success: true };
    }

    case "emergencyUnlock": {
      const { siteId, tabId } = message;
      await ensurePeriodState();
      const settings = await getSettings();
      const emergency = await getEmergencyUnlocks();

      if (emergency.usedThisWeek >= settings.emergencyUnlocksPerWeek) {
        return { error: "noEmergencyUnlocksRemaining" };
      }

      const unlockState = await getUnlockState();
      unlockState.unlockedSites[siteId] = { tabId, unlockedAt: Date.now() };
      await saveUnlockState(unlockState);

      emergency.usedThisWeek++;
      await saveEmergencyUnlocks(emergency);

      await removeSiteBlockingRule(siteId);
      await updateAnalytics({ unlock: siteId, emergency: siteId });

      return { success: true };
    }

    case "claimTab": {
      const { siteId, tabId } = message;
      const unlockState = await getUnlockState();
      if (unlockState.unlockedSites[siteId]) {
        unlockState.unlockedSites[siteId].tabId = tabId;
        await saveUnlockState(unlockState);
      }
      return { success: true };
    }

    case "saveWriting": {
      const { entry } = message;
      await addWritingEntry(entry);
      await updateAnalytics({ writing: { wordCount: entry.wordCount } });
      return { success: true };
    }

    case "addSite": {
      const { domain, label } = message;
      const settings = await getSettings();
      const id = domain.replace(/[^a-z0-9]/gi, "_").toLowerCase();

      if (settings.blockedSites.some(s => s.domain === domain)) {
        return { error: "siteAlreadyExists" };
      }

      settings.blockedSites.push({ id, domain, label: label || domain, enabled: true, isCustom: true });
      await saveSettings(settings);
      await createAllBlockingRules();
      return { success: true };
    }

    case "removeSite": {
      const { siteId } = message;
      const settings = await getSettings();
      settings.blockedSites = settings.blockedSites.filter(s => s.id !== siteId);
      await saveSettings(settings);
      await createAllBlockingRules();
      return { success: true };
    }

    case "toggleSite": {
      const { siteId, enabled } = message;
      const settings = await getSettings();
      const site = settings.blockedSites.find(s => s.id === siteId);
      if (site) {
        site.enabled = enabled;
        await saveSettings(settings);
        await createAllBlockingRules();
      }
      return { success: true };
    }

    case "updateSettings": {
      const { wordMinimum, emergencyUnlocksPerWeek, unlockAllMode } = message;
      const settings = await getSettings();
      if (wordMinimum !== undefined) settings.wordMinimum = wordMinimum;
      if (emergencyUnlocksPerWeek !== undefined) settings.emergencyUnlocksPerWeek = emergencyUnlocksPerWeek;
      if (unlockAllMode !== undefined) settings.unlockAllMode = unlockAllMode;
      await saveSettings(settings);
      return { success: true };
    }

    case "getAnalytics": {
      return await getAnalytics();
    }

    case "getWritingHistory": {
      return await getWritingHistory();
    }

    default:
      return { error: "unknownAction" };
  }
}

// --- Lifecycle ---

chrome.runtime.onInstalled.addListener(async () => {
  await initializeDefaults();
  await createAllBlockingRules();
  await ensurePeriodState();
  schedulePeriodAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensurePeriodState();
  schedulePeriodAlarm();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "periodTransition") {
    await ensurePeriodState();
    schedulePeriodAlarm();
  }
});

// Also ensure state when service worker wakes for any reason
ensurePeriodState().then(() => schedulePeriodAlarm());

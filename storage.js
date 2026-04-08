// Storage helper for Social Blocker extension

const DEFAULT_BLOCKED_SITES = [
  { id: "facebook",  domain: "facebook.com",   label: "Facebook",    enabled: true },
  { id: "instagram", domain: "instagram.com",  label: "Instagram",   enabled: true },
  { id: "twitter",   domain: "x.com",          label: "X (Twitter)", enabled: true, extraDomains: ["twitter.com"] },
  { id: "linkedin",  domain: "linkedin.com",   label: "LinkedIn",    enabled: true },
  { id: "reddit",    domain: "reddit.com",     label: "Reddit",      enabled: true },
  { id: "tiktok",    domain: "tiktok.com",     label: "TikTok",      enabled: true },
  { id: "youtube",   domain: "youtube.com",    label: "YouTube",     enabled: true },
  { id: "snapchat",  domain: "snapchat.com",   label: "Snapchat",   enabled: true },
  { id: "pinterest", domain: "pinterest.com",  label: "Pinterest",   enabled: true },
  { id: "threads",   domain: "threads.net",    label: "Threads",     enabled: true },
  { id: "mastodon",  domain: "mastodon.social", label: "Mastodon",   enabled: true },
  { id: "bluesky",   domain: "bsky.app",       label: "Bluesky",    enabled: true },
  { id: "discord",   domain: "discord.com",    label: "Discord",     enabled: true },
  { id: "twitch",    domain: "twitch.tv",      label: "Twitch",      enabled: true },
];

const DEFAULT_SETTINGS = {
  wordMinimum: 200,
  emergencyUnlocksPerWeek: 3,
  blockedSites: DEFAULT_BLOCKED_SITES,
};

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getCurrentPeriod() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodIndex = Math.floor(now.getHours() / 6); // 0, 1, 2, 3
  const periodStart = startOfDay.getTime() + periodIndex * 6 * 60 * 60 * 1000;
  const periodEnd = periodStart + 6 * 60 * 60 * 1000;
  return { periodIndex, periodStart, periodEnd };
}

function getPeriodLabel(periodIndex) {
  const labels = ["12:00 AM – 6:00 AM", "6:00 AM – 12:00 PM", "12:00 PM – 6:00 PM", "6:00 PM – 12:00 AM"];
  return labels[periodIndex];
}

// Storage getters/setters

async function getSettings() {
  const result = await chrome.storage.local.get("settings");
  return result.settings || DEFAULT_SETTINGS;
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

async function getUnlockState() {
  const result = await chrome.storage.local.get("unlockState");
  return result.unlockState || {
    currentPeriodStart: 0,
    unlockedSites: {},
    usedSitesThisPeriod: {},
  };
}

async function saveUnlockState(state) {
  await chrome.storage.local.set({ unlockState: state });
}

async function getEmergencyUnlocks() {
  const result = await chrome.storage.local.get("emergencyUnlocks");
  return result.emergencyUnlocks || {
    weekStart: getMonday(new Date()),
    usedThisWeek: 0,
  };
}

async function saveEmergencyUnlocks(data) {
  await chrome.storage.local.set({ emergencyUnlocks: data });
}

async function getWritingHistory() {
  const result = await chrome.storage.local.get("writingHistory");
  return result.writingHistory || [];
}

async function addWritingEntry(entry) {
  const history = await getWritingHistory();
  history.push(entry);
  await chrome.storage.local.set({ writingHistory: history });
}

async function getAnalytics() {
  const result = await chrome.storage.local.get("analytics");
  return result.analytics || {
    totalUnlocks: 0,
    unlocksBySite: {},
    totalWritingExercises: 0,
    totalWordsWritten: 0,
    totalEmergencyUnlocks: 0,
    emergencyUnlocksBySite: {},
  };
}

async function updateAnalytics(deltas) {
  const analytics = await getAnalytics();
  if (deltas.unlock) {
    analytics.totalUnlocks++;
    analytics.unlocksBySite[deltas.unlock] = (analytics.unlocksBySite[deltas.unlock] || 0) + 1;
  }
  if (deltas.writing) {
    analytics.totalWritingExercises++;
    analytics.totalWordsWritten += deltas.writing.wordCount || 0;
  }
  if (deltas.emergency) {
    analytics.totalEmergencyUnlocks++;
    analytics.emergencyUnlocksBySite[deltas.emergency] = (analytics.emergencyUnlocksBySite[deltas.emergency] || 0) + 1;
  }
  await chrome.storage.local.set({ analytics });
}

async function initializeDefaults() {
  const result = await chrome.storage.local.get("settings");
  if (!result.settings) {
    await chrome.storage.local.set({
      settings: DEFAULT_SETTINGS,
      unlockState: { currentPeriodStart: 0, unlockedSites: {}, usedSitesThisPeriod: {} },
      emergencyUnlocks: { weekStart: getMonday(new Date()), usedThisWeek: 0 },
      writingHistory: [],
      analytics: {
        totalUnlocks: 0,
        unlocksBySite: {},
        totalWritingExercises: 0,
        totalWordsWritten: 0,
        totalEmergencyUnlocks: 0,
        emergencyUnlocksBySite: {},
      },
    });
  }
}

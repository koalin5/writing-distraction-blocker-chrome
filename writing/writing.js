const params = new URLSearchParams(window.location.search);
const siteId = params.get("site");
const domain = params.get("domain");
const label = params.get("label") || domain;

document.getElementById("siteName").textContent = label;

const writingArea = document.getElementById("writingArea");
const currentWordsEl = document.getElementById("currentWords");
const requiredWordsEl = document.getElementById("requiredWords");
const progressFill = document.getElementById("progressFill");
const submitBtn = document.getElementById("submitBtn");
const warningMsg = document.getElementById("warningMsg");
const errorMsg = document.getElementById("errorMsg");
const backBtn = document.getElementById("backBtn");

let requiredWords = 200;
let currentPrompt = "";

// --- Init ---

async function init() {
  const state = await chrome.runtime.sendMessage({ action: "getState" });
  requiredWords = state.settings.wordMinimum;
  requiredWordsEl.textContent = requiredWords;

  // Check if already exhausted visits this period
  const visitCount = state.unlockState.usedSitesThisPeriod[siteId] || 0;
  const limit = state.settings.visitsPerPeriod;
  const exhausted = limit > 0 && visitCount >= limit;
  if (exhausted) {
    showError("You've used all your visits for this site during this period.");
    writingArea.disabled = true;
    submitBtn.disabled = true;
    return;
  }

  // Select prompt (avoid recent ones)
  const history = await chrome.runtime.sendMessage({ action: "getWritingHistory" });
  const recentPrompts = (history || []).slice(-20).map(e => e.prompt);
  currentPrompt = pickPrompt(recentPrompts);
  document.getElementById("promptText").textContent = currentPrompt;
}

function pickPrompt(recentPrompts) {
  const available = PROMPTS.filter(p => !recentPrompts.includes(p));
  const pool = available.length > 0 ? available : PROMPTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// --- Anti-Paste ---

writingArea.addEventListener("paste", (e) => {
  e.preventDefault();
  showWarning("Pasting is not allowed. Please type your response.");
});

writingArea.addEventListener("drop", (e) => {
  e.preventDefault();
  showWarning("Drag and drop is not allowed. Please type your response.");
});

// --- Word Counting ---

function countWords(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0);
}

function updateWordCount() {
  const words = countWords(writingArea.value);
  const count = words.length;
  currentWordsEl.textContent = count;

  const pct = Math.min((count / requiredWords) * 100, 100);
  progressFill.style.width = pct + "%";

  if (count >= requiredWords) {
    progressFill.classList.add("complete");
    submitBtn.disabled = false;
  } else {
    progressFill.classList.remove("complete");
    submitBtn.disabled = true;
  }
}

writingArea.addEventListener("input", () => {
  updateWordCount();
  hideMessages();
});

// --- Validation ---

function validateWriting(text) {
  const words = countWords(text);
  const wordCount = words.length;

  if (wordCount < requiredWords) {
    return { valid: false, reason: `You need at least ${requiredWords} words. You have ${wordCount}.` };
  }

  // Average word length check (catches "a b c d e f" spam)
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const avgLength = totalChars / wordCount;
  if (avgLength < 3) {
    return { valid: false, reason: "Your writing has too many very short words. Please write genuine sentences." };
  }

  // Repetition check (catches "the the the the" spam)
  const freq = {};
  words.forEach(w => {
    const lower = w.toLowerCase().replace(/[^a-z']/g, "");
    if (lower) freq[lower] = (freq[lower] || 0) + 1;
  });
  const maxFreq = Math.max(...Object.values(freq));
  if (maxFreq / wordCount > 0.3) {
    return { valid: false, reason: "Your writing contains too much repetition. Please write varied sentences." };
  }

  return { valid: true, wordCount };
}

// --- Submit ---

submitBtn.addEventListener("click", async () => {
  hideMessages();

  const text = writingArea.value;
  const validation = validateWriting(text);

  if (!validation.valid) {
    showError(validation.reason);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  // Save writing entry
  const entry = {
    id: crypto.randomUUID(),
    siteId,
    prompt: currentPrompt,
    text,
    wordCount: validation.wordCount,
    completedAt: Date.now(),
  };

  await chrome.runtime.sendMessage({ action: "saveWriting", entry });

  // Unlock the site
  const currentTab = await chrome.tabs.getCurrent();
  const response = await chrome.runtime.sendMessage({
    action: "unlockSite",
    siteId,
    tabId: currentTab.id,
  });

  if (response.error === "alreadyUsedThisPeriod") {
    showError("You already unlocked this site during this period.");
    submitBtn.textContent = "Submit & Unlock";
    return;
  }

  if (response.success) {
    window.location.href = `https://${domain}`;
  } else {
    showError("Something went wrong. Please try again.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit & Unlock";
  }
});

// --- Back Button ---

backBtn.addEventListener("click", () => {
  history.back();
});

// --- Helpers ---

function showWarning(msg) {
  warningMsg.textContent = msg;
  warningMsg.classList.remove("hidden");
  setTimeout(() => warningMsg.classList.add("hidden"), 3000);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
}

function hideMessages() {
  errorMsg.classList.add("hidden");
  warningMsg.classList.add("hidden");
}

init();

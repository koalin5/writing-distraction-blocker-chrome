# Social Blocker

A Chrome extension that blocks social media sites and makes you complete a writing exercise to unlock them. Instead of mindlessly scrolling, you write something meaningful first.

## How It Works

1. **Sites are blocked by default.** Navigate to any blocked site and you'll see a block screen instead.
2. **Write to unlock.** To access a blocked site, complete a writing exercise — a random creative prompt with a word minimum you choose (50, 100, 200, 500, or 750 words).
3. **One visit per period.** The day is split into four 6-hour windows (12am–6am, 6am–12pm, 12pm–6pm, 6pm–12am). You get one unlock per site per window. Close the tab or navigate away and it's blocked again until the next window.
4. **Unlock-all mode (optional).** By default, you write one exercise per site. Turn on "Unlock all sites with one exercise" in settings, and a single writing exercise unlocks every blocked site for the current period. You still get only one visit per site — it just saves you from writing multiple exercises.
5. **Anti-cheat.** No pasting, no drag-and-drop, no single-letter spam. The extension validates that you're writing real words with reasonable variety.
6. **Emergency bypass.** For genuinely urgent situations, you get 3 emergency unlocks per week (configurable) that skip the writing requirement.

## Pre-Blocked Sites

Facebook, Instagram, X (Twitter), LinkedIn, Reddit, TikTok, YouTube, Snapchat, Pinterest, Threads, Mastodon, Bluesky, Discord, Twitch

You can add or remove sites through the extension popup settings.

## Features

- 135 writing prompts across five categories: creative, reflective, analytical, observational, and hypothetical
- Configurable word minimum (50 / 100 / 200 / 500 / 750)
- Custom site blocking — add any domain
- Exit warning before leaving an unlocked site
- Writing history — every exercise is saved and viewable
- Analytics dashboard — track unlocks, words written, and usage patterns
- All data stored locally in your browser — nothing is sent anywhere

## Installation

### From Source (Manual)

1. Clone or download this repository:
   ```
   git clone https://github.com/your-username/social-blocker-chrome-ext.git
   ```

2. Open Chrome and go to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked**

5. Select the `social-blocker-chrome-ext` folder (the one containing `manifest.json`)

6. The extension icon appears in your toolbar. Click it to open the popup and configure settings.

That's it. Sites are blocked immediately after installation.

### Updating

If you pull new changes from the repository:

1. Go to `chrome://extensions`
2. Find Social Blocker
3. Click the reload icon (circular arrow)

## Configuration

Click the extension icon in your Chrome toolbar to open the popup.

### Dashboard Tab

Shows your current state at a glance:
- **Current period** — which 6-hour window you're in (e.g., "12:00 PM – 6:00 PM")
- **Emergency unlocks remaining** — how many no-writing bypasses you have left this week
- **Site list** — every blocked site with its current status:
  - **Blocked** — site is blocked, unlock available
  - **Unlocked** — site is currently open in a tab
  - **Used** — you already unlocked this site during the current period; wait for the next one
  - **Disabled** — site is in the list but blocking is turned off

### Settings Tab

**Word Minimum** — How many words you must write to unlock a site. Options: 50, 100, 200 (default), 500, or 750. Lower values are good for getting started; higher values force deeper writing. This applies to all future writing exercises immediately.

**Unlock All Sites with One Exercise** — Off by default. When enabled, completing a single writing exercise unlocks every blocked site for the current 6-hour period. Each site still allows only one visit (close the tab and it's blocked again), but you don't have to write separate exercises for each one. Good if you block many sites but don't want to write five different essays just to check your feeds.

**Emergency Unlocks per Week** — How many times you can bypass the writing requirement per week (resets every Monday). Default is 3. Set to 0 if you want no escape hatch.

**Site Management** — Every site in your block list is shown here with controls:
- **On/Off toggle** — Temporarily disable blocking for a site without removing it. Useful if you need a site for work temporarily.
- **Remove button** — Permanently delete a custom site from the list. Default sites can only be toggled, not removed.

### Adding a Custom Site

1. Open the extension popup
2. Go to the **Settings** tab
3. Type a domain in the input field at the bottom (e.g., `news.ycombinator.com`)
4. Click **Add**

The site and all its subdomains are blocked immediately. You can add any domain — it doesn't have to be social media.

### History Tab

A chronological list of every writing exercise you've completed. Each entry shows the site you unlocked, the prompt you received, the date, and your word count. Your full written text is saved locally and viewable here.

### Stats Tab

Cumulative analytics across all your usage:
- Total unlocks (writing + emergency combined)
- Writing exercises completed
- Total words written
- Emergency unlocks used
- Breakdown of unlocks per site

## Project Structure

```
social-blocker-chrome-ext/
├── manifest.json           # Chrome extension manifest (MV3)
├── background.js           # Service worker — blocking rules, periods, tab tracking
├── storage.js              # Storage helpers and default configuration
├── prompts.js              # 135 writing prompts
├── content-warning.js      # Injected script for exit confirmation dialog
├── blocked/
│   ├── blocked.html        # Page shown when visiting a blocked site
│   ├── blocked.js
│   └── blocked.css
├── writing/
│   ├── writing.html        # Writing exercise page
│   ├── writing.js
│   └── writing.css
├── popup/
│   ├── popup.html          # Extension popup UI
│   ├── popup.js
│   └── popup.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Setting Up with Claude Code

If you use [Claude Code](https://claude.ai/claude-code), you can clone and install this extension directly from your terminal.

1. Make sure Claude Code is installed and running.

2. Navigate to where you want the project:
   ```
   cd ~/Desktop
   ```

3. Ask Claude Code:
   ```
   Clone https://github.com/your-username/social-blocker-chrome-ext.git
   and walk me through installing it as a Chrome extension.
   ```

4. Claude Code will clone the repo and give you step-by-step instructions to load it in Chrome. It can also help you customize the blocked sites list, adjust the word minimum, add new writing prompts, or modify any behavior.

**Common things to ask Claude Code after setup:**
- "Add example.com to the blocked sites list"
- "Change the default word minimum to 100"
- "Add 20 new writing prompts about technology"
- "Make the writing page font larger"

Note: The Chrome extension must still be loaded manually through `chrome://extensions` — no CLI tool can do that step for you. Claude Code handles everything up to that point.

## Technical Details

- **Manifest V3** — uses `declarativeNetRequest` with dynamic rules for site blocking
- **Subdomain matching** — blocking `reddit.com` automatically blocks `www.reddit.com`, `old.reddit.com`, etc.
- **Only blocks top-level navigation** — embedded content (like a YouTube video on another site) is not affected
- **Service worker resilient** — state is validated on every wake, so nothing breaks if Chrome suspends the background process
- **Period transitions** — handled via `chrome.alarms`, with defensive checks on service worker startup

## Privacy

All data stays in your browser via `chrome.storage.local`. The extension makes no network requests, has no analytics, and sends nothing to any server. Your writing, settings, and usage data are entirely local.

## License

MIT — see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome. Some ideas:

- Better icons and visual design
- Export writing history as markdown or PDF
- Dark/light theme toggle
- Customizable period lengths
- Chrome Web Store listing
- Firefox port (Manifest V2/V3 compatibility)

Open an issue or submit a pull request.

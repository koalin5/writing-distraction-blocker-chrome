# Todo — Settings, Scheduling, Stats fix

## 1. Stats bug (100 unlocks from 18 exercises)
- [ ] Root cause: unlock-all mode counted one exercise as N per-site unlocks
- [ ] Make `totalUnlocks` count one event; keep per-site breakdown via `{siteId, sites}`
- [ ] Derive Exercises Done / Words Written / streak / avg from writingHistory (source of truth)
- [ ] Add Reset Stats button + `resetAnalytics` message

## 2. Allow-paste setting (dictation)
- [ ] `allowPaste` setting (default off)
- [ ] writing.js gates paste/drop blockers on setting
- [ ] Settings toggle + dynamic placeholder

## 3. Day + time scheduling
- [ ] `freeDays` (allowlist: selected days = free) + `blockSchedule` {enabled,start,end}
- [ ] `isBlockingActiveNow()` + `reconcileBlocking(force)` with transition guard
- [ ] 1-min `scheduleCheck` alarm; route rule changes through reconcile
- [ ] Settings UI: 7 day toggles + hours window

## 4. General improvements
- [ ] Writing streak + avg words insights
- [ ] Export writing history (.txt journal)
- [ ] Honest stats relabeling + hints

## Review

All four items shipped and unit-tested (23 assertions passing).

**Stats bug** — Root cause: `unlockAllMode` called `updateAnalytics({unlock})` once per
site in the loop, so one exercise = ~14 unlocks. Fixed by recording the whole grant as a
single event `{siteId, sites:[...]}` → `totalUnlocks++` once, per-site breakdown still
populated. Verified: 18 unlock-all exercises now = 18 sessions (was 252). Exercises/words/
streak/avg now derive from `writingHistory` (source of truth) so they're always accurate,
and a Reset Stats button clears the inflated counters without losing writing history.

**Allow paste** — `allowPaste` setting (default off). `writing.js` skips the paste/drop
blockers when on; placeholder updates. Validation (min words, anti-spam) still applies.

**Schedule** — `freeDays` (allowlist: selected day = off) + `blockSchedule {enabled,start,end}`
(hours window, wraps midnight). `isBlockingActiveNow()` + `reconcileBlocking(force)` with a
transition guard (`blockingActive` flag) keep it cheap; a 1-min `scheduleCheck` alarm flips
rules promptly. All rule mutations route through reconcile. Dashboard shows when blocking is off.

**Extras** — Day streak + avg-word insights; export writing history to .txt; honest relabeling
("Unlock Sessions", "Sites Unlocked") with explanatory hints. README updated.

### Notes / trade-offs
- 1-min heartbeat alarm runs even with no schedule configured (early-returns); kept for simplicity.
- Historical unlock sessions can't be reconstructed — Reset Stats is the clean-slate path.
- New settings keys are read defensively, so existing users need no migration.

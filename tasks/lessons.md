# Lessons

## Reproduce before investigating (Sep 8, 2026)
When Esteban reported "clicking a link shows ERR_BLOCKED_BY_CLIENT", I spent many
tool calls doing forensics on Chrome's profile (other extensions' DNR rules,
filter lists) before trying to reproduce it. He had to tell me it was taking too
long — and he was right about the cause.

**Rule for myself:** for any "the extension misbehaves in the browser" report,
reproduce it FIRST with a throwaway Chrome:

```
CHR="$HOME/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
"$CHR" --headless=new --no-first-run --user-data-dir=<tmp> \
  --disable-extensions-except=<repo> --load-extension=<repo> --remote-debugging-port=9334
```

Drive it over CDP (Node 23 has a built-in WebSocket; evaluate in the
`service_worker` target to call background.js functions directly). Regular
Google Chrome refuses `--load-extension`; Chrome for Testing accepts it.
Forensics on the user's profile is a fallback, not the first move.

## Trust the user's diagnosis as a starting point
Esteban said "this is the distraction blocker creating these pages" while I was
still ruling out AdBlock. He was right: the extension redirected to
`/blocked/blocked.html`, which was not in `web_accessible_resources`, so any
page-initiated navigation (a link click) to a blocked site failed with
ERR_BLOCKED_BY_CLIENT instead of showing the writing page. Typed URLs worked,
which is why it looked intermittent.

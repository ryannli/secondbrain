# TODO

## Open (web app / OSS launch)

- [ ] Submit the extension to the Chrome Web Store ($5 one-time, ~1-3 day review).
      This is the real fix for install friction — every unpacked-install flow in the
      dashboard banner is interim. After listing, point the banner's Install button
      straight at the store page (2 clicks total).

- [x] Real demo GIF for the README hero (recorded from the live app; replaced the placeholder SVG)
- [ ] Re-record the hero GIF as one single "Skip moment": paste link → triage card appears →
      verdict says Skip (45 min saved). One loop, no product tour — this is the acquisition hook.
      Secondary asset for a follow-up post: the Contradicts connection card.
- [ ] Rotate the local Brave Search API key before publishing (never committed; disk hygiene)
- [ ] Long articles can fail to process (e.g. paulgraham.com/greatwork.html, ~9k words).
      Worked around by pointing the extension welcome-page example at a shorter essay
      (do.html) — investigate the real limit (agent timeout? prompt size?) and fix.

### Compromises (revisit before launch / scaling)
- **Extension server discovery**: probes ports 3000-3003 + 41932 in parallel and
  verifies an `app: "secondbrain"` marker before sending page content; caches the
  last-good port. Good enough for local use — replace with Chrome Native Messaging
  for public distribution (industry standard: 1Password, Bitwarden, KeePassXC).
- **Agent CLI dependency**: Claude Code or Codex CLI must be installed separately.
  Future providers should plug into the agent provider layer.
- **Seeding guard is process-cached**: `ensureUserDataInitialized` caches per-path
  initialization for the server's lifetime; deleting the data folder while the
  server runs won't re-seed until restart. Edge case, acceptable.

### Known Risks
- A local agent CLI must be installed separately — cannot bundle Claude Code or Codex
- Agent Mode gate blocks the workspace until a provider is connected
- Brave Search API key still needed for feed web search (optional feature)

---

## Deferred: macOS desktop app (Tauri)

Path not established yet — out of scope for the OSS web launch. Kept for reference.

### Decisions made earlier
- **Packaging**: Tauri (lightweight, ~10MB vs Electron's ~150MB)
- **Distribution**: Notarize + DMG (not Mac App Store — sandbox blocks subprocess + filesystem access)
- **Port**: web mode 3000 (default), Tauri 41932
- **Native Messaging**: migrate extension ↔ app communication when distributing publicly

### Remaining desktop work (when resumed)
- [ ] Apple Developer account ($99/year) for code signing + notarization
- [ ] App icon and DMG installer design
- [ ] Auto-update mechanism (Tauri has built-in support)
- [ ] Handle `user_data/` path for macOS (`~/Library/Application Support/SecondBrain/` or user-configurable)
- [ ] Port 41932 has no fallback — user gets an error on Tauri startup if taken
- [ ] Optional: macOS Share Extension / Safari extension

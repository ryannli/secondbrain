# TODO

## macOS App

### Decisions Made
- **Packaging**: Tauri (lightweight, ~10MB vs Electron's ~150MB)
- **Distribution**: Notarize + DMG (not Mac App Store — sandbox blocks subprocess + filesystem access)
- **Chrome Extension**: Keep as-is, auto-detect port (try 3000 then 41932)
- **Port**: Web mode uses 3000 (default), Tauri uses 41932
- **Native Messaging**: Migrate to Chrome Native Messaging when ready for public distribution (industry standard: 1Password, Bitwarden, KeePassXC all use this)

### To Do
- [x] Set up Tauri project scaffold
- [x] Configure fixed high port for embedded server (41932)
- [x] Update Chrome Extension to auto-detect port (try 3000 → 41932)
- [ ] Apple Developer account ($99/year) for code signing + notarization
- [ ] App icon and DMG installer design
- [ ] Auto-update mechanism (Tauri has built-in support)
- [ ] Ensure `claude` CLI is detected on startup (show helpful error if missing)
- [ ] Handle `user_data/` path for macOS (use `~/Library/Application Support/SecondBrain/` or user-configurable)

### Future (when distributing publicly)
- [ ] Replace localhost with Chrome Native Messaging for extension ↔ app communication
- [ ] Optional: macOS Share Extension (capture from any browser, not just Chrome)
- [ ] Optional: Safari Extension via `safari-web-extension-converter`

### Compromises (revisit before launch / scaling)
- **Port auto-detect**: Extension tries 3000 then 41932 sequentially (500ms timeout each). Works for single user but adds up to 500ms latency if first port is down. Replace with Chrome Native Messaging for production.
- **Port conflict**: 41932 could theoretically be taken. No fallback — user gets an error on Tauri startup.
- **Agent CLI dependency**: Claude Code or Codex CLI must be installed separately. Future providers should plug into the agent provider layer.

### Known Risks
- A local agent CLI must be installed separately — cannot bundle Claude Code or Codex
- Agent Mode gate blocks the workspace until a provider is connected
- Brave Search API key still needed for feed (optional feature)

# LoL Spell Overlay Sync

This Electron overlay can connect to the matchmaker backend and share one spell-check state across all users.

## How Sync Works

```text
Admin overlay click
  -> backend WebSocket checks admin token
  -> backend stores the spellcheck state
  -> backend broadcasts the state
  -> website and every connected overlay update
```

Users without an admin token can still view the shared overlay state, but their clicks do not change the shared state.

## Setup

1. Copy `overlay-config.example.json` to `overlay-config.json`.
2. Set `serverUrl` to the deployed matchmaker site URL.
3. Run the overlay and log in with the website account.

Example:

```json
{
  "enabled": true,
  "serverUrl": "https://posung-lol-match.win",
  "token": ""
}
```

If `overlay-config.json` does not exist, the overlay keeps working as a local-only overlay.

## Login

When sync is enabled and no saved token exists, the overlay opens a login form.

Admin accounts can control timers. Normal approved users can view the shared state, but clicks are blocked by the server.

The overlay saves only `serverUrl`. Login tokens are kept in memory, so users log in again after restarting the overlay.

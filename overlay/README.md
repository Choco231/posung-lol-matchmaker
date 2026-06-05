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
3. Put a JWT token in `token` only for an admin-controlled overlay.

Example:

```json
{
  "enabled": true,
  "serverUrl": "https://posung-lol-match.win",
  "token": "paste-admin-jwt-here"
}
```

If `overlay-config.json` does not exist, the overlay keeps working as a local-only overlay.

## Getting A Token

For now, log in to the website and use the token stored by the frontend in browser `localStorage` under the key `token`.

Later this can be replaced with an overlay login screen if manual token copying becomes annoying.

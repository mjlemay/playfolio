# Kiosk Login Flow

## Overview

When a player interacts with a t418-kiosk-app device (via RFID, QR code, or manual entry), the kiosk records a login activity locally, then syncs it to the playfolio API. The API uses the player's club key to look up their identity. If no matching player exists, one is created automatically.

---

## Systems Involved

| System | Role |
|---|---|
| `t418-kiosk-app` | Tauri/React desktop app running on kiosk hardware |
| `t418-kiosk-app` local SQLite | Offline-first queue for activities and player cache |
| `playfolio` API | Source of truth for players, keychains, keys, and activities |
| `playfolio` PostgreSQL | Persistent storage for all API data |

---

## Step-by-Step Flow

### 1. Player Identification (on the kiosk)

The kiosk detects a player via one of three triggers:

- **RFID** — hardware reader captures a tag code
- **QR Code** — camera or scanner captures a code
- **Manual Entry** — player types an identifier

The kiosk looks up the player in its local SQLite database using `playerService.getPlayerByRFID()` or `getPlayerByQRCode()`. If no local record exists, a new local player is auto-created with `createPlayerFromRFID()` / `createPlayerFromQRCode()`.

> The club key (UUID) stored on the device is what gets sent to the API. The RFID/QR code is the local identifier; the club key is the remote identity credential.

---

### 2. Session Start (on the kiosk)

Once identified:

- `playerSessionStore.loginPlayer(player, trigger)` sets the active session in UI state and starts a 2-minute pause timer to prevent duplicate scans.
- `activityService.createLoginActivity(player, trigger)` writes an activity record to local SQLite with:
  - `uid` — unique UUID for this activity
  - `player_snowflake` — kiosk-local player ID
  - `device_id` — this device's UUID
  - `activity_type` — `'kiosk_login'`
  - `login_trigger` — `'rfid'` | `'qr_code'` | `'manual_entry'`
  - `meta.key` — the club key (UUID) stored on the kiosk for this player
  - `synced` — `false` (not yet sent to API)

---

### 3. Sync to Playfolio API (background)

`syncService` runs on a periodic timer (default every 5 minutes) and also triggers immediately after login. It fetches unsynced activities and POSTs each one to `POST /api/activities` on the playfolio API.

**Sync payload:**

```json
{
  "key": "<club_key UUID>",
  "originating_club_id": "<club UID>",
  "device_id": "<device UUID>",
  "format": "kiosk_login",
  "meta": {
    "login_trigger": "rfid",
    "kiosk_snowflake": "<kiosk-local player ID>",
    "kiosk_player_name": "<player name on kiosk>",
    "synced_at": "<ISO timestamp>",
    "kiosk_activity_uid": "<activity UUID>"
  }
}
```

Failed syncs are retried with exponential backoff (5s → 15s → 45s → 2min). Activities that fail 10+ times are abandoned.

---

### 4. Player Resolution on the API

When `POST /api/activities` receives the payload, it resolves the player from the club key:

```
key + originating_club_id → club_keys table → keychain → keychain_players → player_uids[]
```

This uses `resolvePlayersFromKey()` from `src/lib/keychain.ts`.

**Two outcomes:**

#### A. Player found

The key resolves to one or more `player_uids`. The activity is recorded against `player_uids[0]` (the primary device account for this keychain). Usage tracking on the club key is updated (`usage_count`, `last_used_at`).

#### B. Player not found (new device)

The key does not exist in `club_keys`. This means the device has never been registered with this club before. The API should:

1. **Create a new player** — `POST /api/players` internally, which also auto-creates a keychain with a fresh auth code.
2. **Issue a new club key** — `POST /api/clubs/:club_id/keys` with the new keychain's auth code, generating the UUID key that will be sent back to the kiosk.
3. **Record the activity** — insert into the `activities` table with the new `player_uid`.
4. **Return the new key** — the sync response includes the newly issued club key UUID so the kiosk can store it locally and use it for all future syncs.

> **Note:** This auto-registration path requires a dedicated endpoint or an extended `POST /api/activities` that handles the not-found case gracefully, rather than returning a 400 error.

---

### 5. Activity Recorded

On success, the API returns `{ success: true, data: { ...activity } }`. The kiosk calls `activityService.markActivityAsSynced(activityId)` to update the local record.

---

## Current Gaps

| Gap | Description |
|---|---|
| **Auto-register path missing** | `POST /api/activities` currently returns a `400` error if the key is not found. It needs an auto-create player + issue key + return new key path. |
| **New key handoff** | The kiosk sync service does not yet handle a response that includes a newly issued key. It needs to update the local player record with the returned key so future syncs use it. |
| **Activity attribution for merged keychains** | When a keychain has multiple players, activities are attributed to `player_uids[0]`. The intended attribution logic (primary vs. all members) should be confirmed. |

---

## Data Flow Diagram

```
KIOSK DEVICE
┌─────────────────────────────────────────────┐
│ RFID / QR / Manual                          │
│       ↓                                     │
│ playerService (local SQLite lookup/create)  │
│       ↓                                     │
│ playerSessionStore (UI session state)       │
│       ↓                                     │
│ activityService (write to local SQLite)     │
│       ↓                                     │
│ syncService (background timer / immediate)  │
└──────────────────┬──────────────────────────┘
                   │ POST /api/activities
                   │ { key, originating_club_id, format, meta }
                   ▼
PLAYFOLIO API
┌─────────────────────────────────────────────┐
│ resolvePlayersFromKey(key, club_id)         │
│       ↓                                     │
│ [found] → record activity → 201 OK          │
│ [not found] → create player + keychain      │
│             → issue club key                │
│             → record activity               │
│             → 201 OK + { new_key }          │
└─────────────────────────────────────────────┘
                   │
                   ▼
KIOSK (on 201 with new_key)
┌─────────────────────────────────────────────┐
│ store new_key on local player record        │
│ markActivityAsSynced()                      │
└─────────────────────────────────────────────┘
```

---

## Files to Modify

### `playfolio` API

| File | Change |
|---|---|
| `src/app/api/activities/route.ts` | Add auto-register path: create player + keychain + issue key when `key` not found |

### `t418-kiosk-app`

| File | Change |
|---|---|
| `src/services/syncService.ts` | Handle `new_key` in sync response — update local player record |
| `src/services/playerService.ts` | Add `updatePlayerKey(playerId, key)` to persist newly issued club key |

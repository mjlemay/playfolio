import { eq } from 'drizzle-orm';
import db from './db';
import { players, type Player } from './schema';
import { createKeychainForPlayer } from './keychain';

export interface SessionIdentity {
  player_uid: string;
  email: string;
  display_name?: string;
}

export type SessionResult =
  | { ok: true; identity: SessionIdentity; player: Player }
  | { ok: false; status: 401 | 503; error: string };

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// `ory_kratos_session` is Kratos's default cookie name, and playfolio-login/kratos/kratos.yml
// does not override `session.cookie.name`. If it is ever renamed there, this short-circuit
// must change with it — otherwise every request 401s without ever calling Kratos.
const HAS_SESSION_COOKIE = /(^|;\s*)ory_kratos_session=/;

function kratosPublicUrl(): string {
  return (process.env.KRATOS_PUBLIC_URL ?? 'http://localhost:4433').replace(/\/+$/, '');
}

const NO_SESSION: SessionResult = { ok: false, status: 401, error: 'No session' };
const UNAVAILABLE: SessionResult = { ok: false, status: 503, error: 'Identity service unavailable' };

interface WhoamiBody {
  identity?: { traits?: { email?: unknown; player_uid?: unknown; display_name?: unknown } };
}

/**
 * Resolve the Kratos session behind a request to a Playfolio player.
 * players.uid IS the Kratos player_uid; the row is created on first sight.
 */
export async function getSessionPlayer(request: Request): Promise<SessionResult> {
  const cookie = request.headers.get('cookie') ?? '';
  if (!HAS_SESSION_COOKIE.test(cookie)) return NO_SESSION;

  let res: Response;
  try {
    res = await fetch(`${kratosPublicUrl()}/sessions/whoami`, {
      headers: { cookie, accept: 'application/json' },
      cache: 'no-store',
      // Don't let a hung identity service hold a request open; the catch below maps
      // the resulting TimeoutError to a 503.
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error('[session] kratos unreachable:', String(e));
    return UNAVAILABLE;
  }
  if (res.status >= 500) {
    console.error(`[session] kratos whoami responded ${res.status}`);
    return UNAVAILABLE;
  }
  // 401 (no/expired session) lands here, and so would a 403 `session_aal2_required`;
  // 2FA is not enabled for this deployment, so that cannot occur today.
  if (!res.ok) return NO_SESSION;

  // A 200 we cannot parse is the identity service misbehaving, not a bad caller.
  const body = (await res.json().catch(() => null)) as WhoamiBody | null;
  if (!body) {
    console.error('[session] kratos whoami returned an unreadable body');
    return UNAVAILABLE;
  }

  const traits = body.identity?.traits ?? {};
  const player_uid = typeof traits.player_uid === 'string' ? traits.player_uid : '';
  if (!UUID_V4.test(player_uid)) {
    console.error('[session] session identity has no valid player_uid trait');
    return { ok: false, status: 401, error: 'Session has no player_uid' };
  }

  const email = typeof traits.email === 'string' ? traits.email : '';
  if (!email) console.error('[session] session identity has no email trait');

  const identity: SessionIdentity = {
    player_uid,
    email,
    ...(typeof traits.display_name === 'string' && traits.display_name
      ? { display_name: traits.display_name }
      : {}),
  };

  const player = await ensurePlayer(identity);
  return { ok: true, identity, player };
}

/** Find the player row for this identity, creating it (and its keychain) if absent. */
async function ensurePlayer(identity: SessionIdentity): Promise<Player> {
  const existing = await db.select().from(players).where(eq(players.uid, identity.player_uid)).limit(1);
  if (existing.length > 0) return existing[0];

  // One transaction so a keychain failure rolls the player row back with it,
  // rather than leaving an account that no device can ever reach.
  const created = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(players)
      .values({
        uid: identity.player_uid,
        meta: identity.display_name ? { name: identity.display_name } : null,
        status: 'unknown',
      })
      .onConflictDoNothing()
      .returning();

    if (inserted.length === 0) return null;

    // We won the race: give the new account a keychain, like every other player.
    await createKeychainForPlayer(identity.player_uid, tx);
    return inserted[0];
  });

  if (created) return created;

  // Someone else inserted concurrently; read theirs.
  const [row] = await db.select().from(players).where(eq(players.uid, identity.player_uid)).limit(1);
  if (!row) throw new Error(`player ${identity.player_uid} vanished during creation`);
  return row;
}

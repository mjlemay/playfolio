import { getSessionPlayer } from '@/lib/session';
import { getPlayerMemberships } from '@/lib/players';
import { json } from '@/lib/http';

// GET /api/me - The player behind the Kratos session cookie, with memberships.
export async function GET(request: Request) {
  try {
    // Inside the try: getSessionPlayer touches the database (it creates the player
    // row on first sight), so its failures belong in the 500 envelope too.
    const session = await getSessionPlayer(request);
    if (!session.ok) {
      return json({ success: false, error: session.error }, { status: session.status });
    }

    const memberships = await getPlayerMemberships(session.player.uid);
    return json({
      success: true,
      data: {
        ...session.player,
        ...memberships,
        identity: {
          email: session.identity.email,
          ...(session.identity.display_name ? { display_name: session.identity.display_name } : {}),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching current player:', error);
    return json({ success: false, error: 'Failed to fetch player' }, { status: 500 });
  }
}

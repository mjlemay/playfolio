import { NextRequest, NextResponse } from 'next/server';
import { getSessionPlayer } from '@/lib/session';
import { getPlayerMemberships } from '@/lib/players';

// GET /api/me - The player behind the Kratos session cookie, with memberships.
export async function GET(request: NextRequest | Request) {
  const session = await getSessionPlayer(request);
  if (!session.ok) {
    return NextResponse.json({ success: false, error: session.error }, { status: session.status });
  }

  try {
    const memberships = await getPlayerMemberships(session.player.uid);
    return NextResponse.json({
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
    return NextResponse.json({ success: false, error: 'Failed to fetch player' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { resolvePlayerFromKey } from '@/lib/keychain';

// POST /api/keychain/resolve - Resolve player_uid from key + originating_club_id
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.key || !body.originating_club_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Both key and originating_club_id are required',
        },
        { status: 400 }
      );
    }

    // Resolve the key
    const resolution = await resolvePlayerFromKey(
      body.key,
      body.originating_club_id
    );

    if (!resolution.success) {
      return NextResponse.json(
        { success: false, error: resolution.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        player_uid: resolution.player_uid,
      },
    });
  } catch (error) {
    console.error('Error resolving key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to resolve key' },
      { status: 500 }
    );
  }
}

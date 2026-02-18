import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import db from '@/lib/db';
import { clubKeys, clubs, keychains } from '@/lib/schema';
import { generateKey } from '@/lib/keychain';

// POST /api/clubs/[uid]/keys - Create a new key for a player via their auth_code
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid: clubId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.auth_code) {
      return NextResponse.json(
        { success: false, error: 'auth_code is required' },
        { status: 400 }
      );
    }

    // Verify club exists
    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.uid, clubId))
      .limit(1);

    if (club.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      );
    }

    // Look up keychain by auth_code
    const keychain = await db
      .select()
      .from(keychains)
      .where(eq(keychains.auth_code, body.auth_code))
      .limit(1);

    if (keychain.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Keychain not found for this auth code' },
        { status: 404 }
      );
    }

    // Generate new key
    const key = generateKey();

    // Create the key record
    const newKey = await db
      .insert(clubKeys)
      .values({
        key,
        keychain_id: keychain[0].uid,
        originating_club_id: clubId,
        status: 'active',
        meta: body.meta || null,
        expires_at: body.expires_at ? new Date(body.expires_at) : null,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newKey[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create key' },
      { status: 500 }
    );
  }
}

// GET /api/clubs/[uid]/keys - List all keys created by this club
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid: clubId } = await params;
    const { searchParams } = new URL(request.url);

    // Optional filter
    const status = searchParams.get('status');

    // Verify club exists
    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.uid, clubId))
      .limit(1);

    if (club.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      );
    }

    // Build query conditions
    const conditions = [eq(clubKeys.originating_club_id, clubId)];

    if (status) {
      conditions.push(eq(clubKeys.status, status));
    }

    // Fetch keys
    const keys = await db
      .select()
      .from(clubKeys)
      .where(and(...conditions));

    return NextResponse.json({
      success: true,
      data: keys,
      count: keys.length,
    });
  } catch (error) {
    console.error('Error fetching keys:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch keys' },
      { status: 500 }
    );
  }
}

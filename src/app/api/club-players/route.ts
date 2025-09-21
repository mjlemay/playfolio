import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import db from '@/lib/db';
import { clubPlayers, clubs, players } from '@/lib/schema';

// GET /api/club-players - List club-player relationships
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId');
    const playerUid = searchParams.get('playerUid');
    
    const baseQuery = db
      .select({
        club_id: clubPlayers.club_id,
        player_uid: clubPlayers.player_uid,
        joined_date: clubPlayers.joined_date,
        role: clubPlayers.role,
        status: clubPlayers.status,
        club: clubs,
        player: players,
      })
      .from(clubPlayers)
      .leftJoin(clubs, eq(clubPlayers.club_id, clubs.uid))
      .leftJoin(players, eq(clubPlayers.player_uid, players.uid));
    
    let relationships;
    
    if (clubId && playerUid) {
      relationships = await baseQuery.where(
        and(
          eq(clubPlayers.club_id, clubId),
          eq(clubPlayers.player_uid, playerUid)
        )
      );
    } else if (clubId) {
      relationships = await baseQuery.where(eq(clubPlayers.club_id, clubId));
    } else if (playerUid) {
      relationships = await baseQuery.where(eq(clubPlayers.player_uid, playerUid));
    } else {
      relationships = await baseQuery;
    }
    
    return NextResponse.json({
      success: true,
      data: relationships,
      count: relationships.length
    });
  } catch (error) {
    console.error('Error fetching club-player relationships:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch club-player relationships' },
      { status: 500 }
    );
  }
}

// POST /api/club-players - Add player to club
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const newRelationship = await db.insert(clubPlayers).values({
      club_id: body.club_id,
      player_uid: body.player_uid,
      role: body.role || 'member',
      status: body.status || 'unknown',
    }).returning();
    
    return NextResponse.json({
      success: true,
      data: newRelationship[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating club-player relationship:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create club-player relationship' },
      { status: 500 }
    );
  }
}

// DELETE /api/club-players - Remove player from club
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId');
    const playerUid = searchParams.get('playerUid');
    
    if (!clubId || !playerUid) {
      return NextResponse.json(
        { success: false, error: 'Both clubId and playerUid are required' },
        { status: 400 }
      );
    }
    
    await db
      .delete(clubPlayers)
      .where(
        and(
          eq(clubPlayers.club_id, clubId),
          eq(clubPlayers.player_uid, playerUid)
        )
      );
    
    return NextResponse.json({
      success: true,
      message: 'Player removed from club successfully'
    });
  } catch (error) {
    console.error('Error removing club-player relationship:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove club-player relationship' },
      { status: 500 }
    );
  }
}
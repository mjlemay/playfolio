import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { players, clubPlayers, squadPlayers, clubs, squads } from '@/lib/schema';

// GET /api/players/[uid] - Get a specific player with memberships
export async function GET(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const { uid } = params;
    
    const player = await db.select().from(players).where(eq(players.uid, uid)).limit(1);
    
    if (player.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // Get club memberships
    const clubMemberships = await db
      .select({
        club: clubs,
        role: clubPlayers.role,
        joined_date: clubPlayers.joined_date,
        status: clubPlayers.status,
      })
      .from(clubPlayers)
      .innerJoin(clubs, eq(clubs.uid, clubPlayers.club_id))
      .where(eq(clubPlayers.player_uid, uid));

    // Get squad memberships
    const squadMemberships = await db
      .select({
        squad: squads,
        position: squadPlayers.position,
        jersey_number: squadPlayers.jersey_number,
        joined_date: squadPlayers.joined_date,
        status: squadPlayers.status,
      })
      .from(squadPlayers)
      .innerJoin(squads, eq(squads.uid, squadPlayers.squad_id))
      .where(eq(squadPlayers.player_uid, uid));
    
    return NextResponse.json({
      success: true,
      data: {
        ...player[0],
        clubMemberships: clubMemberships,
        squadMemberships: squadMemberships
      }
    });
  } catch (error) {
    console.error('Error fetching player:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch player' },
      { status: 500 }
    );
  }
}

// PUT /api/players/[uid] - Update a specific player
export async function PUT(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const { uid } = params;
    const body = await request.json();
    
    // TODO: Add validation using Zod
    // const validatedData = playerUpdateSchema.parse(body);
    
    const updatedPlayer = await db
      .update(players)
      .set({ 
        meta: body.meta,
        status: body.status,
        pin: body.pin,
        updated_at: new Date()
      })
      .where(eq(players.uid, uid))
      .returning();

    if (updatedPlayer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: updatedPlayer[0]
    });
  } catch (error) {
    console.error('Error updating player:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update player' },
      { status: 500 }
    );
  }
}

// DELETE /api/players/[uid] - Delete a specific player
export async function DELETE(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const { uid } = params;
    
    // First, remove all memberships
    await db.delete(clubPlayers).where(eq(clubPlayers.player_uid, uid));
    await db.delete(squadPlayers).where(eq(squadPlayers.player_uid, uid));
    
    // Then delete the player
    const deletedPlayer = await db.delete(players).where(eq(players.uid, uid)).returning();

    if (deletedPlayer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Player deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting player:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete player' },
      { status: 500 }
    );
  }
}
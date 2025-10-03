import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { squads, squadPlayers, players } from '@/lib/schema';

// GET /api/squads/[uid] - Get a specific squad with its members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    
    const squad = await db.select().from(squads).where(eq(squads.uid, uid)).limit(1);
    
    if (squad.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Squad not found' },
        { status: 404 }
      );
    }

    // Get squad members
    const members = await db
      .select({
        player: players,
        position: squadPlayers.position,
        jersey_number: squadPlayers.jersey_number,
        joined_date: squadPlayers.joined_date,
        status: squadPlayers.status,
      })
      .from(squadPlayers)
      .innerJoin(players, eq(players.uid, squadPlayers.player_uid))
      .where(eq(squadPlayers.squad_id, uid));
    
    return NextResponse.json({
      success: true,
      data: {
        ...squad[0],
        members: members
      }
    });
  } catch (error) {
    console.error('Error fetching squad:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch squad' },
      { status: 500 }
    );
  }
}

// PUT /api/squads/[uid] - Update a specific squad
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const body = await request.json();
    
    // TODO: Add validation using Zod
    // const validatedData = squadUpdateSchema.parse(body);
    
    const updatedSquad = await db
      .update(squads)
      .set({ 
        status: body.status,
        meta: body.meta,
        updated_at: new Date()
      })
      .where(eq(squads.uid, uid))
      .returning();

    if (updatedSquad.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Squad not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: updatedSquad[0]
    });
  } catch (error) {
    console.error('Error updating squad:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update squad' },
      { status: 500 }
    );
  }
}

// DELETE /api/squads/[uid] - Delete a specific squad
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    
    // First, remove all squad memberships
    await db.delete(squadPlayers).where(eq(squadPlayers.squad_id, uid));
    
    // Then delete the squad
    const deletedSquad = await db.delete(squads).where(eq(squads.uid, uid)).returning();

    if (deletedSquad.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Squad not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Squad deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting squad:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete squad' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import db from '@/lib/db';
import { squadPlayers } from '@/lib/schema';

// PUT /api/squads/[squadId]/members/[playerUid] - Update a squad membership
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string; playerUid: string }> }
) {
  try {
    const { uid: squadId, playerUid } = await params;
    const body = await request.json();
    
    const updatedMembership = await db
      .update(squadPlayers)
      .set({
        position: body.position,
        jersey_number: body.jersey_number,
        status: body.status,
      })
      .where(and(
        eq(squadPlayers.squad_id, squadId),
        eq(squadPlayers.player_uid, playerUid)
      ))
      .returning();

    if (updatedMembership.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Squad membership not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: updatedMembership[0]
    });
  } catch (error) {
    console.error('Error updating squad membership:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update squad membership' },
      { status: 500 }
    );
  }
}

// DELETE /api/squads/[squadId]/members/[playerUid] - Remove a player from the squad
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string; playerUid: string }> }
) {
  try {
    const { uid: squadId, playerUid } = await params;
    
    const deletedMembership = await db
      .delete(squadPlayers)
      .where(and(
        eq(squadPlayers.squad_id, squadId),
        eq(squadPlayers.player_uid, playerUid)
      ))
      .returning();

    if (deletedMembership.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Squad membership not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Player removed from squad successfully'
    });
  } catch (error) {
    console.error('Error removing squad member:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove squad member' },
      { status: 500 }
    );
  }
}
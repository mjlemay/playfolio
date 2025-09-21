import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import db from '@/lib/db';
import { clubPlayers } from '@/lib/schema';

// PUT /api/clubs/[clubId]/members/[playerUid] - Update a club membership
export async function PUT(
  request: NextRequest,
  { params }: { params: { uid: string; playerUid: string } }
) {
  try {
    const clubId = params.uid; // Club uid is now a string
    const { playerUid } = params;
    const body = await request.json();
    
    const updatedMembership = await db
      .update(clubPlayers)
      .set({
        role: body.role,
        status: body.status,
      })
      .where(and(
        eq(clubPlayers.club_id, clubId),
        eq(clubPlayers.player_uid, playerUid)
      ))
      .returning();

    if (updatedMembership.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club membership not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: updatedMembership[0]
    });
  } catch (error) {
    console.error('Error updating club membership:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update club membership' },
      { status: 500 }
    );
  }
}

// DELETE /api/clubs/[clubId]/members/[playerUid] - Remove a player from the club
export async function DELETE(
  request: NextRequest,
  { params }: { params: { uid: string; playerUid: string } }
) {
  try {
    const clubId = params.uid; // Club uid is now a string
    const { playerUid } = params;
    
    const deletedMembership = await db
      .delete(clubPlayers)
      .where(and(
        eq(clubPlayers.club_id, clubId),
        eq(clubPlayers.player_uid, playerUid)
      ))
      .returning();

    if (deletedMembership.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club membership not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Player removed from club successfully'
    });
  } catch (error) {
    console.error('Error removing club member:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove club member' },
      { status: 500 }
    );
  }
}
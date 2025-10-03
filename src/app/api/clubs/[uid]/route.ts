import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { clubs, clubPlayers, players } from '@/lib/schema';

// GET /api/clubs/[uid] - Get a specific club with its members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params; // Club uid is now a string
    
    const club = await db.select().from(clubs).where(eq(clubs.uid, uid)).limit(1);
    
    if (club.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      );
    }

    // Get club members
    const members = await db
      .select({
        player: players,
        role: clubPlayers.role,
        joined_date: clubPlayers.joined_date,
        status: clubPlayers.status,
      })
      .from(clubPlayers)
      .innerJoin(players, eq(players.uid, clubPlayers.player_uid))
      .where(eq(clubPlayers.club_id, uid));
    
    return NextResponse.json({
      success: true,
      data: {
        ...club[0],
        members: members
      }
    });
  } catch (error) {
    console.error('Error fetching club:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch club' },
      { status: 500 }
    );
  }
}

// PUT /api/clubs/[uid] - Update a specific club
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params; // Club uid is now a string
    const body = await request.json();
    
    // TODO: Add validation using Zod
    // const validatedData = clubUpdateSchema.parse(body);
    
    const updatedClub = await db
      .update(clubs)
      .set({ 
        displayName: body.displayName,
        safeName: body.safeName,
        meta: body.meta,
        status: body.status,
        updated_at: new Date()
      })
      .where(eq(clubs.uid, uid))
      .returning();

    if (updatedClub.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: updatedClub[0]
    });
  } catch (error) {
    console.error('Error updating club:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update club' },
      { status: 500 }
    );
  }
}

// DELETE /api/clubs/[uid] - Delete a specific club
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params; // Club uid is now a string
    
    // First, remove all club memberships
    await db.delete(clubPlayers).where(eq(clubPlayers.club_id, uid));
    
    // Then delete the club
    const deletedClub = await db.delete(clubs).where(eq(clubs.uid, uid)).returning();

    if (deletedClub.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Club deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting club:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete club' },
      { status: 500 }
    );
  }
}
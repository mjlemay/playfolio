import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { squadPlayers, players } from '@/lib/schema';

// GET /api/squads/[uid]/members - Get all members of a squad
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid: squadId } = await params;
    
    const members = await db
      .select({
        player: players,
        joined_date: squadPlayers.joined_date,
        status: squadPlayers.status,
      })
      .from(squadPlayers)
      .innerJoin(players, eq(players.uid, squadPlayers.player_uid))
      .where(eq(squadPlayers.squad_id, squadId));
    
    return NextResponse.json({
      success: true,
      data: members,
      count: members.length
    });
  } catch (error) {
    console.error('Error fetching squad members:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch squad members' },
      { status: 500 }
    );
  }
}

// POST /api/squads/[uid]/members - Add a player to the squad
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid: squadId } = await params;
    const body = await request.json();
    
    // TODO: Add validation using Zod
    // const validatedData = squadMembershipSchema.parse(body);
    
    const newMembership = await db.insert(squadPlayers).values({
      squad_id: squadId,
      player_uid: body.player_uid,
      position: body.position || null,
      jersey_number: body.jersey_number || null,
      status: body.status || 'unknown',
    }).returning();
    
    return NextResponse.json({
      success: true,
      data: newMembership[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding squad member:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add squad member' },
      { status: 500 }
    );
  }
}
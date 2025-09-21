import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { clubPlayers, players } from '@/lib/schema';

// GET /api/clubs/[uid]/members - Get all members of a club
export async function GET(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const clubId = params.uid;
    
    const members = await db
      .select({
        player: players,
        role: clubPlayers.role,
        joined_date: clubPlayers.joined_date,
        status: clubPlayers.status,
      })
      .from(clubPlayers)
      .innerJoin(players, eq(players.uid, clubPlayers.player_uid))
      .where(eq(clubPlayers.club_id, clubId));
    
    return NextResponse.json({
      success: true,
      data: members,
      count: members.length
    });
  } catch (error) {
    console.error('Error fetching club members:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch club members' },
      { status: 500 }
    );
  }
}

// POST /api/clubs/[uid]/members - Add a player to the club
export async function POST(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const clubId = params.uid;
    const body = await request.json();
    
    // TODO: Add validation using Zod
    // const validatedData = clubMembershipSchema.parse(body);
    
    const newMembership = await db.insert(clubPlayers).values({
      club_id: clubId,
      player_uid: body.player_uid,
      role: body.role || 'member',
      status: body.status || 'unknown',
    }).returning();
    
    return NextResponse.json({
      success: true,
      data: newMembership[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding club member:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add club member' },
      { status: 500 }
    );
  }
}
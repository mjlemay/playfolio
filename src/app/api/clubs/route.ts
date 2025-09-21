import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { clubs, clubPlayers, players } from '@/lib/schema';
import { randomUUID } from 'crypto';

// GET /api/clubs - List all clubs (optionally with players)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeMembers = searchParams.get('includeMembers') === 'true';
    
    if (includeMembers) {
      // Get clubs with their members using a join
      const clubsWithMembers = await db
        .select({
          club_uid: clubs.uid,
          club_prefix: clubs.prefix,
          club_meta: clubs.meta,
          club_status: clubs.status,
          club_created_at: clubs.created_at,
          club_updated_at: clubs.updated_at,
          player_uid: clubPlayers.player_uid,
          player_joined_date: clubPlayers.joined_date,
          player_role: clubPlayers.role,
          player_status: clubPlayers.status,
          player_meta: players.meta,
          player_pin: players.pin,
          player_created_at: players.created_at,
          player_updated_at: players.updated_at,
        })
        .from(clubs)
        .leftJoin(clubPlayers, eq(clubs.uid, clubPlayers.club_id))
        .leftJoin(players, eq(clubPlayers.player_uid, players.uid));
      
      // Group the results by club
      const clubsMap = new Map();
      clubsWithMembers.forEach(row => {
        if (!clubsMap.has(row.club_uid)) {
          clubsMap.set(row.club_uid, {
            uid: row.club_uid,
            prefix: row.club_prefix,
            meta: row.club_meta,
            status: row.club_status,
            created_at: row.club_created_at,
            updated_at: row.club_updated_at,
            members: []
          });
        }
        
        if (row.player_uid) {
          clubsMap.get(row.club_uid).members.push({
            player_uid: row.player_uid,
            joined_date: row.player_joined_date,
            role: row.player_role,
            status: row.player_status,
            player: {
              uid: row.player_uid,
              meta: row.player_meta,
              status: row.player_status,
              pin: row.player_pin,
              created_at: row.player_created_at,
              updated_at: row.player_updated_at,
            }
          });
        }
      });
      
      const result = Array.from(clubsMap.values());
      return NextResponse.json({
        success: true,
        data: result,
        count: result.length
      });
    } else {
      // Get clubs without members
      const allClubs = await db.select().from(clubs);
      
      return NextResponse.json({
        success: true,
        data: allClubs,
        count: allClubs.length
      });
    }
  } catch (error) {
    console.error('Error fetching clubs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch clubs' },
      { status: 500 }
    );
  }
}

// POST /api/clubs - Create a new club
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: Add validation using Zod
    // const validatedData = clubSchema.parse(body);
    
    const newClub = await db.insert(clubs).values({
      uid: randomUUID(),
      prefix: body.prefix,
      meta: body.meta || null,
      status: body.status || null,
    }).returning();
    
    return NextResponse.json({
      success: true,
      data: newClub[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating club:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create club' },
      { status: 500 }
    );
  }
}
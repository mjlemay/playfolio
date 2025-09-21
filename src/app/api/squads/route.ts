import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { squads, squadPlayers, players } from '@/lib/schema';
import { randomUUID } from 'crypto';

// GET /api/squads - List all squads (optionally with players)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeMembers = searchParams.get('includeMembers') === 'true';
    
    if (includeMembers) {
      // Get squads with their members using a join
      const squadsWithMembers = await db
        .select({
          squad_uid: squads.uid,
          squad_status: squads.status,
          squad_meta: squads.meta,
          squad_created_at: squads.created_at,
          squad_updated_at: squads.updated_at,
          player_uid: squadPlayers.player_uid,
          player_joined_date: squadPlayers.joined_date,
          player_position: squadPlayers.position,
          player_jersey_number: squadPlayers.jersey_number,
          player_status: squadPlayers.status,
          player_meta: players.meta,
          player_pin: players.pin,
          player_created_at: players.created_at,
          player_updated_at: players.updated_at,
        })
        .from(squads)
        .leftJoin(squadPlayers, eq(squads.uid, squadPlayers.squad_id))
        .leftJoin(players, eq(squadPlayers.player_uid, players.uid));
      
      // Group the results by squad
      const squadsMap = new Map();
      squadsWithMembers.forEach(row => {
        if (!squadsMap.has(row.squad_uid)) {
          squadsMap.set(row.squad_uid, {
            uid: row.squad_uid,
            status: row.squad_status,
            meta: row.squad_meta,
            created_at: row.squad_created_at,
            updated_at: row.squad_updated_at,
            members: []
          });
        }
        
        if (row.player_uid) {
          squadsMap.get(row.squad_uid).members.push({
            player_uid: row.player_uid,
            joined_date: row.player_joined_date,
            position: row.player_position,
            jersey_number: row.player_jersey_number,
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
      
      const result = Array.from(squadsMap.values());
      return NextResponse.json({
        success: true,
        data: result,
        count: result.length
      });
    } else {
      // Get squads without members
      const allSquads = await db.select().from(squads);
      
      return NextResponse.json({
        success: true,
        data: allSquads,
        count: allSquads.length
      });
    }
  } catch (error) {
    console.error('Error fetching squads:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch squads' },
      { status: 500 }
    );
  }
}

// POST /api/squads - Create a new squad
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: Add validation using Zod
    // const validatedData = squadSchema.parse(body);
    
    const newSquad = await db.insert(squads).values({
      uid: randomUUID(),
      status: body.status || null,
      meta: body.meta || null,
    }).returning();
    
    return NextResponse.json({
      success: true,
      data: newSquad[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating squad:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create squad' },
      { status: 500 }
    );
  }
}
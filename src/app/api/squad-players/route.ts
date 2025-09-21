import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import db from '@/lib/db';
import { squadPlayers, squads, players } from '@/lib/schema';

// GET /api/squad-players - List squad-player relationships
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const squadId = searchParams.get('squadId');
    const playerUid = searchParams.get('playerUid');
    
    const baseQuery = db
      .select({
        squad_id: squadPlayers.squad_id,
        player_uid: squadPlayers.player_uid,
        joined_date: squadPlayers.joined_date,
        status: squadPlayers.status,
        squad: squads,
        player: players,
      })
      .from(squadPlayers)
      .leftJoin(squads, eq(squadPlayers.squad_id, squads.uid))
      .leftJoin(players, eq(squadPlayers.player_uid, players.uid));
    
    let relationships;
    
    if (squadId && playerUid) {
      relationships = await baseQuery.where(
        and(
          eq(squadPlayers.squad_id, squadId),
          eq(squadPlayers.player_uid, playerUid)
        )
      );
    } else if (squadId) {
      relationships = await baseQuery.where(eq(squadPlayers.squad_id, squadId));
    } else if (playerUid) {
      relationships = await baseQuery.where(eq(squadPlayers.player_uid, playerUid));
    } else {
      relationships = await baseQuery;
    }
    
    return NextResponse.json({
      success: true,
      data: relationships,
      count: relationships.length
    });
  } catch (error) {
    console.error('Error fetching squad-player relationships:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch squad-player relationships' },
      { status: 500 }
    );
  }
}

// POST /api/squad-players - Add player to squad
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const newRelationship = await db.insert(squadPlayers).values({
      squad_id: body.squad_id,
      player_uid: body.player_uid,
      status: body.status || 'unknown',
    }).returning();
    
    return NextResponse.json({
      success: true,
      data: newRelationship[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating squad-player relationship:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create squad-player relationship' },
      { status: 500 }
    );
  }
}

// DELETE /api/squad-players - Remove player from squad
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const squadId = searchParams.get('squadId');
    const playerUid = searchParams.get('playerUid');
    
    if (!squadId || !playerUid) {
      return NextResponse.json(
        { success: false, error: 'Both squadId and playerUid are required' },
        { status: 400 }
      );
    }
    
    await db
      .delete(squadPlayers)
      .where(
        and(
          eq(squadPlayers.squad_id, squadId),
          eq(squadPlayers.player_uid, playerUid)
        )
      );
    
    return NextResponse.json({
      success: true,
      message: 'Player removed from squad successfully'
    });
  } catch (error) {
    console.error('Error removing squad-player relationship:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove squad-player relationship' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { players } from '@/lib/schema';
import { randomUUID } from 'crypto';

// GET /api/players - List all players
export async function GET() {
  try {
    const allPlayers = await db.select().from(players);
    
    return NextResponse.json({
      success: true,
      data: allPlayers,
      count: allPlayers.length
    });
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch players' },
      { status: 500 }
    );
  }
}

// POST /api/players - Create a new player
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: Add validation using Zod
    // const validatedData = playerSchema.parse(body);
    
    const newPlayer = await db.insert(players).values({
      uid: randomUUID(),
      meta: body.meta || null,
      status: body.status || null,
      pin: body.pin,
    }).returning();
    
    return NextResponse.json({
      success: true,
      data: newPlayer[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating player:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create player' },
      { status: 500 }
    );
  }
}
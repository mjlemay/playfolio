import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { squads } from '@/lib/schema';

// GET /api/squads - List all squads
export async function GET() {
  try {
    const allSquads = await db.select().from(squads);
    
    return NextResponse.json({
      success: true,
      data: allSquads,
      count: allSquads.length
    });
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
      uid: body.uid || `squad_${Date.now()}`,
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
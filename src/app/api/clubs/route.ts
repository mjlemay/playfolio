import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { clubs, clubPlayers, players } from '@/lib/schema';

// GET /api/clubs - List all clubs
export async function GET() {
  try {
    const allClubs = await db.select().from(clubs);
    
    return NextResponse.json({
      success: true,
      data: allClubs,
      count: allClubs.length
    });
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
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { activities } from '@/lib/schema';

// GET /api/activities - List all activities
export async function GET() {
  try {
    const allActivities = await db.select().from(activities);
    
    return NextResponse.json({
      success: true,
      data: allActivities,
      count: allActivities.length
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

// POST /api/activities - Create a new activity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: Add validation using Zod
    // const validatedData = activitySchema.parse(body);
    
    const newActivity = await db.insert(activities).values({
      uid: body.uid || `activity_${Date.now()}`,
      player_uid: body.player_uid,
      club_id: body.club_id,
      device_id: body.device_id || null,
      meta: body.meta || {},
      format: body.format,
    }).returning();
    
    return NextResponse.json({
      success: true,
      data: newActivity[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}
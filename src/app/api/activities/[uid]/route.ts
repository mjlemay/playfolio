import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { activities, players, clubs, devices } from '@/lib/schema';

// GET /api/activities/[uid] - Get a specific activity with related data
export async function GET(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const { uid } = params;
    
    const activity = await db
      .select({
        activity: activities,
        player: players,
        club: clubs,
        device: devices,
      })
      .from(activities)
      .leftJoin(players, eq(players.uid, activities.player_uid))
      .leftJoin(clubs, eq(clubs.uid, activities.club_id))
      .leftJoin(devices, eq(devices.uid, activities.device_id))
      .where(eq(activities.uid, uid))
      .limit(1);
    
    if (activity.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: activity[0]
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}

// PUT /api/activities/[uid] - Update a specific activity
export async function PUT(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const { uid } = params;
    const body = await request.json();
    
    // TODO: Add validation using Zod
    // const validatedData = activityUpdateSchema.parse(body);
    
    const updatedActivity = await db
      .update(activities)
      .set({
        player_uid: body.player_uid,
        club_id: body.club_id,
        device_id: body.device_id,
        meta: body.meta,
        format: body.format,
      })
      .where(eq(activities.uid, uid))
      .returning();

    if (updatedActivity.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: updatedActivity[0]
    });
  } catch (error) {
    console.error('Error updating activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update activity' },
      { status: 500 }
    );
  }
}

// DELETE /api/activities/[uid] - Delete a specific activity
export async function DELETE(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const { uid } = params;
    
    const deletedActivity = await db.delete(activities).where(eq(activities.uid, uid)).returning();

    if (deletedActivity.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete activity' },
      { status: 500 }
    );
  }
}
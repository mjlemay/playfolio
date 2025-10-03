import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { devices, clubs, activities } from '@/lib/schema';

// GET /api/devices/[uid] - Get a specific device with related data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    
    const device = await db
      .select({
        device: devices,
        club: clubs,
      })
      .from(devices)
      .leftJoin(clubs, eq(clubs.uid, devices.club_id))
      .where(eq(devices.uid, uid))
      .limit(1);
    
    if (device.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      );
    }

    // Get recent activities for this device
    const recentActivities = await db
      .select()
      .from(activities)
      .where(eq(activities.device_id, uid))
      .limit(10);
    
    return NextResponse.json({
      success: true,
      data: {
        ...device[0],
        recentActivities: recentActivities
      }
    });
  } catch (error) {
    console.error('Error fetching device:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch device' },
      { status: 500 }
    );
  }
}

// PUT /api/devices/[uid] - Update a specific device
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const body = await request.json();
    
    // TODO: Add validation using Zod
    // const validatedData = deviceUpdateSchema.parse(body);
    
    const updatedDevice = await db
      .update(devices)
      .set({ 
        name: body.name,
        club_id: body.club_id,
        updated_at: new Date()
      })
      .where(eq(devices.uid, uid))
      .returning();

    if (updatedDevice.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: updatedDevice[0]
    });
  } catch (error) {
    console.error('Error updating device:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update device' },
      { status: 500 }
    );
  }
}

// DELETE /api/devices/[uid] - Delete a specific device
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    
    const deletedDevice = await db.delete(devices).where(eq(devices.uid, uid)).returning();

    if (deletedDevice.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete device' },
      { status: 500 }
    );
  }
}
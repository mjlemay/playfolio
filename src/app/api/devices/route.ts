import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { devices } from '@/lib/schema';

// GET /api/devices - List all devices
export async function GET() {
  try {
    const allDevices = await db.select().from(devices);
    
    return NextResponse.json({
      success: true,
      data: allDevices,
      count: allDevices.length
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}

// POST /api/devices - Create a new device
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: Add validation using Zod
    // const validatedData = deviceSchema.parse(body);
    
    const newDevice = await db.insert(devices).values({
      uid: body.uid || `device_${Date.now()}`,
      name: body.name,
      club_id: body.club_id,
    }).returning();
    
    return NextResponse.json({
      success: true,
      data: newDevice[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating device:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create device' },
      { status: 500 }
    );
  }
}
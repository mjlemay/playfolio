import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
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
    // Check if request has body
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { success: false, error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    let body;
    try {
      const text = await request.text();
      if (!text.trim()) {
        return NextResponse.json(
          { success: false, error: 'Request body is required for devices' },
          { status: 400 }
        );
      }
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      );
    }

    if (!body.club_id) {
      return NextResponse.json(
        { success: false, error: 'club_id is required' },
        { status: 400 }
      );
    }

    console.log('Creating device with data:', {
      uid: body.uid || randomUUID(),
      name: body.name,
      club_id: body.club_id,
    });

    const newDevice = await db.insert(devices).values({
      uid: body.uid || randomUUID(),
      name: body.name,
      club_id: body.club_id,
    }).returning();
    
    console.log('Device created successfully:', newDevice[0]);

    return NextResponse.json({
      success: true,
      data: newDevice[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating device:', error);
    return NextResponse.json(
      { success: false, error: `Failed to create device: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
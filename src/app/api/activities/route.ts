import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { activities } from '@/lib/schema';
import { resolvePlayerFromKey } from '@/lib/keychain';

// GET /api/activities - List all activities
// Query parameters:
//   - club_id: Filter by club ID
//   - device_id: Filter by device ID
//   - player_uid: Filter by player UID
//   - format: Filter by activity format
//   - start_date: Filter activities after this date (ISO timestamp)
//   - end_date: Filter activities before this date (ISO timestamp)
//   - limit: Limit number of results (default: 100)
//   - offset: Offset for pagination (default: 0)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('club_id');
    const deviceId = searchParams.get('device_id');
    const playerUid = searchParams.get('player_uid');
    const format = searchParams.get('format');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query with filters
    let query = db.select().from(activities);

    // Note: This is a simple implementation. For production, you should use
    // Drizzle's query builder with proper where conditions
    // For now, we'll return all and filter in memory (not ideal for large datasets)
    const allActivities = await query;

    // Apply filters
    let filtered = allActivities;

    if (clubId) {
      filtered = filtered.filter(a => a.club_id === clubId);
    }

    if (deviceId) {
      filtered = filtered.filter(a => a.device_id === deviceId);
    }

    if (playerUid) {
      filtered = filtered.filter(a => a.player_uid === playerUid);
    }

    if (format) {
      filtered = filtered.filter(a => a.format === format);
    }

    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(a => new Date(a.created_at) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      filtered = filtered.filter(a => new Date(a.created_at) <= end);
    }

    // Apply pagination
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: paginated,
      count: paginated.length,
      total: filtered.length
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
//
// Expected request body:
// {
//   player_uid?: string,  // Direct player UID (optional if key is provided)
//   key?: string,         // RFID/QR code for player resolution (optional if player_uid provided)
//   originating_club_id?: string,  // Required with key
//   club_id?: string,     // Club ID for the activity
//   device_id?: string,   // Device ID (for kiosk activities)
//   format?: string,      // Activity format: 'kiosk_login', 'login', 'attendance', 'custom'
//   meta?: object,        // Activity metadata
// }
//
// For kiosk_login format, meta should contain:
// {
//   login_trigger: 'rfid' | 'qr' | 'manual',
//   kiosk_snowflake: string,
//   kiosk_player_name: string,
//   synced_at: string (ISO timestamp),
//   kiosk_activity_uid: string
// }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO: Add validation using Zod
    // const validatedData = activitySchema.parse(body);

    // Validate format if provided
    const validFormats = ['kiosk_login', 'login', 'attendance', 'custom'];
    if (body.format && !validFormats.includes(body.format)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid format. Must be one of: ${validFormats.join(', ')}`
        },
        { status: 400 }
      );
    }

    let playerUid = body.player_uid;

    // If key and originating_club_id provided, resolve player_uid
    if (body.key && body.originating_club_id) {
      const resolution = await resolvePlayerFromKey(
        body.key,
        body.originating_club_id
      );

      if (!resolution.success) {
        return NextResponse.json(
          { success: false, error: resolution.error },
          { status: 400 }
        );
      }

      playerUid = resolution.player_uid;
    }

    // Validate we have player_uid (either direct or resolved)
    if (!playerUid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either player_uid or (key + originating_club_id) required',
        },
        { status: 400 }
      );
    }

    const newActivity = await db.insert(activities).values({
      uid: body.uid || `activity_${Date.now()}`,
      player_uid: playerUid,
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
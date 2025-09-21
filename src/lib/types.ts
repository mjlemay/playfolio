export type AttendanceStatus = 'present' | 'absent' | 'banned' | 'unknown' | 'inactive';

export type Player = {
    uid: string,
    meta: Record<string,string> | null,
    status: AttendanceStatus | null,
    created_at: string,
    updated_at: string | null,
    pin: number,
}

export type Activity = {
    uid: string,
    player_uid: string,
    club_id: string,
    device_id?: string,
    meta: Record<string,string>,
    format:string,
    created_at: string,
}

export type Club = {
    uid: string,
    prefix: string,
    meta: Record<string,string> | null,
    status: AttendanceStatus | null,
    created_at: string,
    updated_at: string | null,
}

export type Device = {
    uid: string,
    name: string,
    club_id: string,
    created_at: string,
    updated_at: string | null,
}

export type Squad = {
    uid: string,
    status: AttendanceStatus | null,
    meta: Record<string,string> | null,
    created_at: string,
    updated_at: string | null,
}

export type ClubPlayer = {
    club_id: string,
    player_uid: string,
    joined_date: string,
    role: string,
    status: AttendanceStatus,
}

export type SquadPlayer = {
    squad_id: string,
    player_uid: string,
    joined_date: string,
    position: string | null,
    jersey_number: number | null,
    status: AttendanceStatus,
}
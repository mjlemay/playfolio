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
    uid: number,
    prefix: string,
    meta: Record<string,string> | null,
    status: AttendanceStatus | null,
    players: string[] | null,
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
    players: string[] | null,
    meta: Record<string,string> | null,
    created_at: string,
    updated_at: string | null,
}
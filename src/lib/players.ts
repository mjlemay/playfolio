import { eq } from 'drizzle-orm';
import db from './db';
import { clubPlayers, squadPlayers, clubs, squads } from './schema';

/** Club and squad memberships for a player, in the shape /api/players/[uid] returns. */
export async function getPlayerMemberships(uid: string) {
  const clubMemberships = await db
    .select({
      club: clubs,
      role: clubPlayers.role,
      joined_date: clubPlayers.joined_date,
      status: clubPlayers.status,
    })
    .from(clubPlayers)
    .innerJoin(clubs, eq(clubs.uid, clubPlayers.club_id))
    .where(eq(clubPlayers.player_uid, uid));

  const squadMemberships = await db
    .select({
      squad: squads,
      position: squadPlayers.position,
      jersey_number: squadPlayers.jersey_number,
      joined_date: squadPlayers.joined_date,
      status: squadPlayers.status,
    })
    .from(squadPlayers)
    .innerJoin(squads, eq(squads.uid, squadPlayers.squad_id))
    .where(eq(squadPlayers.player_uid, uid));

  return { clubMemberships, squadMemberships };
}

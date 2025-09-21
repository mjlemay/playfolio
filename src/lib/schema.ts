import { pgTable, text, integer, timestamp, json, serial, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum for attendance status
export const attendanceStatusEnum = ['present', 'absent', 'banned', 'unknown', 'inactive'] as const;

// Players table
export const players = pgTable('players', {
  uid: text('uid').primaryKey(),
  meta: json('meta').$type<Record<string, string> | null>(),
  status: text('status').$type<typeof attendanceStatusEnum[number] | null>(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
  pin: integer('pin').notNull(),
});

// Clubs table (removed players array)
export const clubs = pgTable('clubs', {
  uid: serial('uid').primaryKey(),
  prefix: text('prefix').notNull(),
  meta: json('meta').$type<Record<string, string> | null>(),
  status: text('status').$type<typeof attendanceStatusEnum[number] | null>(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
});

// Devices table
export const devices = pgTable('devices', {
  uid: text('uid').primaryKey(),
  name: text('name').notNull(),
  club_id: text('club_id').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
});

// Activities table
export const activities = pgTable('activities', {
  uid: text('uid').primaryKey(),
  player_uid: text('player_uid').notNull(),
  club_id: text('club_id').notNull(),
  device_id: text('device_id'),
  meta: json('meta').$type<Record<string, string>>().notNull(),
  format: text('format').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Squads table (removed players array)
export const squads = pgTable('squads', {
  uid: text('uid').primaryKey(),
  status: text('status').$type<typeof attendanceStatusEnum[number] | null>(),
  meta: json('meta').$type<Record<string, string> | null>(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
});

// Junction table for club-player relationships
export const clubPlayers = pgTable('club_players', {
  club_id: integer('club_id').notNull().references(() => clubs.uid),
  player_uid: text('player_uid').notNull().references(() => players.uid),
  joined_date: timestamp('joined_date', { withTimezone: true }).notNull().defaultNow(),
  role: text('role').notNull().default('member'), // member, captain, coach, etc.
  status: text('status').$type<typeof attendanceStatusEnum[number]>().notNull().default('unknown'),
}, (table) => ({
  pk: primaryKey({ columns: [table.club_id, table.player_uid] }),
}));

// Junction table for squad-player relationships
export const squadPlayers = pgTable('squad_players', {
  squad_id: text('squad_id').notNull().references(() => squads.uid),
  player_uid: text('player_uid').notNull().references(() => players.uid),
  joined_date: timestamp('joined_date', { withTimezone: true }).notNull().defaultNow(),
  position: text('position'), // forward, midfielder, defender, goalkeeper, etc.
  jersey_number: integer('jersey_number'),
  status: text('status').$type<typeof attendanceStatusEnum[number]>().notNull().default('unknown'),
}, (table) => ({
  pk: primaryKey({ columns: [table.squad_id, table.player_uid] }),
}));

// Relations
export const playersRelations = relations(players, ({ many }) => ({
  activities: many(activities),
  clubMemberships: many(clubPlayers),
  squadMemberships: many(squadPlayers),
}));

export const clubsRelations = relations(clubs, ({ many }) => ({
  devices: many(devices),
  activities: many(activities),
  members: many(clubPlayers),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  club: one(clubs, {
    fields: [devices.club_id],
    references: [clubs.uid],
  }),
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  player: one(players, {
    fields: [activities.player_uid],
    references: [players.uid],
  }),
  club: one(clubs, {
    fields: [activities.club_id],
    references: [clubs.uid],
  }),
  device: one(devices, {
    fields: [activities.device_id],
    references: [devices.uid],
  }),
}));

export const squadsRelations = relations(squads, ({ many }) => ({
  members: many(squadPlayers),
}));

export const clubPlayersRelations = relations(clubPlayers, ({ one }) => ({
  club: one(clubs, {
    fields: [clubPlayers.club_id],
    references: [clubs.uid],
  }),
  player: one(players, {
    fields: [clubPlayers.player_uid],
    references: [players.uid],
  }),
}));

export const squadPlayersRelations = relations(squadPlayers, ({ one }) => ({
  squad: one(squads, {
    fields: [squadPlayers.squad_id],
    references: [squads.uid],
  }),
  player: one(players, {
    fields: [squadPlayers.player_uid],
    references: [players.uid],
  }),
}));

// Types inferred from schema
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type Club = typeof clubs.$inferSelect;
export type NewClub = typeof clubs.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type Squad = typeof squads.$inferSelect;
export type NewSquad = typeof squads.$inferInsert;
export type ClubPlayer = typeof clubPlayers.$inferSelect;
export type NewClubPlayer = typeof clubPlayers.$inferInsert;
export type SquadPlayer = typeof squadPlayers.$inferSelect;
export type NewSquadPlayer = typeof squadPlayers.$inferInsert;

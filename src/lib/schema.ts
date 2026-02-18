import { pgTable, text, integer, timestamp, json, primaryKey } from 'drizzle-orm/pg-core';
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
});

// Clubs table (removed players array)
export const clubs = pgTable('clubs', {
  uid: text('uid').primaryKey(),
  displayName: text('displayName').notNull(),
  safeName: text('safeName').notNull(),
  meta: json('meta').$type<Record<string, string> | null>(),
  status: text('status').$type<typeof attendanceStatusEnum[number] | null>(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
});

// Keychains table - a shared identity bundle linking multiple player accounts (devices)
export const keychains = pgTable('keychains', {
  uid: text('uid').primaryKey(),
  auth_code: text('auth_code').notNull().unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
});

// Junction table linking player accounts to a keychain (a player is in at most one keychain)
export const keychainPlayers = pgTable('keychain_players', {
  keychain_id: text('keychain_id').notNull().references(() => keychains.uid, { onDelete: 'cascade' }),
  player_uid: text('player_uid').notNull().references(() => players.uid, { onDelete: 'cascade' }).unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.keychain_id, table.player_uid] }),
}));

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

// Club keys table for cross-club player sharing
export const clubKeys = pgTable('club_keys', {
  key: text('key').primaryKey(),
  keychain_id: text('keychain_id').notNull().references(() => keychains.uid, { onDelete: 'cascade' }),
  originating_club_id: text('originating_club_id').notNull().references(() => clubs.uid, { onDelete: 'cascade' }),
  status: text('status').notNull().default('active'), // 'active' | 'revoked' | 'expired'
  meta: json('meta').$type<Record<string, string> | null>(),
  expires_at: timestamp('expires_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revoked_at: timestamp('revoked_at', { withTimezone: true }),
  last_used_at: timestamp('last_used_at', { withTimezone: true }),
  usage_count: integer('usage_count').notNull().default(0),
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
  club_id: text('club_id').notNull().references(() => clubs.uid),
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
  keychainMemberships: many(keychainPlayers),
}));

export const keychainsRelations = relations(keychains, ({ many }) => ({
  players: many(keychainPlayers),
  keys: many(clubKeys),
}));

export const keychainPlayersRelations = relations(keychainPlayers, ({ one }) => ({
  keychain: one(keychains, {
    fields: [keychainPlayers.keychain_id],
    references: [keychains.uid],
  }),
  player: one(players, {
    fields: [keychainPlayers.player_uid],
    references: [players.uid],
  }),
}));

export const clubsRelations = relations(clubs, ({ many }) => ({
  devices: many(devices),
  activities: many(activities),
  members: many(clubPlayers),
  keysCreated: many(clubKeys),
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

export const clubKeysRelations = relations(clubKeys, ({ one }) => ({
  keychain: one(keychains, {
    fields: [clubKeys.keychain_id],
    references: [keychains.uid],
  }),
  originatingClub: one(clubs, {
    fields: [clubKeys.originating_club_id],
    references: [clubs.uid],
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
export type Keychain = typeof keychains.$inferSelect;
export type NewKeychain = typeof keychains.$inferInsert;
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
export type ClubKey = typeof clubKeys.$inferSelect;
export type NewClubKey = typeof clubKeys.$inferInsert;
export type KeychainPlayer = typeof keychainPlayers.$inferSelect;
export type NewKeychainPlayer = typeof keychainPlayers.$inferInsert;

-- Create keychains table (identity bundle, not tied 1:1 to a player)
CREATE TABLE "keychains" (
	"uid" text PRIMARY KEY NOT NULL,
	"auth_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "keychains_auth_code_unique" UNIQUE("auth_code")
);
--> statement-breakpoint

-- Create keychain_players junction table (a player is in at most one keychain)
CREATE TABLE "keychain_players" (
	"keychain_id" text NOT NULL,
	"player_uid" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "keychain_players_player_uid_unique" UNIQUE("player_uid"),
	CONSTRAINT "keychain_players_keychain_id_player_uid_pk" PRIMARY KEY("keychain_id","player_uid")
);
--> statement-breakpoint

-- Add FK constraints for keychain_players
ALTER TABLE "keychain_players" ADD CONSTRAINT "keychain_players_keychain_id_keychains_uid_fk"
	FOREIGN KEY ("keychain_id") REFERENCES "public"."keychains"("uid") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "keychain_players" ADD CONSTRAINT "keychain_players_player_uid_players_uid_fk"
	FOREIGN KEY ("player_uid") REFERENCES "public"."players"("uid") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Migrate club_keys: drop player_uid, add keychain_id
ALTER TABLE "club_keys" DROP CONSTRAINT "club_keys_player_uid_players_uid_fk";
--> statement-breakpoint
ALTER TABLE "club_keys" DROP COLUMN "player_uid";
--> statement-breakpoint
ALTER TABLE "club_keys" ADD COLUMN "keychain_id" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "club_keys" ADD CONSTRAINT "club_keys_keychain_id_keychains_uid_fk"
	FOREIGN KEY ("keychain_id") REFERENCES "public"."keychains"("uid") ON DELETE cascade ON UPDATE no action;

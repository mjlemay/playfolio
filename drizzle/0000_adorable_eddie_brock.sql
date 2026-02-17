CREATE TABLE "activities" (
	"uid" text PRIMARY KEY NOT NULL,
	"player_uid" text NOT NULL,
	"club_id" text NOT NULL,
	"device_id" text,
	"meta" json NOT NULL,
	"format" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"player_uid" text NOT NULL,
	"originating_club_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"meta" json,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"usage_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_players" (
	"club_id" text NOT NULL,
	"player_uid" text NOT NULL,
	"joined_date" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	CONSTRAINT "club_players_club_id_player_uid_pk" PRIMARY KEY("club_id","player_uid")
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"uid" text PRIMARY KEY NOT NULL,
	"displayName" text NOT NULL,
	"safeName" text NOT NULL,
	"meta" json,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"uid" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"club_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "players" (
	"uid" text PRIMARY KEY NOT NULL,
	"meta" json,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"pin" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "squad_players" (
	"squad_id" text NOT NULL,
	"player_uid" text NOT NULL,
	"joined_date" timestamp with time zone DEFAULT now() NOT NULL,
	"position" text,
	"jersey_number" integer,
	"status" text DEFAULT 'unknown' NOT NULL,
	CONSTRAINT "squad_players_squad_id_player_uid_pk" PRIMARY KEY("squad_id","player_uid")
);
--> statement-breakpoint
CREATE TABLE "squads" (
	"uid" text PRIMARY KEY NOT NULL,
	"status" text,
	"meta" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "club_keys" ADD CONSTRAINT "club_keys_player_uid_players_uid_fk" FOREIGN KEY ("player_uid") REFERENCES "public"."players"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_keys" ADD CONSTRAINT "club_keys_originating_club_id_clubs_uid_fk" FOREIGN KEY ("originating_club_id") REFERENCES "public"."clubs"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_players" ADD CONSTRAINT "club_players_club_id_clubs_uid_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_players" ADD CONSTRAINT "club_players_player_uid_players_uid_fk" FOREIGN KEY ("player_uid") REFERENCES "public"."players"("uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_players" ADD CONSTRAINT "squad_players_squad_id_squads_uid_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_players" ADD CONSTRAINT "squad_players_player_uid_players_uid_fk" FOREIGN KEY ("player_uid") REFERENCES "public"."players"("uid") ON DELETE no action ON UPDATE no action;
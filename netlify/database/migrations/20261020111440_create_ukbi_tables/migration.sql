CREATE TABLE "auth_tokens" (
	"token_hash" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exposures" (
	"user_id" text,
	"question_id" text,
	"times_seen" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_correct" boolean,
	CONSTRAINT "exposures_pkey" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY,
	"version" integer NOT NULL,
	"category_code" text NOT NULL,
	"type" text NOT NULL,
	"difficulty" text NOT NULL,
	"stem" text NOT NULL,
	"options" jsonb NOT NULL,
	"answer_key" text,
	"explanation" text NOT NULL,
	"rubric" jsonb,
	"source" text NOT NULL,
	"level" text DEFAULT 'SMA_SMK' NOT NULL,
	"transcript" text,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_items" (
	"session_id" text,
	"position" integer,
	"question_id" text NOT NULL,
	"question_version" integer NOT NULL,
	"type" text NOT NULL,
	"category_code" text NOT NULL,
	"difficulty" text NOT NULL,
	"stem" text NOT NULL,
	"options" jsonb NOT NULL,
	"answer_key" text,
	"explanation" text NOT NULL,
	"rubric" jsonb,
	"transcript" text,
	"response" text,
	"flagged" boolean DEFAULT false NOT NULL,
	CONSTRAINT "session_items_pkey" PRIMARY KEY("session_id","position")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"session_number" integer NOT NULL,
	"title" text NOT NULL,
	"mode" text NOT NULL,
	"category_code" text,
	"difficulty" text,
	"level" text DEFAULT 'SEMUA' NOT NULL,
	"question_count" integer NOT NULL,
	"seed" text NOT NULL,
	"status" text NOT NULL,
	"last_index" integer DEFAULT 0 NOT NULL,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"time_limit_sec" integer,
	"active_since" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"result" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_questions_status" ON "questions" ("status","category_code","difficulty");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_session_items_question" ON "session_items" ("session_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sessions_user_number" ON "sessions" ("user_id","session_number");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "exposures" ADD CONSTRAINT "exposures_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "exposures" ADD CONSTRAINT "exposures_question_id_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id");--> statement-breakpoint
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_session_id_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
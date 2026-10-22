CREATE TABLE "admin_config" (
	"config_key" text PRIMARY KEY NOT NULL,
	"value_json" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"status" text NOT NULL,
	"record_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_meta" (
	"meta_key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_products" (
	"sku" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"record_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"record_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"enabled" integer NOT NULL,
	"category" text NOT NULL,
	"difficulty" text NOT NULL,
	"risk_level" text NOT NULL,
	"created_at" text NOT NULL,
	"record_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_meta" (
	"meta_key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_ab_tests" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"created_at" text NOT NULL,
	"record_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_annotations" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" text NOT NULL,
	"record_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_improvements" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" text NOT NULL,
	"record_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"score" integer NOT NULL,
	"created_at" text NOT NULL,
	"record_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_versions" (
	"skill_id" text NOT NULL,
	"version" integer NOT NULL,
	"snapshot_json" text NOT NULL,
	"change_note" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "skill_versions_skill_id_version_pk" PRIMARY KEY("skill_id","version")
);
--> statement-breakpoint
CREATE INDEX "agent_runs_created_at_idx" ON "agent_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "eval_cases_filter_idx" ON "eval_cases" USING btree ("enabled","category","difficulty","risk_level");--> statement-breakpoint
CREATE INDEX "ops_annotations_run_idx" ON "ops_annotations" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "ops_ratings_run_idx" ON "ops_ratings" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "skill_versions_skill_id_idx" ON "skill_versions" USING btree ("skill_id","version");
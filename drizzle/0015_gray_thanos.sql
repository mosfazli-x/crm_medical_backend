CREATE TABLE "blog_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_fa" varchar(200) NOT NULL,
	"name_en" varchar(200),
	"slug" varchar(200) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "blog_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_name" varchar(200) NOT NULL,
	"author_email" varchar(300) NOT NULL,
	"content" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_blog_comments_status" CHECK ("blog_comments"."status" IN ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_fa" varchar(500) NOT NULL,
	"title_en" varchar(500),
	"slug" varchar(500) NOT NULL,
	"excerpt_fa" text NOT NULL,
	"excerpt_en" text,
	"content_fa" text NOT NULL,
	"content_en" text,
	"cover_image" varchar(1000),
	"category_id" uuid,
	"author_id" uuid NOT NULL,
	"is_published" boolean DEFAULT false,
	"published_at" timestamp,
	"view_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_blog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_blog_categories_slug" ON "blog_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_blog_comments_post" ON "blog_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_blog_comments_status" ON "blog_comments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_blog_posts_slug" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_blog_posts_category" ON "blog_posts" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_blog_posts_author" ON "blog_posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_blog_posts_published" ON "blog_posts" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "idx_blog_posts_created" ON "blog_posts" USING btree ("created_at");
import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("_emdash_promotional_campaign")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("content", "text", (col) => col.notNull())
		.addColumn("media_id", "text")
		.addColumn("button_label", "text")
		.addColumn("button_url", "text")
		.addColumn("page_scope", "text", (col) => col.notNull().defaultTo("all"))
		.addColumn("is_active", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("starts_at", "text")
		.addColumn("ends_at", "text")
		.addColumn("created_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn("updated_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("_emdash_promotional_campaign").ifExists().execute();
}

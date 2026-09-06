import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("_emdash_promotional_campaign")
		.addColumn("modal_size", "text", (col) => col.notNull().defaultTo("rectangle"))
		.execute();
	await db.schema
		.alterTable("_emdash_promotional_campaign")
		.addColumn("modal_width", "integer")
		.execute();
	await db.schema
		.alterTable("_emdash_promotional_campaign")
		.addColumn("modal_height", "integer")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("_emdash_promotional_campaign").dropColumn("modal_height").execute();
	await db.schema.alterTable("_emdash_promotional_campaign").dropColumn("modal_width").execute();
	await db.schema.alterTable("_emdash_promotional_campaign").dropColumn("modal_size").execute();
}

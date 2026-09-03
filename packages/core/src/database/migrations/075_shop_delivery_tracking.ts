import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("_emdash_shop_deliveries")
		.addColumn("tracking_code", "text")
		.execute();
	await db.schema.alterTable("_emdash_shop_deliveries").addColumn("tracking_url", "text").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("_emdash_shop_deliveries").dropColumn("tracking_url").execute();
	await db.schema.alterTable("_emdash_shop_deliveries").dropColumn("tracking_code").execute();
}

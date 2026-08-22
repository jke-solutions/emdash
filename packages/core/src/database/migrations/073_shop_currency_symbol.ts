import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("_emdash_shop_settings")
		.addColumn("currency_symbol", "text", (col) => col.notNull().defaultTo("S/"))
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("_emdash_shop_settings").dropColumn("currency_symbol").execute();
}

import type { Kysely } from "kysely";

import { columnExists } from "../dialect-helpers.js";

export async function up(db: Kysely<unknown>): Promise<void> {
	if (await columnExists(db, "_emdash_shop_settings", "currency_symbol")) return;

	await db.schema
		.alterTable("_emdash_shop_settings")
		.addColumn("currency_symbol", "text", (col) => col.notNull().defaultTo("S/"))
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("_emdash_shop_settings").dropColumn("currency_symbol").execute();
}

import type { Kysely } from "kysely";

import { columnExists } from "../dialect-helpers.js";

export async function up(db: Kysely<unknown>): Promise<void> {
	if (await columnExists(db, "_emdash_shop_settings", "booking_enabled")) return;
	await db.schema
		.alterTable("_emdash_shop_settings")
		.addColumn("booking_enabled", "integer", (col) => col.notNull().defaultTo(0))
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	if (!(await columnExists(db, "_emdash_shop_settings", "booking_enabled"))) return;
	await db.schema.alterTable("_emdash_shop_settings").dropColumn("booking_enabled").execute();
}

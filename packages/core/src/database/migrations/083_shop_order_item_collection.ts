import { type Kysely } from "kysely";

import { columnExists } from "../dialect-helpers.js";

export async function up(db: Kysely<unknown>): Promise<void> {
	if (!(await columnExists(db, "_emdash_shop_order_items", "collection"))) {
		await db.schema
			.alterTable("_emdash_shop_order_items")
			.addColumn("collection", "text", (column) => column.notNull().defaultTo("products"))
			.execute();
	}
}

export async function down(db: Kysely<unknown>): Promise<void> {
	if (await columnExists(db, "_emdash_shop_order_items", "collection")) {
		await db.schema.alterTable("_emdash_shop_order_items").dropColumn("collection").execute();
	}
}

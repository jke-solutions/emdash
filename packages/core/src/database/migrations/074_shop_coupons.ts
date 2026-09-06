import type { Kysely } from "kysely";

import { columnExists, currentTimestamp } from "../dialect-helpers.js";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("_emdash_shop_coupons")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("code", "text", (col) => col.notNull().unique())
		.addColumn("discount_type", "text", (col) => col.notNull().defaultTo("percentage"))
		.addColumn("discount_value", "real", (col) => col.notNull().defaultTo(0))
		.addColumn("minimum_subtotal", "real", (col) => col.notNull().defaultTo(0))
		.addColumn("starts_at", "text")
		.addColumn("expires_at", "text")
		.addColumn("usage_limit", "integer")
		.addColumn("usage_count", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("active", "integer", (col) => col.notNull().defaultTo(1))
		.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.execute();

	await db.schema
		.createIndex("idx_shop_coupons_active_code")
		.ifNotExists()
		.on("_emdash_shop_coupons")
		.columns(["active", "code"])
		.execute();

	for (const [name, type, defaultValue] of [
		["coupon_code", "text", undefined],
		["coupon_discount", "real", 0],
	] as const) {
		if (!(await columnExists(db, "_emdash_shop_orders", name))) {
			const builder = db.schema.alterTable("_emdash_shop_orders").addColumn(name, type, (col) => {
				if (defaultValue === undefined) return col;
				return col.notNull().defaultTo(defaultValue);
			});
			await builder.execute();
		}
	}
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("_emdash_shop_coupons").ifExists().execute();
	for (const name of ["coupon_discount", "coupon_code"] as const) {
		if (await columnExists(db, "_emdash_shop_orders", name)) {
			await db.schema.alterTable("_emdash_shop_orders").dropColumn(name).execute();
		}
	}
}

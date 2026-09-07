import type { Kysely } from "kysely";

import { currentTimestamp } from "../dialect-helpers.js";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("_emdash_shop_booking_hours")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("service_id", "text", (col) => col.notNull())
		.addColumn("weekday", "integer", (col) => col.notNull())
		.addColumn("starts_at", "text", (col) => col.notNull())
		.addColumn("ends_at", "text", (col) => col.notNull())
		.addColumn("active", "integer", (col) => col.notNull().defaultTo(1))
		.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.execute();

	await db.schema
		.createIndex("idx_shop_booking_hours_service_weekday")
		.ifNotExists()
		.on("_emdash_shop_booking_hours")
		.columns(["service_id", "weekday", "active"])
		.execute();

	await db.schema
		.createTable("_emdash_shop_booking_blocks")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("service_id", "text")
		.addColumn("starts_at", "text", (col) => col.notNull())
		.addColumn("ends_at", "text", (col) => col.notNull())
		.addColumn("reason", "text")
		.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.execute();

	await db.schema
		.createIndex("idx_shop_booking_blocks_service_range")
		.ifNotExists()
		.on("_emdash_shop_booking_blocks")
		.columns(["service_id", "starts_at", "ends_at"])
		.execute();

	await db.schema
		.createTable("_emdash_shop_reservations")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("service_id", "text", (col) => col.notNull())
		.addColumn("order_id", "text")
		.addColumn("order_item_id", "text")
		.addColumn("customer_id", "text")
		.addColumn("starts_at", "text", (col) => col.notNull())
		.addColumn("ends_at", "text", (col) => col.notNull())
		.addColumn("status", "text", (col) => col.notNull().defaultTo("held"))
		.addColumn("expires_at", "text")
		.addColumn("customer_snapshot", "text")
		.addColumn("service_snapshot", "text")
		.addColumn("notes", "text")
		.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.execute();

	await db.schema
		.createIndex("idx_shop_reservations_service_range")
		.ifNotExists()
		.on("_emdash_shop_reservations")
		.columns(["service_id", "starts_at", "ends_at", "status"])
		.execute();
	await db.schema
		.createIndex("idx_shop_reservations_order")
		.ifNotExists()
		.on("_emdash_shop_reservations")
		.columns(["order_id", "order_item_id"])
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("_emdash_shop_reservations").ifExists().execute();
	await db.schema.dropTable("_emdash_shop_booking_blocks").ifExists().execute();
	await db.schema.dropTable("_emdash_shop_booking_hours").ifExists().execute();
}

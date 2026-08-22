import type { Kysely } from "kysely";

import { currentTimestamp } from "../dialect-helpers.js";

/**
 * Ecommerce foundation for small businesses: shop settings, customers,
 * orders, payments, and delivery coordination.
 *
 * Product records remain CMS content in the `products` collection. Order
 * items copy product details at purchase time so historical orders remain
 * stable when a product is edited later.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("_emdash_shop_settings")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("store_name", "text", (col) => col.notNull().defaultTo(""))
		.addColumn("currency", "text", (col) => col.notNull().defaultTo("PEN"))
		.addColumn("whatsapp_number", "text")
		.addColumn("whatsapp_message", "text")
		.addColumn("payment_methods", "text", (col) => col.notNull().defaultTo('["whatsapp"]'))
		.addColumn("delivery_instructions", "text")
		.addColumn("business_hours", "text")
		.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.execute();

	await db.schema
		.createTable("_emdash_shop_delivery_zones")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("districts", "text", (col) => col.notNull().defaultTo("[]"))
		.addColumn("delivery_cost", "real", (col) => col.notNull().defaultTo(0))
		.addColumn("estimated_time", "text")
		.addColumn("active", "integer", (col) => col.notNull().defaultTo(1))
		.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.execute();

	await db.schema
		.createIndex("idx_shop_delivery_zones_active")
		.ifNotExists()
		.on("_emdash_shop_delivery_zones")
		.columns(["active", "name"])
		.execute();

	await db.schema
		.createTable("_emdash_shop_customers")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("phone", "text", (col) => col.notNull())
		.addColumn("email", "text")
		.addColumn("address", "text")
		.addColumn("district", "text")
		.addColumn("reference", "text")
		.addColumn("notes", "text")
		.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.execute();

	await db.schema
		.createIndex("idx_shop_customers_phone")
		.ifNotExists()
		.on("_emdash_shop_customers")
		.column("phone")
		.execute();

	await db.schema
		.createTable("_emdash_shop_orders")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("order_number", "text", (col) => col.notNull().unique())
		.addColumn("customer_id", "text", (col) => col.notNull())
		.addColumn("status", "text", (col) => col.notNull().defaultTo("new"))
		.addColumn("payment_status", "text", (col) => col.notNull().defaultTo("pending"))
		.addColumn("delivery_status", "text", (col) => col.notNull().defaultTo("pending"))
		.addColumn("currency", "text", (col) => col.notNull())
		.addColumn("subtotal", "real", (col) => col.notNull().defaultTo(0))
		.addColumn("discount", "real", (col) => col.notNull().defaultTo(0))
		.addColumn("delivery_cost", "real", (col) => col.notNull().defaultTo(0))
		.addColumn("total", "real", (col) => col.notNull().defaultTo(0))
		.addColumn("customer_snapshot", "text", (col) => col.notNull())
		.addColumn("delivery_snapshot", "text", (col) => col.notNull())
		.addColumn("notes", "text")
		.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.execute();

	await db.schema
		.createIndex("idx_shop_orders_status")
		.ifNotExists()
		.on("_emdash_shop_orders")
		.column("status")
		.execute();
	await db.schema
		.createIndex("idx_shop_orders_payment_status")
		.ifNotExists()
		.on("_emdash_shop_orders")
		.column("payment_status")
		.execute();
	await db.schema
		.createIndex("idx_shop_orders_delivery_status")
		.ifNotExists()
		.on("_emdash_shop_orders")
		.column("delivery_status")
		.execute();
	await db.schema
		.createIndex("idx_shop_orders_customer")
		.ifNotExists()
		.on("_emdash_shop_orders")
		.column("customer_id")
		.execute();
	await db.schema
		.createIndex("idx_shop_orders_created_at")
		.ifNotExists()
		.on("_emdash_shop_orders")
		.column("created_at")
		.execute();

	await db.schema
		.createTable("_emdash_shop_order_items")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("order_id", "text", (col) => col.notNull())
		.addColumn("product_id", "text", (col) => col.notNull())
		.addColumn("variant_id", "text")
		.addColumn("product_name", "text", (col) => col.notNull())
		.addColumn("variant_name", "text")
		.addColumn("unit_price", "real", (col) => col.notNull())
		.addColumn("quantity", "integer", (col) => col.notNull())
		.addColumn("discount", "real", (col) => col.notNull().defaultTo(0))
		.addColumn("subtotal", "real", (col) => col.notNull())
		.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.execute();

	await db.schema
		.createIndex("idx_shop_order_items_order")
		.ifNotExists()
		.on("_emdash_shop_order_items")
		.column("order_id")
		.execute();
	await db.schema
		.createIndex("idx_shop_order_items_product")
		.ifNotExists()
		.on("_emdash_shop_order_items")
		.column("product_id")
		.execute();

	await db.schema
		.createTable("_emdash_shop_payments")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("order_id", "text", (col) => col.notNull())
		.addColumn("method", "text", (col) => col.notNull())
		.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
		.addColumn("amount", "real", (col) => col.notNull())
		.addColumn("reference", "text")
		.addColumn("notes", "text")
		.addColumn("confirmed_by", "text")
		.addColumn("confirmed_at", "text")
		.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.execute();

	await db.schema
		.createIndex("idx_shop_payments_order")
		.ifNotExists()
		.on("_emdash_shop_payments")
		.column("order_id")
		.execute();

	await db.schema
		.createTable("_emdash_shop_deliveries")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("order_id", "text", (col) => col.notNull().unique())
		.addColumn("zone", "text")
		.addColumn("address", "text", (col) => col.notNull())
		.addColumn("district", "text", (col) => col.notNull())
		.addColumn("reference", "text")
		.addColumn("phone", "text", (col) => col.notNull())
		.addColumn("delivery_cost", "real", (col) => col.notNull().defaultTo(0))
		.addColumn("courier_name", "text")
		.addColumn("estimated_at", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
		.addColumn("notes", "text")
		.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.execute();

	await db.schema
		.createIndex("idx_shop_deliveries_status")
		.ifNotExists()
		.on("_emdash_shop_deliveries")
		.column("status")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("_emdash_shop_deliveries").execute();
	await db.schema.dropTable("_emdash_shop_payments").execute();
	await db.schema.dropTable("_emdash_shop_order_items").execute();
	await db.schema.dropTable("_emdash_shop_orders").execute();
	await db.schema.dropTable("_emdash_shop_customers").execute();
	await db.schema.dropTable("_emdash_shop_delivery_zones").execute();
	await db.schema.dropTable("_emdash_shop_settings").execute();
}

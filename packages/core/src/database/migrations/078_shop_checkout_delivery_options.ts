import type { Kysely } from "kysely";

import { columnExists } from "../dialect-helpers.js";

async function addColumnIfMissing(
	db: Kysely<unknown>,
	table: string,
	column: string,
	type: "text" | "real" | "integer",
	defaultValue?: string | number,
): Promise<void> {
	if (await columnExists(db, table, column)) return;
	if (defaultValue === undefined) {
		await db.schema.alterTable(table).addColumn(column, type).execute();
	} else {
		await db.schema
			.alterTable(table)
			.addColumn(column, type, (col) => col.defaultTo(defaultValue))
			.execute();
	}
}

export async function up(db: Kysely<unknown>): Promise<void> {
	await addColumnIfMissing(db, "_emdash_shop_settings", "preparation_time", "text");
	await addColumnIfMissing(db, "_emdash_shop_settings", "minimum_subtotal", "real", 0);
	await addColumnIfMissing(db, "_emdash_shop_settings", "free_delivery_min_subtotal", "real");
	await addColumnIfMissing(db, "_emdash_shop_settings", "whatsapp_templates", "text", "{}");

	await addColumnIfMissing(db, "_emdash_shop_customers", "document_type", "text");
	await addColumnIfMissing(db, "_emdash_shop_customers", "document_number", "text");
	await addColumnIfMissing(db, "_emdash_shop_customers", "fiscal_name", "text");
	await addColumnIfMissing(db, "_emdash_shop_customers", "fiscal_address", "text");

	await addColumnIfMissing(db, "_emdash_shop_orders", "cancellation_reason", "text");
	await addColumnIfMissing(db, "_emdash_shop_orders", "return_status", "text", "none");
	await addColumnIfMissing(db, "_emdash_shop_orders", "return_reason", "text");
	await addColumnIfMissing(db, "_emdash_shop_orders", "refunded_amount", "real", 0);
	await addColumnIfMissing(db, "_emdash_shop_orders", "refund_notes", "text");

	await addColumnIfMissing(db, "_emdash_shop_deliveries", "scheduled_date", "text");
	await addColumnIfMissing(db, "_emdash_shop_deliveries", "scheduled_time", "text");
	await addColumnIfMissing(db, "_emdash_shop_deliveries", "recipient_name", "text");
	await addColumnIfMissing(db, "_emdash_shop_deliveries", "recipient_phone", "text");
	await addColumnIfMissing(db, "_emdash_shop_deliveries", "instructions", "text");
	await addColumnIfMissing(db, "_emdash_shop_deliveries", "failed_reason", "text");
	await addColumnIfMissing(db, "_emdash_shop_deliveries", "delivered_at", "text");
	await addColumnIfMissing(db, "_emdash_shop_deliveries", "rescheduled_at", "text");
}

export async function down(db: Kysely<unknown>): Promise<void> {
	const deliveryColumns = [
		"rescheduled_at",
		"delivered_at",
		"failed_reason",
		"instructions",
		"recipient_phone",
		"recipient_name",
		"scheduled_time",
		"scheduled_date",
	];
	for (const column of deliveryColumns) {
		if (await columnExists(db, "_emdash_shop_deliveries", column)) {
			await db.schema.alterTable("_emdash_shop_deliveries").dropColumn(column).execute();
		}
	}

	for (const column of [
		"refund_notes",
		"refunded_amount",
		"return_reason",
		"return_status",
		"cancellation_reason",
	]) {
		if (await columnExists(db, "_emdash_shop_orders", column)) {
			await db.schema.alterTable("_emdash_shop_orders").dropColumn(column).execute();
		}
	}

	for (const column of ["fiscal_address", "fiscal_name", "document_number", "document_type"]) {
		if (await columnExists(db, "_emdash_shop_customers", column)) {
			await db.schema.alterTable("_emdash_shop_customers").dropColumn(column).execute();
		}
	}

	for (const column of [
		"whatsapp_templates",
		"free_delivery_min_subtotal",
		"minimum_subtotal",
		"preparation_time",
	]) {
		if (await columnExists(db, "_emdash_shop_settings", column)) {
			await db.schema.alterTable("_emdash_shop_settings").dropColumn(column).execute();
		}
	}
}

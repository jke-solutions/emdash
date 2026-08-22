import type { Kysely } from "kysely";

import { columnExists } from "../dialect-helpers.js";

export async function up(db: Kysely<unknown>): Promise<void> {
	if (!(await columnExists(db, "_emdash_shop_settings", "payment_gateway_enabled"))) {
		await db.schema
			.alterTable("_emdash_shop_settings")
			.addColumn("payment_gateway_enabled", "integer", (col) => col.notNull().defaultTo(0))
			.execute();
	}
	if (!(await columnExists(db, "_emdash_shop_settings", "payment_gateway_provider"))) {
		await db.schema
			.alterTable("_emdash_shop_settings")
			.addColumn("payment_gateway_provider", "text")
			.execute();
	}
	if (!(await columnExists(db, "_emdash_shop_settings", "payment_gateway_environment"))) {
		await db.schema
			.alterTable("_emdash_shop_settings")
			.addColumn("payment_gateway_environment", "text", (col) => col.notNull().defaultTo("sandbox"))
			.execute();
	}
	if (!(await columnExists(db, "_emdash_shop_settings", "payment_gateway_public_key"))) {
		await db.schema
			.alterTable("_emdash_shop_settings")
			.addColumn("payment_gateway_public_key", "text")
			.execute();
	}
	if (!(await columnExists(db, "_emdash_shop_settings", "payment_gateway_secret_key"))) {
		await db.schema
			.alterTable("_emdash_shop_settings")
			.addColumn("payment_gateway_secret_key", "text")
			.execute();
	}
	if (!(await columnExists(db, "_emdash_shop_settings", "payment_gateway_webhook_secret"))) {
		await db.schema
			.alterTable("_emdash_shop_settings")
			.addColumn("payment_gateway_webhook_secret", "text")
			.execute();
	}
	if (!(await columnExists(db, "_emdash_shop_settings", "payment_gateway_return_url"))) {
		await db.schema
			.alterTable("_emdash_shop_settings")
			.addColumn("payment_gateway_return_url", "text")
			.execute();
	}
	if (!(await columnExists(db, "_emdash_shop_settings", "payment_gateway_webhook_url"))) {
		await db.schema
			.alterTable("_emdash_shop_settings")
			.addColumn("payment_gateway_webhook_url", "text")
			.execute();
	}
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("_emdash_shop_settings")
		.dropColumn("payment_gateway_webhook_url")
		.execute();
	await db.schema
		.alterTable("_emdash_shop_settings")
		.dropColumn("payment_gateway_return_url")
		.execute();
	await db.schema
		.alterTable("_emdash_shop_settings")
		.dropColumn("payment_gateway_webhook_secret")
		.execute();
	await db.schema
		.alterTable("_emdash_shop_settings")
		.dropColumn("payment_gateway_secret_key")
		.execute();
	await db.schema
		.alterTable("_emdash_shop_settings")
		.dropColumn("payment_gateway_public_key")
		.execute();
	await db.schema
		.alterTable("_emdash_shop_settings")
		.dropColumn("payment_gateway_environment")
		.execute();
	await db.schema
		.alterTable("_emdash_shop_settings")
		.dropColumn("payment_gateway_provider")
		.execute();
	await db.schema
		.alterTable("_emdash_shop_settings")
		.dropColumn("payment_gateway_enabled")
		.execute();
}

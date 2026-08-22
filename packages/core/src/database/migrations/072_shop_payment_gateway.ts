import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("_emdash_shop_settings").addColumn("payment_gateway_enabled", "integer", (col) => col.notNull().defaultTo(0)).execute();
	await db.schema.alterTable("_emdash_shop_settings").addColumn("payment_gateway_provider", "text").execute();
	await db.schema.alterTable("_emdash_shop_settings").addColumn("payment_gateway_environment", "text", (col) => col.notNull().defaultTo("sandbox")).execute();
	await db.schema.alterTable("_emdash_shop_settings").addColumn("payment_gateway_public_key", "text").execute();
	await db.schema.alterTable("_emdash_shop_settings").addColumn("payment_gateway_secret_key", "text").execute();
	await db.schema.alterTable("_emdash_shop_settings").addColumn("payment_gateway_webhook_secret", "text").execute();
	await db.schema.alterTable("_emdash_shop_settings").addColumn("payment_gateway_return_url", "text").execute();
	await db.schema.alterTable("_emdash_shop_settings").addColumn("payment_gateway_webhook_url", "text").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("_emdash_shop_settings").dropColumn("payment_gateway_webhook_url").execute();
	await db.schema.alterTable("_emdash_shop_settings").dropColumn("payment_gateway_return_url").execute();
	await db.schema.alterTable("_emdash_shop_settings").dropColumn("payment_gateway_webhook_secret").execute();
	await db.schema.alterTable("_emdash_shop_settings").dropColumn("payment_gateway_secret_key").execute();
	await db.schema.alterTable("_emdash_shop_settings").dropColumn("payment_gateway_public_key").execute();
	await db.schema.alterTable("_emdash_shop_settings").dropColumn("payment_gateway_environment").execute();
	await db.schema.alterTable("_emdash_shop_settings").dropColumn("payment_gateway_provider").execute();
	await db.schema.alterTable("_emdash_shop_settings").dropColumn("payment_gateway_enabled").execute();
}

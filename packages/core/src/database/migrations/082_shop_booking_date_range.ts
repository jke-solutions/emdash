import { type Kysely } from "kysely";

import { columnExists } from "../dialect-helpers.js";

export async function up(db: Kysely<unknown>): Promise<void> {
	if (!(await columnExists(db, "_emdash_shop_booking_hours", "valid_from"))) {
		await db.schema
			.alterTable("_emdash_shop_booking_hours")
			.addColumn("valid_from", "text")
			.execute();
	}
	if (!(await columnExists(db, "_emdash_shop_booking_hours", "valid_until"))) {
		await db.schema
			.alterTable("_emdash_shop_booking_hours")
			.addColumn("valid_until", "text")
			.execute();
	}
}

export async function down(db: Kysely<unknown>): Promise<void> {
	if (await columnExists(db, "_emdash_shop_booking_hours", "valid_until")) {
		await db.schema.alterTable("_emdash_shop_booking_hours").dropColumn("valid_until").execute();
	}
	if (await columnExists(db, "_emdash_shop_booking_hours", "valid_from")) {
		await db.schema.alterTable("_emdash_shop_booking_hours").dropColumn("valid_from").execute();
	}
}

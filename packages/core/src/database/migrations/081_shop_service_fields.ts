import { type Kysely } from "kysely";
import { ulid } from "ulidx";

import { columnExists, tableExists } from "../dialect-helpers.js";
import type { Database } from "../types.js";

const SERVICE_FIELDS = [
	{
		slug: "item_type",
		label: "Tipo de elemento",
		type: "select",
		columnType: "text" as const,
		validation: { options: ["product", "service"] },
	},
	{
		slug: "service_mode",
		label: "Modalidad del servicio",
		type: "select",
		columnType: "text" as const,
		validation: { options: ["in_person", "online"] },
	},
	{
		slug: "requires_booking",
		label: "Requiere reserva",
		type: "boolean",
		columnType: "integer" as const,
	},
	{
		slug: "duration_minutes",
		label: "Duración en minutos",
		type: "integer",
		columnType: "integer" as const,
		validation: { min: 1, max: 1440 },
	},
	{
		slug: "service_capacity",
		label: "Cupos por horario",
		type: "integer",
		columnType: "integer" as const,
		validation: { min: 1, max: 1000 },
	},
];

export async function up(db: Kysely<unknown>): Promise<void> {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- migrations receive an untyped Kysely instance
	const database = db as Kysely<Database>;
	const collection = await database
		.selectFrom("_emdash_collections")
		.select(["id"])
		.where("slug", "=", "services")
		.executeTakeFirst();
	if (!collection || !(await tableExists(database, "ec_services"))) return;

	for (const field of SERVICE_FIELDS) {
		const existing = await database
			.selectFrom("_emdash_fields")
			.select(["id"])
			.where("collection_id", "=", collection.id)
			.where("slug", "=", field.slug)
			.executeTakeFirst();
		if (existing) continue;

		if (!(await columnExists(database, "ec_services", field.slug))) {
			await database.schema
				.alterTable("ec_services")
				.addColumn(field.slug, field.columnType, (column) =>
					column.defaultTo(field.columnType === "integer" ? 0 : null),
				)
				.execute();
		}

		const maxSort = await database
			.selectFrom("_emdash_fields")
			.select((expression) => expression.fn.max<number>("sort_order").as("max"))
			.where("collection_id", "=", collection.id)
			.executeTakeFirst();
		await database
			.insertInto("_emdash_fields")
			.values({
				id: ulid(),
				collection_id: collection.id,
				slug: field.slug,
				label: field.label,
				type: field.type,
				column_type: field.columnType.toUpperCase(),
				required: 0,
				unique: 0,
				default_value: field.columnType === "integer" ? "0" : null,
				validation: field.validation ? JSON.stringify(field.validation) : null,
				widget: null,
				options: null,
				sort_order: (maxSort?.max ?? -1) + 1,
				searchable: 0,
				indexed: 0,
				translatable: 1,
			})
			.execute();
	}
}

export async function down(db: Kysely<unknown>): Promise<void> {
	void db;
}

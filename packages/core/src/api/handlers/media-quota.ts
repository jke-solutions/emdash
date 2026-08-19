import { sql, type Kysely } from "kysely";

import type { Database } from "../../database/types.js";

export interface MediaStorageQuota {
	usedBytes: number;
	quotaBytes: number;
	remainingBytes: number;
}

export async function getMediaStorageQuota(
	db: Kysely<Database>,
	quotaBytes: number,
): Promise<MediaStorageQuota> {
	const row = await db
		.selectFrom("media")
		.select(sql<number>`coalesce(sum(size), 0)`.as("usedBytes"))
		.where("status", "in", ["ready", "pending"])
		.executeTakeFirstOrThrow();
	const usedBytes = Number(row.usedBytes);

	return {
		usedBytes,
		quotaBytes,
		remainingBytes: Math.max(0, quotaBytes - usedBytes),
	};
}

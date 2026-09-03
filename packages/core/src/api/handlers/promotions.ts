import type { Kysely } from "kysely";
import { ulid } from "ulidx";

import type { Database } from "../../database/types.js";
import type { ApiResult } from "../types.js";

export interface PromotionalCampaign {
	id: string;
	title: string;
	content: Array<Record<string, unknown>>;
	media: { id: string; url: string; filename: string; alt: string | null } | null;
	buttonLabel: string | null;
	buttonUrl: string | null;
	pageScope: "all" | "home";
	isActive: boolean;
	startsAt: string | null;
	endsAt: string | null;
	modalSize: "square" | "rectangle" | "custom";
	modalWidth: number | null;
	modalHeight: number | null;
	createdAt: string;
	updatedAt: string;
}

export type PromotionalCampaignInput = {
	title: string;
	content: Array<Record<string, unknown>>;
	mediaId?: string | null;
	buttonLabel?: string;
	buttonUrl?: string;
	pageScope: "all" | "home";
	isActive: boolean;
	startsAt?: string | null;
	endsAt?: string | null;
	modalSize?: "square" | "rectangle" | "custom";
	modalWidth?: number | null;
	modalHeight?: number | null;
};

type CampaignRow = {
	id: string;
	title: string;
	content: string;
	button_label: string | null;
	button_url: string | null;
	page_scope: string;
	is_active: number;
	starts_at: string | null;
	ends_at: string | null;
	created_at: string;
	updated_at: string;
	media_id: string | null;
	media_filename: string | null;
	media_alt: string | null;
	media_storage_key: string | null;
	modal_size: string;
	modal_width: number | null;
	modal_height: number | null;
};

function parseContent(value: string): Array<Record<string, unknown>> {
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed)
			? parsed.filter(
					(item): item is Record<string, unknown> => typeof item === "object" && item !== null,
				)
			: [];
	} catch {
		return [];
	}
}

function mapCampaign(row: CampaignRow): PromotionalCampaign {
	return {
		id: row.id,
		title: row.title,
		content: parseContent(row.content),
		media:
			row.media_id && row.media_filename && row.media_storage_key
				? {
						id: row.media_id,
						filename: row.media_filename,
						alt: row.media_alt,
						url: `/_emdash/api/media/file/${row.media_storage_key}`,
					}
				: null,
		buttonLabel: row.button_label,
		buttonUrl: row.button_url,
		pageScope: row.page_scope === "home" ? "home" : "all",
		isActive: row.is_active === 1,
		startsAt: row.starts_at,
		endsAt: row.ends_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		modalSize:
			row.modal_size === "square" || row.modal_size === "custom" ? row.modal_size : "rectangle",
		modalWidth: row.modal_width,
		modalHeight: row.modal_height,
	};
}

async function queryCampaigns(
	db: Kysely<Database>,
	id?: string,
	activeOnly = false,
): Promise<PromotionalCampaign[]> {
	let query = db
		.selectFrom("_emdash_promotional_campaign as c")
		.leftJoin("media as m", "m.id", "c.media_id")
		.select([
			"c.id",
			"c.title",
			"c.content",
			"c.button_label",
			"c.button_url",
			"c.page_scope",
			"c.is_active",
			"c.starts_at",
			"c.ends_at",
			"c.created_at",
			"c.updated_at",
			"c.modal_size",
			"c.modal_width",
			"c.modal_height",
			"m.id as media_id",
			"m.filename as media_filename",
			"m.alt as media_alt",
			"m.storage_key as media_storage_key",
		]);
	if (id) query = query.where("c.id", "=", id);
	if (activeOnly) query = query.where("c.is_active", "=", 1);
	const rows = await query.orderBy("c.updated_at", "desc").execute();
	return rows.map((row) => mapCampaign(row));
}

export async function handlePromotionalCampaignList(
	db: Kysely<Database>,
	activeOnly = false,
): Promise<ApiResult<PromotionalCampaign[]>> {
	try {
		return { success: true, data: await queryCampaigns(db, undefined, activeOnly) };
	} catch {
		return {
			success: false,
			error: { code: "PROMOTION_READ_ERROR", message: "Failed to read promotional campaigns" },
		};
	}
}

export async function handlePromotionalCampaignGet(
	db: Kysely<Database>,
	id: string,
): Promise<ApiResult<PromotionalCampaign | null>> {
	try {
		return { success: true, data: (await queryCampaigns(db, id))[0] ?? null };
	} catch {
		return {
			success: false,
			error: { code: "PROMOTION_READ_ERROR", message: "Failed to read promotional campaign" },
		};
	}
}

export async function handlePromotionalCampaignCreate(
	db: Kysely<Database>,
	input: PromotionalCampaignInput,
): Promise<ApiResult<PromotionalCampaign>> {
	return saveCampaign(db, ulid(), input);
}
export async function handlePromotionalCampaignUpdate(
	db: Kysely<Database>,
	id: string,
	input: PromotionalCampaignInput,
): Promise<ApiResult<PromotionalCampaign>> {
	return saveCampaign(db, id, input);
}

async function saveCampaign(
	db: Kysely<Database>,
	id: string,
	input: PromotionalCampaignInput,
): Promise<ApiResult<PromotionalCampaign>> {
	try {
		if (input.mediaId) {
			const media = await db
				.selectFrom("media")
				.select("id")
				.where("id", "=", input.mediaId)
				.executeTakeFirst();
			if (!media)
				return {
					success: false,
					error: { code: "MEDIA_NOT_FOUND", message: "Promotional image was not found" },
				};
		}
		const values = {
			id,
			title: input.title,
			content: JSON.stringify(input.content),
			media_id: input.mediaId ?? null,
			button_label: input.buttonLabel || null,
			button_url: input.buttonUrl || null,
			page_scope: input.pageScope,
			is_active: input.isActive ? 1 : 0,
			starts_at: input.startsAt ?? null,
			ends_at: input.endsAt ?? null,
			modal_size: input.modalSize ?? "rectangle",
			modal_width: input.modalWidth ?? null,
			modal_height: input.modalHeight ?? null,
			updated_at: new Date().toISOString(),
		};
		await db.transaction().execute(async (trx) => {
			if (input.isActive)
				await trx.updateTable("_emdash_promotional_campaign").set({ is_active: 0 }).execute();
			await trx
				.insertInto("_emdash_promotional_campaign")
				.values(values)
				.onConflict((oc) =>
					oc.column("id").doUpdateSet({
						title: values.title,
						content: values.content,
						media_id: values.media_id,
						button_label: values.button_label,
						button_url: values.button_url,
						page_scope: values.page_scope,
						is_active: values.is_active,
						starts_at: values.starts_at,
						ends_at: values.ends_at,
						modal_size: values.modal_size,
						modal_width: values.modal_width,
						modal_height: values.modal_height,
						updated_at: values.updated_at,
					}),
				)
				.execute();
		});
		const campaign = (await queryCampaigns(db, id))[0];
		return campaign
			? { success: true, data: campaign }
			: { success: false, error: { code: "NOT_FOUND", message: "Promotional campaign not found" } };
	} catch {
		return {
			success: false,
			error: { code: "PROMOTION_UPDATE_ERROR", message: "Failed to save promotional campaign" },
		};
	}
}

export async function handlePromotionalCampaignDelete(
	db: Kysely<Database>,
	id: string,
): Promise<ApiResult<null>> {
	try {
		await db.deleteFrom("_emdash_promotional_campaign").where("id", "=", id).execute();
		return { success: true, data: null };
	} catch {
		return {
			success: false,
			error: { code: "PROMOTION_DELETE_ERROR", message: "Failed to delete promotional campaign" },
		};
	}
}

export async function getActivePromotionalCampaign(
	db: Kysely<Database>,
): Promise<PromotionalCampaign | null> {
	return (await queryCampaigns(db, undefined, true))[0] ?? null;
}

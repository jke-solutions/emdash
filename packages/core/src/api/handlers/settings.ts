/**
 * Settings handlers
 */

import type { Kysely } from "kysely";

import type { Database } from "../../database/types.js";
import { getSiteSettingsWithDb, setSiteSettings } from "../../settings/index.js";
import type { SiteSettings } from "../../settings/types.js";
import type { Storage } from "../../storage/types.js";
import type { ApiResult } from "../types.js";

/**
 * Get all site settings
 */
export async function handleSettingsGet(
	db: Kysely<Database>,
	storage: Storage | null,
): Promise<ApiResult<Partial<SiteSettings>>> {
	try {
		const settings = await getSiteSettingsWithDb(db, storage);
		return { success: true, data: settings };
	} catch {
		return {
			success: false,
			error: { code: "SETTINGS_READ_ERROR", message: "Failed to get settings" },
		};
	}
}

/**
 * Update site settings
 */
export async function handleSettingsUpdate(
	db: Kysely<Database>,
	storage: Storage | null,
	input: Partial<SiteSettings>,
): Promise<ApiResult<Partial<SiteSettings>>> {
	try {
		const currentSettings = input.theme ? await getSiteSettingsWithDb(db, storage) : undefined;
		const theme = input.theme
			? {
					colors: {
						...currentSettings?.theme?.colors,
						primary: input.theme.colors?.primary,
						primaryHover: input.theme.colors?.primaryHover,
						secondary: input.theme.colors?.secondary,
						secondaryHover: input.theme.colors?.secondaryHover,
						onPrimary: input.theme.colors?.onPrimary,
						onSecondary: input.theme.colors?.onSecondary,
					},
					fonts: currentSettings?.theme?.fonts,
				}
			: undefined;
		await setSiteSettings({ ...input, ...(theme ? { theme } : {}) }, db);
		const updatedSettings = await getSiteSettingsWithDb(db, storage);
		return { success: true, data: updatedSettings };
	} catch {
		return {
			success: false,
			error: { code: "SETTINGS_UPDATE_ERROR", message: "Failed to update settings" },
		};
	}
}

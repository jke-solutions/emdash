import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { apiError, apiSuccess } from "#api/error.js";
import { getMediaStorageQuota } from "#api/handlers/media-quota.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const { emdash, user } = locals;
	const denied = requirePerm(user, "media:read");
	if (denied) return denied;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	const quota = emdash.config.storageQuota;
	if (quota === undefined) return apiSuccess({ enabled: false });
	if (!Number.isFinite(quota) || quota <= 0) {
		return apiError("CONFIGURATION_ERROR", "Invalid storageQuota configuration", 500);
	}

	return apiSuccess({ enabled: true, ...(await getMediaStorageQuota(emdash.db, quota)) });
};

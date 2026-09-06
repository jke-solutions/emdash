import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { apiError, handleError, unwrapResult } from "#api/error.js";
import {
	handlePromotionalCampaignDelete,
	handlePromotionalCampaignGet,
	handlePromotionalCampaignUpdate,
} from "#api/handlers/promotions.js";
import { isParseError, parseBody } from "#api/parse.js";
import { promotionalCampaignBody } from "#api/schemas.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals, params }) => {
	if (!locals.emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	const denied = requirePerm(locals.user, "settings:read");
	if (denied) return denied;
	if (!params.id) return apiError("VALIDATION_ERROR", "id is required", 400);
	return unwrapResult(await handlePromotionalCampaignGet(locals.emdash.db, params.id));
};

export const PUT: APIRoute = async ({ request, locals, params }) => {
	if (!locals.emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	const denied = requirePerm(locals.user, "settings:manage");
	if (denied) return denied;
	if (!params.id) return apiError("VALIDATION_ERROR", "id is required", 400);
	try {
		const body = await parseBody(request, promotionalCampaignBody);
		if (isParseError(body)) return body;
		return unwrapResult(await handlePromotionalCampaignUpdate(locals.emdash.db, params.id, body));
	} catch (error) {
		return handleError(error, "Failed to update promotional campaign", "PROMOTION_UPDATE_ERROR");
	}
};

export const DELETE: APIRoute = async ({ locals, params }) => {
	if (!locals.emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	const denied = requirePerm(locals.user, "settings:manage");
	if (denied) return denied;
	if (!params.id) return apiError("VALIDATION_ERROR", "id is required", 400);
	return unwrapResult(await handlePromotionalCampaignDelete(locals.emdash.db, params.id));
};

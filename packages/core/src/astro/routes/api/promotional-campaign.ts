import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { apiError, handleError, unwrapResult } from "#api/error.js";
import {
	handlePromotionalCampaignCreate,
	handlePromotionalCampaignList,
} from "#api/handlers/promotions.js";
import { isParseError, parseBody } from "#api/parse.js";
import { promotionalCampaignBody } from "#api/schemas.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	if (!locals.emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	const denied = requirePerm(locals.user, "settings:read");
	if (denied) return denied;
	return unwrapResult(await handlePromotionalCampaignList(locals.emdash.db));
};

export const POST: APIRoute = async ({ request, locals }) => {
	if (!locals.emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	const denied = requirePerm(locals.user, "settings:manage");
	if (denied) return denied;
	try {
		const body = await parseBody(request, promotionalCampaignBody);
		if (isParseError(body)) return body;
		return unwrapResult(await handlePromotionalCampaignCreate(locals.emdash.db, body), 201);
	} catch (error) {
		return handleError(error, "Failed to create promotional campaign", "PROMOTION_CREATE_ERROR");
	}
};

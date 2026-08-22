import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopSettingsGet, handleShopSettingsUpdate } from "#api/handlers/shop.js";
import { isParseError, parseBody } from "#api/parse.js";
import { shopSettingsUpdateBody } from "#api/schemas.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const denied = requirePerm(locals.user, "shop:read");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	return unwrapResult(await handleShopSettingsGet(locals.emdash.db));
};

export const PUT: APIRoute = async ({ request, locals }) => {
	const denied = requirePerm(locals.user, "shop:manage");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		const body = await parseBody(request, shopSettingsUpdateBody);
		if (isParseError(body)) return body;
		return unwrapResult(await handleShopSettingsUpdate(locals.emdash.db, body));
	} catch (error) {
		return handleError(error, "Failed to update shop settings", "SHOP_SETTINGS_UPDATE_ERROR");
	}
};

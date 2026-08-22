import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopDeliveryZoneCreate, handleShopDeliveryZoneList } from "#api/handlers/shop.js";
import { isParseError, parseBody } from "#api/parse.js";
import { shopDeliveryZoneCreateBody } from "#api/schemas.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const denied = requirePerm(locals.user, "shop:read");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	return unwrapResult(await handleShopDeliveryZoneList(locals.emdash.db));
};

export const POST: APIRoute = async ({ request, locals }) => {
	const denied = requirePerm(locals.user, "shop:manage");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		const body = await parseBody(request, shopDeliveryZoneCreateBody);
		if (isParseError(body)) return body;
		return unwrapResult(await handleShopDeliveryZoneCreate(locals.emdash.db, body), 201);
	} catch (error) {
		return handleError(error, "Failed to create delivery zone", "SHOP_DELIVERY_ZONE_CREATE_ERROR");
	}
};

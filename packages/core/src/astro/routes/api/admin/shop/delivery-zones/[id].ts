import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopDeliveryZoneDelete, handleShopDeliveryZoneUpdate } from "#api/handlers/shop.js";
import { isParseError, parseBody } from "#api/parse.js";
import { shopDeliveryZoneUpdateBody } from "#api/schemas.js";

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request, locals }) => {
	const denied = requirePerm(locals.user, "shop:manage");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		const body = await parseBody(request, shopDeliveryZoneUpdateBody);
		if (isParseError(body)) return body;
		return unwrapResult(
			await handleShopDeliveryZoneUpdate(locals.emdash.db, params.id ?? "", body),
		);
	} catch (error) {
		return handleError(error, "Failed to update delivery zone", "SHOP_DELIVERY_ZONE_UPDATE_ERROR");
	}
};

export const DELETE: APIRoute = async ({ params, locals }) => {
	const denied = requirePerm(locals.user, "shop:manage");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	return unwrapResult(await handleShopDeliveryZoneDelete(locals.emdash.db, params.id ?? ""));
};

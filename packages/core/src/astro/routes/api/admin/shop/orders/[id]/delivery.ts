import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { requireDb, unwrapResult } from "#api/error.js";
import { handleShopDeliveryUpdate } from "#api/handlers/shop.js";
import { isParseError, parseBody } from "#api/parse.js";
import { shopDeliveryUpdateBody } from "#api/schemas.js";

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request, locals }) => {
	const denied = requirePerm(locals.user, "shop:manage");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	const body = await parseBody(request, shopDeliveryUpdateBody);
	if (isParseError(body)) return body;
	return unwrapResult(await handleShopDeliveryUpdate(locals.emdash.db, params.id ?? "", body.status, body.courierName));
};

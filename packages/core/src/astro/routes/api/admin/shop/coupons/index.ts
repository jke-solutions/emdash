import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopCouponCreate, handleShopCouponList } from "#api/handlers/shop.js";
import { isParseError, parseBody } from "#api/parse.js";
import { shopCouponCreateBody } from "#api/schemas.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const denied = requirePerm(locals.user, "shop:read");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	return unwrapResult(await handleShopCouponList(locals.emdash.db));
};

export const POST: APIRoute = async ({ request, locals }) => {
	const denied = requirePerm(locals.user, "shop:manage");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		const body = await parseBody(request, shopCouponCreateBody);
		if (isParseError(body)) return body;
		return unwrapResult(await handleShopCouponCreate(locals.emdash.db, body), 201);
	} catch (error) {
		return handleError(error, "Failed to create coupon", "SHOP_COUPON_CREATE_ERROR");
	}
};

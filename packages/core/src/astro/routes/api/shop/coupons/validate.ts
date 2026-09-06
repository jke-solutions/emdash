import type { APIRoute } from "astro";

import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopCouponValidate } from "#api/handlers/shop.js";
import { isParseError, parseBody } from "#api/parse.js";
import { shopCouponValidateBody } from "#api/schemas.js";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		const body = await parseBody(request, shopCouponValidateBody);
		if (isParseError(body)) return body;
		return unwrapResult(await handleShopCouponValidate(locals.emdash.db, body.code, body.subtotal));
	} catch (error) {
		return handleError(error, "Failed to validate coupon", "SHOP_COUPON_VALIDATE_ERROR");
	}
};

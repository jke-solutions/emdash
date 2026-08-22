import type { APIRoute } from "astro";

import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopProductGet } from "#api/handlers/shop.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals, params }) => {
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		return unwrapResult(await handleShopProductGet(locals.emdash.db, params.id ?? ""));
	} catch (error) {
		return handleError(error, "Failed to get shop product", "SHOP_PRODUCT_GET_ERROR");
	}
};

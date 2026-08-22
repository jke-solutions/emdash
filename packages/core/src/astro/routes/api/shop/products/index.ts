import type { APIRoute } from "astro";

import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopProductList } from "#api/handlers/shop.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		return unwrapResult(await handleShopProductList(locals.emdash.db));
	} catch (error) {
		return handleError(error, "Failed to list shop products", "SHOP_PRODUCT_LIST_ERROR");
	}
};

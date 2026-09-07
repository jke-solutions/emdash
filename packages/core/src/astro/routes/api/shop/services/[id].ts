import type { APIRoute } from "astro";

import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopServiceGet } from "#api/handlers/shop.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals, params }) => {
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		return unwrapResult(await handleShopServiceGet(locals.emdash.db, params.id ?? ""));
	} catch (error) {
		return handleError(error, "Failed to get shop service", "SHOP_SERVICE_GET_ERROR");
	}
};

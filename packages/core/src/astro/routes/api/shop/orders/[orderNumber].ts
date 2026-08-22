import type { APIRoute } from "astro";

import { requireDb, unwrapResult } from "#api/error.js";
import { handleShopOrderGetByNumber } from "#api/handlers/shop.js";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	return unwrapResult(await handleShopOrderGetByNumber(locals.emdash.db, params.orderNumber ?? ""));
};

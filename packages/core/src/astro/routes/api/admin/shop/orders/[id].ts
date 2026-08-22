import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { requireDb, unwrapResult } from "#api/error.js";
import { handleShopOrderGet } from "#api/handlers/shop.js";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
	const denied = requirePerm(locals.user, "shop:read");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	return unwrapResult(await handleShopOrderGet(locals.emdash.db, params.id ?? ""));
};

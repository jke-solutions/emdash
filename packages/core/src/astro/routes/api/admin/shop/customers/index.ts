import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { requireDb, unwrapResult } from "#api/error.js";
import { handleShopCustomerList } from "#api/handlers/shop.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const denied = requirePerm(locals.user, "shop:read");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	return unwrapResult(await handleShopCustomerList(locals.emdash.db));
};

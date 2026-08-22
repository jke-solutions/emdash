import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { requireDb, unwrapResult } from "#api/error.js";
import { handleShopPaymentConfirm } from "#api/handlers/shop.js";
import { isParseError, parseBody } from "#api/parse.js";
import { shopPaymentConfirmBody } from "#api/schemas.js";

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals }) => {
	const denied = requirePerm(locals.user, "shop:manage");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	const body = await parseBody(request, shopPaymentConfirmBody);
	if (isParseError(body)) return body;
	return unwrapResult(
		await handleShopPaymentConfirm(locals.emdash.db, params.id ?? "", locals.user?.id ?? ""),
	);
};

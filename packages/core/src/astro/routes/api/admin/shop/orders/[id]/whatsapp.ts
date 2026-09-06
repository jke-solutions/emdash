import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { requireDb, unwrapResult } from "#api/error.js";
import { handleShopOrderWhatsAppUrl } from "#api/handlers/shop.js";

export const prerender = false;

export const GET: APIRoute = async ({ params, request, locals }) => {
	const denied = requirePerm(locals.user, "shop:manage");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	const templateKey = new URL(request.url).searchParams.get("template") ?? undefined;
	const result = await handleShopOrderWhatsAppUrl(locals.emdash.db, params.id ?? "", templateKey);
	if (request.headers.get("accept")?.includes("text/html") && result.success) {
		return Response.redirect(result.data, 302);
	}
	return unwrapResult(result);
};

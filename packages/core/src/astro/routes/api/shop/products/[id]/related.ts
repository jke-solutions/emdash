import type { APIRoute } from "astro";

import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopProductRelatedList } from "#api/handlers/shop.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals, params, request }) => {
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		const searchParams = new URL(request.url).searchParams;
		const limitValue = Number(searchParams.get("limit"));
		const strategyValue = searchParams.get("strategy");
		const strategy =
			strategyValue === "category" || strategyValue === "tag" || strategyValue === "both"
				? strategyValue
				: undefined;
		return unwrapResult(
			await handleShopProductRelatedList(locals.emdash.db, params.id ?? "", {
				limit: Number.isFinite(limitValue) ? limitValue : undefined,
				strategy,
			}),
		);
	} catch (error) {
		return handleError(error, "Failed to list related products", "SHOP_PRODUCT_RELATED_ERROR");
	}
};

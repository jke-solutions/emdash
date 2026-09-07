import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { handleError, requireDb, unwrapResult } from "#api/error.js";
import {
	handleShopBookingBlockCreate,
	handleShopBookingBlocksList,
} from "#api/handlers/booking.js";
import { isParseError, parseBody } from "#api/parse.js";
import { shopBookingBlockCreateBody } from "#api/schemas.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const denied = requirePerm(locals.user, "shop:read");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		return unwrapResult(await handleShopBookingBlocksList(locals.emdash.db));
	} catch (error) {
		return handleError(error, "Failed to list booking blocks", "SHOP_BOOKING_BLOCKS_ERROR");
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	const denied = requirePerm(locals.user, "shop:manage");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		const body = await parseBody(request, shopBookingBlockCreateBody);
		if (isParseError(body)) return body;
		return unwrapResult(await handleShopBookingBlockCreate(locals.emdash.db, body));
	} catch (error) {
		return handleError(error, "Failed to create booking block", "SHOP_BOOKING_BLOCK_CREATE_ERROR");
	}
};

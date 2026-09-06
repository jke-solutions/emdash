import {
	getActivePromotionalCampaign,
	type PromotionalCampaign,
} from "../api/handlers/promotions.js";
import { getDb } from "../loader.js";
import { requestCached } from "../request-cache.js";

export async function getPromotionalCampaign(): Promise<PromotionalCampaign | null> {
	return requestCached("promotional-campaign", async () => {
		return getActivePromotionalCampaign(await getDb());
	});
}

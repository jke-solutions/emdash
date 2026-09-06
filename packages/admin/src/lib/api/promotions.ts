import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";

import { API_BASE, apiFetch, parseApiResponse, throwResponseError } from "./client.js";

export interface PromotionalCampaign {
	id: string;
	title: string;
	content: unknown[];
	media: { id: string; url: string; filename: string; alt: string | null } | null;
	buttonLabel: string | null;
	buttonUrl: string | null;
	pageScope: "all" | "home";
	isActive: boolean;
	startsAt: string | null;
	endsAt: string | null;
	createdAt: string;
	updatedAt: string;
	modalSize: "square" | "rectangle" | "custom";
	modalWidth: number | null;
	modalHeight: number | null;
}

export interface PromotionalCampaignInput {
	title: string;
	content: unknown[];
	mediaId?: string | null;
	buttonLabel?: string;
	buttonUrl?: string;
	pageScope: "all" | "home";
	isActive: boolean;
	startsAt?: string | null;
	endsAt?: string | null;
	modalSize: "square" | "rectangle" | "custom";
	modalWidth?: number | null;
	modalHeight?: number | null;
}

export async function fetchPromotionalCampaign(): Promise<PromotionalCampaign | null> {
	const response = await apiFetch(`${API_BASE}/promotional-campaign`);
	return parseApiResponse<PromotionalCampaign | null>(
		response,
		i18n._(msg`Failed to fetch promotional campaign`),
	);
}

export async function fetchPromotionalCampaigns(): Promise<PromotionalCampaign[]> {
	const response = await apiFetch(`${API_BASE}/promotional-campaign`);
	return parseApiResponse<PromotionalCampaign[]>(
		response,
		i18n._(msg`Failed to fetch promotional campaigns`),
	);
}

export async function savePromotionalCampaign(
	id: string | null,
	input: PromotionalCampaignInput,
): Promise<PromotionalCampaign> {
	const response = await apiFetch(`${API_BASE}/promotional-campaign${id ? `/${id}` : ""}`, {
		method: id ? "PUT" : "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	return parseApiResponse<PromotionalCampaign>(
		response,
		i18n._(msg`Failed to save promotional campaign`),
	);
}

export async function deletePromotionalCampaign(id: string): Promise<void> {
	const response = await apiFetch(`${API_BASE}/promotional-campaign/${id}`, { method: "DELETE" });
	if (!response.ok)
		await throwResponseError(response, i18n._(msg`Failed to delete promotional campaign`));
}

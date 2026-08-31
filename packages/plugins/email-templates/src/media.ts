export interface EmailMediaItem {
	id: string;
	filename: string;
	mimeType: string;
	url: string;
	storageKey?: string;
	width?: number;
	height?: number;
	alt?: string;
}

interface MediaListResponse {
	items: EmailMediaItem[];
	nextCursor?: string;
}

function isMediaListResponse(value: unknown): value is MediaListResponse {
	if (typeof value !== "object" || value === null) return false;
	return Array.isArray((value as { items?: unknown }).items);
}

/** Fetches the CMS gallery without coupling the plugin to the admin package. */
export async function fetchEmailMedia(options?: {
	cursor?: string;
	search?: string;
}): Promise<MediaListResponse> {
	const params = new URLSearchParams({ limit: "50", mimeType: "image/" });
	if (options?.cursor) params.set("cursor", options.cursor);
	if (options?.search) params.set("q", options.search.trim().slice(0, 200));
	const response = await fetch(`/_emdash/api/media?${params.toString()}`, {
		headers: { "X-EmDash-Request": "1" },
	});
	const body: unknown = await response.json().catch(() => undefined);
	const data =
		typeof body === "object" && body !== null && "data" in body
			? (body as { data?: unknown }).data
			: body;
	if (!response.ok || !isMediaListResponse(data)) {
		throw new Error("Unable to load the media gallery");
	}
	return data;
}

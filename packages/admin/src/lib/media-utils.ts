import type { MediaItem, MediaProviderItem } from "./api/media.js";

/** Read a string value from an untyped `meta` bag, or undefined. */
export function metaString(
	meta: Record<string, unknown> | undefined,
	key: string,
): string | undefined {
	const value = meta?.[key];
	return typeof value === "string" ? value : undefined;
}

export function providerItemToMediaItem(
	providerId: string,
	item: MediaProviderItem,
): MediaItem & { provider: string; meta?: Record<string, unknown> } {
	return {
		id: item.id,
		filename: item.filename,
		mimeType: item.mimeType,
		url: item.previewUrl || "",
		size: item.size || 0,
		width: item.width,
		height: item.height,
		// Prefer first-class fields; some providers stash LQIP in `meta`.
		blurhash: item.blurhash ?? metaString(item.meta, "blurhash"),
		dominantColor: item.dominantColor ?? metaString(item.meta, "dominantColor"),
		alt: item.alt,
		createdAt: new Date().toISOString(),
		provider: providerId,
		meta: item.meta,
	};
}

/**
 * Build a display URL for a media thumbnail in the admin grid/list views.
 *
 * The media API resolves local files to the configured public storage URL when
 * available (for example an R2 custom domain). Keep this helper as the single
 * display-URL policy, but do not transform admin thumbnails through the image
 * endpoint: that creates one Worker/image-transform request per visible item.
 *
 * The width argument remains accepted for callers that also render provider
 * media, but local and external URLs are returned unchanged.
 */
export function getMediaThumbnailUrl(
	originalUrl: string,
	_mimeType: string,
	_width?: number,
): string {
	return originalUrl;
}

/**
 * `onError` fallback for grid thumbnails. Guarded with a data attribute so a
 * failing original can't trigger a reload loop.
 */
export function fallbackToOriginalThumbnail(
	img: { dataset: DOMStringMap; src: string },
	originalUrl: string,
): void {
	if (img.dataset.thumbFallback) return;
	img.dataset.thumbFallback = "1";
	img.src = originalUrl;
}

export function getFileIcon(mimeType: string): string {
	if (mimeType.startsWith("video/")) return "🎬";
	if (mimeType.startsWith("audio/")) return "🎵";
	if (mimeType.includes("pdf")) return "📄";
	if (mimeType.includes("document") || mimeType.includes("word")) return "📝";
	if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
	return "📁";
}

export function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

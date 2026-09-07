import { Label, Loader } from "@cloudflare/kumo";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";

import { fetchMediaItem } from "../lib/api";
import { ImageFieldRenderer, type ImageFieldValue } from "./ImageFieldRenderer";

export function TaxonomyImageField({
	value,
	onChange,
}: {
	value: string | undefined;
	onChange: (imageId: string | null) => void;
}) {
	const { t } = useLingui();
	const { data: media, isLoading } = useQuery({
		queryKey: ["media", value],
		queryFn: () => (value ? fetchMediaItem(value) : Promise.resolve(null)),
		enabled: !!value,
	});

	if (value && isLoading) {
		return (
			<div>
				<Label>{t`Image`}</Label>
				<div className="mt-2 flex h-32 items-center justify-center rounded-lg border">
					<Loader />
				</div>
			</div>
		);
	}

	const fieldValue: ImageFieldValue | undefined =
		value && media
			? {
					id: media.id,
					provider: media.provider || "local",
					previewUrl: media.provider && media.provider !== "local" ? media.url : undefined,
					alt: media.alt ?? "",
					width: media.width,
					height: media.height,
					meta: media.storageKey ? { storageKey: media.storageKey } : undefined,
				}
			: undefined;

	return (
		<ImageFieldRenderer
			label={t`Image`}
			value={fieldValue}
			onChange={(next) => onChange(next?.id ?? null)}
		/>
	);
}

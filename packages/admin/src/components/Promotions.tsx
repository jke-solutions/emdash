import { Badge, Button, Input, Select, Switch, Toast } from "@cloudflare/kumo";
import { useLingui } from "@lingui/react/macro";
import { Megaphone, Pencil, Plus, Trash } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import {
	deletePromotionalCampaign,
	fetchPromotionalCampaigns,
	savePromotionalCampaign,
	type MediaItem,
	type PromotionalCampaign,
	type PromotionalCampaignInput,
} from "../lib/api";
import { ConfirmDialog } from "./ConfirmDialog";
import { MediaPickerModal } from "./MediaPickerModal";
import { PortableTextEditor } from "./PortableTextEditor";

function localDateTime(value: string | null): string {
	if (!value) return "";
	const date = new Date(value);
	return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function isoDateTime(value: string): string | null {
	return value ? new Date(value).toISOString() : null;
}

function campaignStatus(
	campaign: PromotionalCampaign,
): "active" | "scheduled" | "expired" | "inactive" {
	const now = Date.now();
	if (campaign.endsAt && Date.parse(campaign.endsAt) <= now) return "expired";
	if (campaign.isActive && campaign.startsAt && Date.parse(campaign.startsAt) > now)
		return "scheduled";
	return campaign.isActive ? "active" : "inactive";
}

export function Promotions() {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const toast = Toast.useToastManager();
	const [editing, setEditing] = React.useState<PromotionalCampaign | null>(null);
	const [creating, setCreating] = React.useState(false);
	const [selectedMedia, setSelectedMedia] = React.useState<MediaItem | null>(null);
	const [pickerOpen, setPickerOpen] = React.useState(false);
	const [deleteTarget, setDeleteTarget] = React.useState<PromotionalCampaign | null>(null);
	const { data: campaigns = [], isLoading } = useQuery({
		queryKey: ["promotional-campaigns"],
		queryFn: fetchPromotionalCampaigns,
	});
	const saveMutation = useMutation({
		mutationFn: ({ id, input }: { id: string | null; input: PromotionalCampaignInput }) =>
			savePromotionalCampaign(id, input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["promotional-campaigns"] });
			setEditing(null);
			setCreating(false);
			setSelectedMedia(null);
			toast.add({ title: t`Promotion saved` });
		},
		onError: (error: Error) =>
			toast.add({ title: t`Failed to save promotion`, description: error.message, type: "error" }),
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => deletePromotionalCampaign(id),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["promotional-campaigns"] });
			setDeleteTarget(null);
			toast.add({ title: t`Promotion deleted` });
		},
	});

	if (isLoading)
		return (
			<div className="flex h-64 items-center justify-center text-kumo-subtle">{t`Loading promotions...`}</div>
		);
	if (editing || creating) {
		return (
			<PromotionEditor
				campaign={editing}
				selectedMedia={selectedMedia}
				onPickImage={() => setPickerOpen(true)}
				onSelectImage={(item) => {
					setSelectedMedia(item);
					setPickerOpen(false);
				}}
				onCloseImagePicker={() => setPickerOpen(false)}
				onCancel={() => {
					setEditing(null);
					setCreating(false);
					setSelectedMedia(null);
				}}
				onSave={(input) => saveMutation.mutate({ id: editing?.id ?? null, input })}
				isSaving={saveMutation.isPending}
				pickerOpen={pickerOpen}
			/>
		);
	}
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold leading-tight">{t`Promotions`}</h1>
					<p className="mt-1 text-sm text-kumo-subtle">{t`Manage promotional popups for your site`}</p>
				</div>
				<Button icon={<Plus />} onClick={() => setCreating(true)}>{t`Create Promotion`}</Button>
			</div>
			{campaigns.length === 0 ? (
				<div className="rounded-lg border bg-kumo-base p-12 text-center">
					<Megaphone className="mx-auto mb-4 h-12 w-12 text-kumo-subtle" />
					<p className="text-kumo-subtle">{t`No promotions yet`}</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-lg border bg-kumo-base">
					<table className="w-full">
						<thead>
							<tr className="border-b bg-kumo-tint/50">
								<th className="px-4 py-3 text-start text-sm font-medium">{t`Promotion`}</th>
								<th className="px-4 py-3 text-start text-sm font-medium">{t`Location`}</th>
								<th className="px-4 py-3 text-start text-sm font-medium">{t`Status`}</th>
								<th className="px-4 py-3 text-end text-sm font-medium">{t`Actions`}</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-kumo-line">
							{campaigns.map((campaign) => (
								<PromotionRow
									key={campaign.id}
									campaign={campaign}
									onEdit={() => setEditing(campaign)}
									onDelete={() => setDeleteTarget(campaign)}
								/>
							))}
						</tbody>
					</table>
				</div>
			)}
			<MediaPickerModal
				open={pickerOpen}
				onOpenChange={setPickerOpen}
				localOnly
				mimeTypeFilters={["image/"]}
				title={t`Select promotion image`}
				onSelect={(item) => {
					setSelectedMedia(item);
					setPickerOpen(false);
				}}
			/>
			<ConfirmDialog
				open={deleteTarget !== null}
				onClose={() => setDeleteTarget(null)}
				title={t`Delete Promotion?`}
				description={t`This will delete the saved promotion.`}
				confirmLabel={t`Delete`}
				pendingLabel={t`Deleting...`}
				isPending={deleteMutation.isPending}
				error={deleteMutation.error}
				onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
			/>
		</div>
	);
}

function PromotionRow({
	campaign,
	onEdit,
	onDelete,
}: {
	campaign: PromotionalCampaign;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const { t } = useLingui();
	const status = campaignStatus(campaign);
	const label = {
		active: t`Active`,
		scheduled: t`Scheduled`,
		expired: t`Expired`,
		inactive: t`Inactive`,
	}[status];
	return (
		<tr>
			<td className="px-4 py-4">
				<div className="flex items-center gap-3">
					{campaign.media && (
						<img src={campaign.media.url} alt="" className="h-12 w-12 rounded object-cover" />
					)}
					<div>
						<p className="font-medium">{campaign.title}</p>
						<p className="text-sm text-kumo-subtle">
							{campaign.endsAt
								? t`Until ${new Date(campaign.endsAt).toLocaleDateString()}`
								: t`No end date`}
						</p>
					</div>
				</div>
			</td>
			<td className="px-4 py-4 text-sm">
				{campaign.pageScope === "home" ? t`Home only` : t`All pages`}
			</td>
			<td className="px-4 py-4">
				<Badge variant={status === "active" ? "primary" : "outline"}>{label}</Badge>
			</td>
			<td className="px-4 py-4">
				<div className="flex justify-end gap-1">
					<Button
						variant="ghost"
						shape="square"
						onClick={onEdit}
						aria-label={t`Edit ${campaign.title}`}
					>
						<Pencil />
					</Button>
					<Button
						variant="ghost"
						shape="square"
						onClick={onDelete}
						aria-label={t`Delete ${campaign.title}`}
					>
						<Trash className="text-kumo-danger" />
					</Button>
				</div>
			</td>
		</tr>
	);
}

function PromotionEditor({
	campaign,
	selectedMedia,
	onPickImage,
	onSelectImage,
	onCloseImagePicker,
	onCancel,
	onSave,
	isSaving,
	pickerOpen,
}: {
	campaign: PromotionalCampaign | null;
	selectedMedia: MediaItem | null;
	onPickImage: () => void;
	onSelectImage: (item: MediaItem) => void;
	onCloseImagePicker: () => void;
	onCancel: () => void;
	onSave: (input: PromotionalCampaignInput) => void;
	isSaving: boolean;
	pickerOpen: boolean;
}) {
	const { t } = useLingui();
	const [title, setTitle] = React.useState(campaign?.title ?? "");
	const [content, setContent] = React.useState<unknown[]>(campaign?.content ?? []);
	const [media, setMedia] = React.useState(campaign?.media ?? null);
	const [buttonLabel, setButtonLabel] = React.useState(campaign?.buttonLabel ?? "");
	const [buttonUrl, setButtonUrl] = React.useState(campaign?.buttonUrl ?? "");
	const [pageScope, setPageScope] = React.useState<"all" | "home">(campaign?.pageScope ?? "all");
	const [isActive, setIsActive] = React.useState(campaign?.isActive ?? false);
	const [startsAt, setStartsAt] = React.useState(localDateTime(campaign?.startsAt ?? null));
	const [endsAt, setEndsAt] = React.useState(localDateTime(campaign?.endsAt ?? null));
	const [modalSize, setModalSize] = React.useState<"square" | "rectangle" | "custom">(
		campaign?.modalSize ?? "rectangle",
	);
	const [modalWidth, setModalWidth] = React.useState(String(campaign?.modalWidth ?? 640));
	const [modalHeight, setModalHeight] = React.useState(String(campaign?.modalHeight ?? 480));
	React.useEffect(() => {
		if (selectedMedia)
			setMedia({
				id: selectedMedia.id,
				url: selectedMedia.url,
				filename: selectedMedia.filename,
				alt: selectedMedia.alt ?? null,
			});
	}, [selectedMedia]);
	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		onSave({
			title,
			content,
			mediaId: media?.id ?? null,
			buttonLabel: buttonLabel || undefined,
			buttonUrl: buttonUrl || undefined,
			pageScope,
			isActive,
			startsAt: isoDateTime(startsAt),
			endsAt: isoDateTime(endsAt),
			modalSize,
			modalWidth: modalSize === "custom" ? Number(modalWidth) : null,
			modalHeight: modalSize === "custom" ? Number(modalHeight) : null,
		});
	};
	return (
		<>
			<form onSubmit={submit} className="space-y-6">
				<div className="rounded-lg border bg-kumo-base p-6 space-y-4">
					<Input
						label={t`Title`}
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						required
					/>
					<div>
						<label className="mb-2 block text-sm font-medium">{t`Promotional text`}</label>
						<PortableTextEditor
							value={content as Parameters<typeof PortableTextEditor>[0]["value"]}
							onChange={setContent}
							minimal
							placeholder={t`Write your discount or promotional code...`}
						/>
					</div>
					<div>
						<p className="mb-2 block text-sm font-medium">{t`Image (optional)`}</p>
						{media ? (
							<div className="flex items-center gap-3">
								<img
									src={media.url}
									alt={media.alt ?? ""}
									className="h-20 w-20 rounded object-cover"
								/>
								<span className="text-sm text-kumo-subtle">{media.filename}</span>
								<Button type="button" variant="outline" onClick={onPickImage}>{t`Replace`}</Button>
							</div>
						) : (
							<Button
								type="button"
								variant="outline"
								onClick={onPickImage}
							>{t`Select image`}</Button>
						)}
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<Input
							label={t`Button label (optional)`}
							value={buttonLabel}
							onChange={(event) => setButtonLabel(event.target.value)}
						/>
						<Input
							label={t`Button URL (optional)`}
							type="url"
							value={buttonUrl}
							onChange={(event) => setButtonUrl(event.target.value)}
						/>
					</div>
					<Select
						label={t`Show on`}
						value={pageScope}
						onValueChange={(value) => setPageScope((value as "all" | "home") ?? "all")}
						items={{ all: t`All pages`, home: t`Home page only` }}
					/>
					<Select
						label={t`Modal size`}
						value={modalSize}
						onValueChange={(value) =>
							setModalSize((value as "square" | "rectangle" | "custom") ?? "rectangle")
						}
						items={{ rectangle: t`Rectangle`, square: t`Square`, custom: t`Custom` }}
					/>
					{modalSize === "custom" && (
						<div className="grid gap-4 sm:grid-cols-2">
							<Input
								label={t`Width (px)`}
								type="number"
								min={280}
								max={1200}
								value={modalWidth}
								onChange={(event) => setModalWidth(event.target.value)}
								required
							/>
							<Input
								label={t`Height (px)`}
								type="number"
								min={280}
								max={1200}
								value={modalHeight}
								onChange={(event) => setModalHeight(event.target.value)}
								required
							/>
						</div>
					)}
					<div className="grid gap-4 sm:grid-cols-2">
						<Input
							label={t`Start date and time (optional)`}
							type="datetime-local"
							value={startsAt}
							onChange={(event) => setStartsAt(event.target.value)}
						/>
						<Input
							label={t`End date and time (optional)`}
							type="datetime-local"
							value={endsAt}
							onChange={(event) => setEndsAt(event.target.value)}
						/>
					</div>
					<Switch checked={isActive} onCheckedChange={setIsActive} label={t`Campaign active`} />
				</div>
				<div className="flex justify-end gap-2">
					<Button type="button" variant="outline" onClick={onCancel}>{t`Cancel`}</Button>
					<Button type="submit" disabled={!title || isSaving} loading={isSaving}>{t`Save`}</Button>
				</div>
			</form>
			<MediaPickerModal
				open={pickerOpen}
				onOpenChange={(open) => {
					if (!open) onCloseImagePicker();
				}}
				localOnly
				mimeTypeFilters={["image/"]}
				title={t`Select promotion image`}
				onSelect={onSelectImage}
			/>
		</>
	);
}

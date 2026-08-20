import { Button, Dialog, Input, Label, Loader, Select } from "@cloudflare/kumo";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { ArrowClockwise, ArrowCounterClockwise } from "@phosphor-icons/react";
import * as React from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

import {
	EDITABLE_IMAGE_TYPES,
	isEditableImage,
	optimizeImage,
	type OptimizedImageResult,
} from "../lib/image-processing.js";
import { formatFileSize } from "../lib/media-utils.js";

export interface ImageEditorProps {
	open: boolean;
	file: File | null;
	onOpenChange: (open: boolean) => void;
	onApply: (result: OptimizedImageResult) => void;
	aspect?: number | "free";
}

const ASPECT_OPTIONS = [
	{ value: "free", label: msg`Free` },
	{ value: "1", label: msg`1:1` },
	{ value: "1.333333", label: msg`4:3` },
	{ value: "1.777778", label: msg`16:9` },
] as const;

const DEFAULT_OPTIMIZATION = {
	maxSizeMB: 1,
	maxWidthOrHeight: 1920,
	initialQuality: 0.82,
};

export function ImageEditor({
	open,
	file,
	onOpenChange,
	onApply,
	aspect: initialAspect = "free",
}: ImageEditorProps) {
	const { t } = useLingui();
	const [crop, setCrop] = React.useState({ x: 0, y: 0 });
	const [zoom, setZoom] = React.useState(1);
	const [rotation, setRotation] = React.useState(0);
	const [aspect, setAspect] = React.useState<number | "free">(initialAspect);
	const [cropAreaPixels, setCropAreaPixels] = React.useState<Area | null>(null);
	const [originalPreviewUrl, setOriginalPreviewUrl] = React.useState<string | null>(null);
	const [optimizedPreviewUrl, setOptimizedPreviewUrl] = React.useState<string | null>(null);
	const [result, setResult] = React.useState<OptimizedImageResult | null>(null);
	const [isProcessing, setIsProcessing] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [optimization, setOptimization] = React.useState(DEFAULT_OPTIMIZATION);

	React.useEffect(() => {
		if (!file) {
			setOriginalPreviewUrl(null);
			return;
		}

		const url = URL.createObjectURL(file);
		setOriginalPreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);

	React.useEffect(() => {
		return () => {
			if (optimizedPreviewUrl) URL.revokeObjectURL(optimizedPreviewUrl);
		};
	}, [optimizedPreviewUrl]);

	React.useEffect(() => {
		if (!open) return;
		setCrop({ x: 0, y: 0 });
		setZoom(1);
		setRotation(0);
		setAspect(initialAspect);
		setCropAreaPixels(null);
		setResult(null);
		setError(null);
		setOptimizedPreviewUrl(null);
		setOptimization(DEFAULT_OPTIMIZATION);
	}, [file, initialAspect, open]);

	const handleOptimize = async (skipCrop = false) => {
		if (!file) return;
		if (!isEditableImage(file)) {
			setError(
				t`This image format cannot be edited. Supported formats: ${EDITABLE_IMAGE_TYPES.join(", ")}.`,
			);
			return;
		}

		setIsProcessing(true);
		setError(null);
		try {
			const optimized = await optimizeImage(file, {
				cropAreaPixels: skipCrop ? undefined : (cropAreaPixels ?? undefined),
				rotation: skipCrop ? 0 : rotation,
				maxSizeMB: optimization.maxSizeMB,
				maxWidthOrHeight: optimization.maxWidthOrHeight,
				initialQuality: optimization.initialQuality,
			});
			setResult(optimized);
			setOptimizedPreviewUrl(URL.createObjectURL(optimized.file));
		} catch {
			setError(t`The image could not be processed. Please try another image.`);
		} finally {
			setIsProcessing(false);
		}
	};

	const handleApply = () => {
		if (result) onApply(result);
	};

	const resetResult = () => {
		setResult(null);
		setOptimizedPreviewUrl(null);
	};
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange} disablePointerDismissal>
			<Dialog className="p-6 max-w-6xl" size="xl">
				<Dialog.Title className="text-lg font-semibold">{t`Edit image`}</Dialog.Title>
				<Dialog.Description className="text-kumo-subtle">
					{t`Crop and optimize this image before uploading it.`}
				</Dialog.Description>

				<div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
					<div className="min-w-0">
						<div className="relative min-h-96 h-[min(65vh,36rem)] overflow-hidden rounded-md bg-kumo-canvas">
							{originalPreviewUrl && !result && (
								<Cropper
									image={originalPreviewUrl}
									crop={crop}
									zoom={zoom}
									rotation={rotation}
									aspect={aspect === "free" ? undefined : aspect}
									onCropChange={setCrop}
									onZoomChange={setZoom}
									onRotationChange={setRotation}
									onCropComplete={(_, pixels) => setCropAreaPixels(pixels)}
								/>
							)}
							{optimizedPreviewUrl && result && (
								<img
									src={optimizedPreviewUrl}
									alt={t`Optimized image preview`}
									className="h-full w-full object-contain"
								/>
							)}
						</div>

						{result && file && (
							<div className="mt-3 grid gap-3 sm:grid-cols-2" aria-live="polite">
								<ComparisonStat label={t`Original`} value={formatFileSize(file.size)} />
								<ComparisonStat
									label={t`Optimized WebP`}
									value={formatFileSize(result.optimizedSize)}
								/>
							</div>
						)}
					</div>

					<div className="flex flex-col gap-4">
						{result ? (
							<div className="rounded-md border border-kumo-line p-4">
								<div className="text-sm font-medium">{t`Optimization settings`}</div>
								<div className="mt-2 grid gap-2 text-sm text-kumo-subtle">
									<div className="flex justify-between gap-3">
										<span>{t`Format`}</span>
										<span className="font-medium text-kumo-default">WebP</span>
									</div>
									<div className="flex justify-between gap-3">
										<span>{t`Quality`}</span>
										<span className="font-medium text-kumo-default">
											{Math.round(optimization.initialQuality * 100)}%
										</span>
									</div>
									<div className="flex justify-between gap-3">
										<span>{t`Maximum dimensions`}</span>
										<span className="font-medium text-kumo-default">
											{optimization.maxWidthOrHeight}px
										</span>
									</div>
									<div className="flex justify-between gap-3">
										<span>{t`Maximum file size`}</span>
										<span className="font-medium text-kumo-default">
											{optimization.maxSizeMB} MB
										</span>
									</div>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="mt-4"
									onClick={resetResult}
								>
									{t`Adjust optimization`}
								</Button>
							</div>
						) : (
							<>
								<div>
									<Label htmlFor="image-editor-aspect">{t`Aspect ratio`}</Label>
									<Select
										id="image-editor-aspect"
										value={String(aspect)}
										onValueChange={(value) => setAspect(value === "free" ? "free" : Number(value))}
									>
										{ASPECT_OPTIONS.map((option) => (
											<Select.Option key={option.value} value={option.value}>
												{t(option.label)}
											</Select.Option>
										))}
									</Select>
								</div>

								<div>
									<Label htmlFor="image-editor-zoom">
										{t`Zoom:`} {zoom.toFixed(1)}x
									</Label>
									<input
										id="image-editor-zoom"
										type="range"
										min="1"
										max="5"
										step="0.1"
										value={zoom}
										onChange={(event) => setZoom(Number(event.target.value))}
										className="w-full"
										aria-valuetext={t`${zoom.toFixed(1)} times`}
									/>
								</div>

								<div>
									<Label>
										{t`Rotation:`} {rotation}°
									</Label>
									<div className="flex gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											icon={<ArrowCounterClockwise />}
											onClick={() => setRotation((value) => (value - 90 + 360) % 360)}
										>
											{t`Rotate left`}
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											icon={<ArrowClockwise />}
											onClick={() => setRotation((value) => (value + 90) % 360)}
										>
											{t`Rotate right`}
										</Button>
									</div>
								</div>

								<div className="rounded-md border border-kumo-line p-4">
									<div className="text-sm font-medium">{t`Optimization settings`}</div>
									<p className="mt-1 text-xs text-kumo-subtle">{t`Customize the WebP result for your website.`}</p>

									<div className="mt-4">
										<Label htmlFor="image-editor-quality">
											{t`Quality:`} {Math.round(optimization.initialQuality * 100)}%
										</Label>
										<input
											id="image-editor-quality"
											type="range"
											min="50"
											max="100"
											step="1"
											value={Math.round(optimization.initialQuality * 100)}
											onChange={(event) =>
												setOptimization((current) => ({
													...current,
													initialQuality: Number(event.target.value) / 100,
												}))
											}
											className="w-full"
										/>
									</div>

									<div className="mt-3">
										<Label htmlFor="image-editor-max-dimension">{t`Maximum width or height`}</Label>
										<Input
											id="image-editor-max-dimension"
											type="number"
											min="320"
											max="7680"
											step="1"
											value={optimization.maxWidthOrHeight}
											onChange={(event) =>
												setOptimization((current) => ({
													...current,
													maxWidthOrHeight: Math.min(
														7680,
														Math.max(320, Number(event.target.value) || 320),
													),
												}))
											}
										/>
									</div>

									<div className="mt-3">
										<Label htmlFor="image-editor-max-size">{t`Maximum file size (MB)`}</Label>
										<Input
											id="image-editor-max-size"
											type="number"
											min="0.1"
											max="10"
											step="0.1"
											value={optimization.maxSizeMB}
											onChange={(event) =>
												setOptimization((current) => ({
													...current,
													maxSizeMB: Math.min(10, Math.max(0.1, Number(event.target.value) || 0.1)),
												}))
											}
										/>
									</div>
								</div>
							</>
						)}
					</div>
				</div>

				{error && <p className="mt-3 text-sm text-kumo-danger">{error}</p>}

				<div className="mt-6 flex justify-end gap-2">
					<Button
						type="button"
						variant="secondary"
						onClick={() => onOpenChange(false)}
						disabled={isProcessing}
					>
						{t`Cancel`}
					</Button>
					{result ? (
						<Button type="button" onClick={handleApply} disabled={isProcessing}>
							{t`Use optimized image`}
						</Button>
					) : (
						<div className="flex flex-wrap justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => void handleOptimize(true)}
								disabled={isProcessing || !file}
							>
								{t`Optimize only`}
							</Button>
							<Button
								type="button"
								onClick={() => void handleOptimize()}
								disabled={isProcessing || !file}
							>
								{isProcessing && <Loader size="sm" />}
								{isProcessing ? t`Processing...` : t`Preview optimization`}
							</Button>
						</div>
					)}
				</div>
			</Dialog>
		</Dialog.Root>
	);
}

function ComparisonStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border border-kumo-line p-3">
			<div className="text-xs text-kumo-subtle">{label}</div>
			<div className="font-medium">{value}</div>
		</div>
	);
}

export default ImageEditor;

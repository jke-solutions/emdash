import imageCompression from "browser-image-compression";

export interface CropAreaPixels {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ImageProcessingOptions {
	cropAreaPixels?: CropAreaPixels;
	rotation?: number;
	maxSizeMB?: number;
	maxWidthOrHeight?: number;
	initialQuality?: number;
}

export interface OptimizedImageResult {
	file: File;
	width: number;
	height: number;
	originalSize: number;
	optimizedSize: number;
	compressionPercentage: number;
	wasOptimized: boolean;
}

export const EDITABLE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const FILE_EXTENSION_PATTERN = /\.[^./\\]+$/;

export function isEditableImage(file: File): boolean {
	return EDITABLE_IMAGE_TYPES.includes(file.type as (typeof EDITABLE_IMAGE_TYPES)[number]);
}

export function replaceFileExtension(filename: string, extension: string): string {
	const baseName = filename.replace(FILE_EXTENSION_PATTERN, "");
	return `${baseName || "image"}.${extension}`;
}

export async function optimizeImage(
	file: File,
	options: ImageProcessingOptions = {},
): Promise<OptimizedImageResult> {
	if (!isEditableImage(file)) {
		throw new Error("Unsupported image type");
	}

	const image = await loadImage(file);
	const rotation = options.rotation ?? 0;
	const crop = options.cropAreaPixels ?? fullImageCrop(image.naturalWidth, image.naturalHeight);
	const croppedBlob = await createCroppedBlob(image, crop, rotation);
	const croppedFile = new File([croppedBlob], replaceFileExtension(file.name, "webp"), {
		type: "image/webp",
		lastModified: file.lastModified,
	});

	const compressedFile = await imageCompression(croppedFile, {
		maxSizeMB: options.maxSizeMB ?? 1,
		maxWidthOrHeight: options.maxWidthOrHeight ?? 1920,
		fileType: "image/webp",
		initialQuality: options.initialQuality ?? 0.82,
		useWebWorker: true,
	});

	const optimizedFile = new File([compressedFile], croppedFile.name, {
		type: "image/webp",
		lastModified: file.lastModified,
	});
	const dimensions = await getImageDimensions(optimizedFile);
	const compressionPercentage = Math.max(0, ((file.size - optimizedFile.size) / file.size) * 100);

	return {
		file: optimizedFile,
		width: dimensions.width,
		height: dimensions.height,
		originalSize: file.size,
		optimizedSize: optimizedFile.size,
		compressionPercentage,
		wasOptimized: optimizedFile.size < file.size,
	};
}

function fullImageCrop(width: number, height: number): CropAreaPixels {
	return { x: 0, y: 0, width, height };
}

async function loadImage(file: File): Promise<HTMLImageElement> {
	const url = URL.createObjectURL(file);
	try {
		const image = new Image();
		image.decoding = "async";
		image.src = url;
		await image.decode();
		return image;
	} finally {
		URL.revokeObjectURL(url);
	}
}

async function createCroppedBlob(
	image: HTMLImageElement,
	crop: CropAreaPixels,
	rotation: number,
): Promise<Blob> {
	const rotatedSize = getRotatedSize(image.naturalWidth, image.naturalHeight, rotation);
	const rotatedCanvas = document.createElement("canvas");
	rotatedCanvas.width = rotatedSize.width;
	rotatedCanvas.height = rotatedSize.height;

	const rotatedContext = rotatedCanvas.getContext("2d");
	if (!rotatedContext) throw new Error("Canvas is not available");

	rotatedContext.translate(rotatedSize.width / 2, rotatedSize.height / 2);
	rotatedContext.rotate((rotation * Math.PI) / 180);
	rotatedContext.translate(-image.naturalWidth / 2, -image.naturalHeight / 2);
	rotatedContext.drawImage(image, 0, 0);

	const outputCanvas = document.createElement("canvas");
	outputCanvas.width = Math.max(1, Math.round(crop.width));
	outputCanvas.height = Math.max(1, Math.round(crop.height));
	const outputContext = outputCanvas.getContext("2d");
	if (!outputContext) throw new Error("Canvas is not available");

	outputContext.drawImage(
		rotatedCanvas,
		Math.round(crop.x),
		Math.round(crop.y),
		Math.round(crop.width),
		Math.round(crop.height),
		0,
		0,
		outputCanvas.width,
		outputCanvas.height,
	);

	const blob = await canvasToBlob(outputCanvas);
	rotatedCanvas.width = 1;
	rotatedCanvas.height = 1;
	outputCanvas.width = 1;
	outputCanvas.height = 1;
	return blob;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error("Could not create image blob"));
		}, "image/webp");
	});
}

function getRotatedSize(width: number, height: number, rotation: number): { width: number; height: number } {
	const radians = (rotation * Math.PI) / 180;
	return {
		width: Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height),
		height: Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height),
	};
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve({ width: image.naturalWidth, height: image.naturalHeight });
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("Could not read optimized image dimensions"));
		};
		image.src = url;
	});
}

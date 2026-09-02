import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface ImageModifications {
  cropRatio: string;
  cropPercent: number;
  cropBox: { left: number; top: number; width: number; height: number };
  rotationAngle: string;
  rotationDegrees: number;
  brightness: string;
  brightnessFactor: number;
  saturation: string;
  saturationFactor: number;
  contrast: string;
  contrastFactor: number;
  outputFormat: string;
  processedAt: string;
}

export interface TransformResult {
  success: boolean;
  originalUrl: string;
  transformedUrl: string;
  storageProvider: 'supabase' | 'server_cache' | 'data_url';
  width: number;
  height: number;
  fileSize: number;
  modifications: ImageModifications;
  fileName: string;
}

// Local cache directory fallback if Supabase is temporarily unreachable
const LOCAL_CACHE_DIR = path.join(process.cwd(), 'public', 'transformed-images');
try {
  if (!fs.existsSync(LOCAL_CACHE_DIR)) {
    fs.mkdirSync(LOCAL_CACHE_DIR, { recursive: true });
  }
} catch (e) {
  // Ignore
}

/**
 * Applies random crop (90-95%), brightness/saturation/contrast adjustment (±5-10%),
 * and micro-rotation (within 1 degree) to make the image visually distinct from the original.
 */
export async function transformImageWithSharp(
  imageBuffer: Buffer,
  options?: {
    format?: 'webp' | 'jpeg';
    quality?: number;
  }
): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  modifications: ImageModifications;
}> {
  const format = options?.format || 'webp';
  const quality = options?.quality || 92;

  // 1. Inspect original image metadata
  const originalMeta = await sharp(imageBuffer).metadata();
  const origW = originalMeta.width || 1200;
  const origH = originalMeta.height || 800;

  // 2. Generate random parameters
  // A. Rotation within ±0.8 degrees (strictly <= 1.0 degree)
  const rotSign = Math.random() < 0.5 ? -1 : 1;
  const rotationDegrees = Number(((0.15 + Math.random() * 0.65) * rotSign).toFixed(2));

  // B. Random crop: 90% ~ 95% of original dimensions
  const cropPercent = Number((90 + Math.random() * 5).toFixed(1)); // 90.0% to 95.0%
  const cropRatio = cropPercent / 100;
  const targetW = Math.max(100, Math.floor(origW * cropRatio));
  const targetH = Math.max(100, Math.floor(origH * cropRatio));

  // Random offset for crop position
  const maxOffsetX = Math.max(0, origW - targetW);
  const maxOffsetY = Math.max(0, origH - targetH);
  const cropLeft = Math.floor(Math.random() * maxOffsetX);
  const cropTop = Math.floor(Math.random() * maxOffsetY);

  // C. Brightness adjustment: ±5% ~ ±10%
  const bSign = Math.random() < 0.5 ? -1 : 1;
  const bDelta = (0.05 + Math.random() * 0.05) * bSign;
  const brightnessFactor = Number((1 + bDelta).toFixed(3));

  // D. Saturation adjustment: ±5% ~ ±10%
  const sSign = Math.random() < 0.5 ? -1 : 1;
  const sDelta = (0.05 + Math.random() * 0.05) * sSign;
  const saturationFactor = Number((1 + sDelta).toFixed(3));

  // E. Contrast adjustment: ±5% ~ ±10%
  const cSign = Math.random() < 0.5 ? -1 : 1;
  const cDelta = (0.05 + Math.random() * 0.05) * cSign;
  const contrastFactor = Number((1 + cDelta).toFixed(3));
  const contrastOffset = -(128 * contrastFactor) + 128; // Midpoint-preserving linear contrast

  // 3. Execute sharp transformation pipeline
  let pipeline = sharp(imageBuffer);

  // Step 1: Rotate with white/neutral background
  if (Math.abs(rotationDegrees) > 0.05) {
    pipeline = pipeline.rotate(rotationDegrees, {
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    });
  }

  // Step 2: Brightness & Saturation modulation
  pipeline = pipeline.modulate({
    brightness: brightnessFactor,
    saturation: saturationFactor,
  });

  // Step 3: Midpoint-preserving Contrast adjustment
  pipeline = pipeline.linear(contrastFactor, contrastOffset);

  // Step 4: Extract / Crop within rotated boundaries
  pipeline = pipeline.extract({
    left: cropLeft,
    top: cropTop,
    width: targetW,
    height: targetH,
  });

  // Step 5: Strip metadata (EXIF/GPS/ICC) and encode
  if (format === 'webp') {
    pipeline = pipeline.webp({ quality, effort: 4 });
  } else {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  }

  const processedBuffer = await pipeline.toBuffer();
  const finalMeta = await sharp(processedBuffer).metadata();

  const modifications: ImageModifications = {
    cropRatio: `${cropPercent}%`,
    cropPercent,
    cropBox: { left: cropLeft, top: cropTop, width: targetW, height: targetH },
    rotationAngle: `${rotationDegrees > 0 ? '+' : ''}${rotationDegrees}°`,
    rotationDegrees,
    brightness: `${bDelta > 0 ? '+' : ''}${(bDelta * 100).toFixed(1)}%`,
    brightnessFactor,
    saturation: `${sDelta > 0 ? '+' : ''}${(sDelta * 100).toFixed(1)}%`,
    saturationFactor,
    contrast: `${cDelta > 0 ? '+' : ''}${(cDelta * 100).toFixed(1)}%`,
    contrastFactor,
    outputFormat: format,
    processedAt: new Date().toISOString(),
  };

  return {
    buffer: processedBuffer,
    width: finalMeta.width || targetW,
    height: finalMeta.height || targetH,
    modifications,
  };
}

/**
 * Downloads an Unsplash image from URL, applies unique random modifications via sharp,
 * and uploads to Supabase Storage (or fallback server cache), returning a fresh URL every time.
 */
export async function processAndUploadUnsplashImage(
  sourceUrl: string,
  supabaseClient: any,
  options?: {
    userId?: string;
    draftId?: string;
    format?: 'webp' | 'jpeg';
    quality?: number;
  }
): Promise<TransformResult> {
  const cleanUrl = (sourceUrl || '').trim();
  if (!cleanUrl) {
    throw new Error('Image URL is required for transformation');
  }

  // 1. Fetch original image binary
  const response = await fetch(cleanUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download image from source URL (status ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  // 2. Transform with sharp
  const format = options?.format || 'webp';
  const { buffer: processedBuffer, width, height, modifications } = await transformImageWithSharp(inputBuffer, {
    format,
    quality: options?.quality || 92,
  });

  // 3. Generate unique random filename
  const uniqueId = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const fileName = `unsplash_unique_${uniqueId}.${format}`;
  const contentType = format === 'webp' ? 'image/webp' : 'image/jpeg';

  let transformedUrl: string | null = null;
  let storageProvider: 'supabase' | 'server_cache' | 'data_url' = 'server_cache';

  // 4. Upload to Supabase Storage if client is available
  if (supabaseClient && typeof supabaseClient.storage?.from === 'function') {
    try {
      const bucketName = 'ai-drafts';
      
      // Auto-create bucket if missing
      try {
        const { data: buckets } = await supabaseClient.storage.listBuckets();
        const exists = Array.isArray(buckets) && buckets.some((b: any) => b.name === bucketName);
        if (!exists) {
          await supabaseClient.storage.createBucket(bucketName, { public: true });
        }
      } catch (bErr) {
        // Bucket list/create error can happen with limited role, continue upload attempt
      }

      const dateFolder = new Date().toISOString().slice(0, 10);
      const userFolder = options?.userId || 'public';
      const storagePath = `processed-unsplash/${userFolder}/${dateFolder}/${fileName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from(bucketName)
        .upload(storagePath, processedBuffer, {
          contentType,
          upsert: true,
        });

      if (!uploadError) {
        const { data: publicData } = supabaseClient.storage.from(bucketName).getPublicUrl(storagePath);
        if (publicData?.publicUrl) {
          transformedUrl = publicData.publicUrl;
          storageProvider = 'supabase';
        }
      } else {
        console.warn('[Supabase Storage Upload Warning]:', uploadError.message);
      }
    } catch (supErr: any) {
      console.warn('[Supabase Storage Exception]:', supErr.message || supErr);
    }
  }

  // 5. Fallback 1: Local server static cache file (publicly served via Express static)
  if (!transformedUrl) {
    try {
      const localFilePath = path.join(LOCAL_CACHE_DIR, fileName);
      fs.writeFileSync(localFilePath, processedBuffer);
      transformedUrl = `/transformed-images/${fileName}`;
      storageProvider = 'server_cache';
    } catch (fsErr) {
      // Fallback 2: Data URL
      transformedUrl = `data:${contentType};base64,${processedBuffer.toString('base64')}`;
      storageProvider = 'data_url';
    }
  }

  return {
    success: true,
    originalUrl: cleanUrl,
    transformedUrl,
    storageProvider,
    width,
    height,
    fileSize: processedBuffer.length,
    modifications,
    fileName,
  };
}

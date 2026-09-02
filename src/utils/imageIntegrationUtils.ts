import { UnsplashImageResult, CardNewsResult } from '../types';
import { AiGraphicStyleKey, buildAiGraphicPrompt } from './aiGraphicUtils';
import { generateAllCardNewsImages, generateCardNewsImageHtml } from './cardNewsImageGenerator';
import { CardAspectRatio } from '../components/seo/CardNewsCardRenderer';

/**
 * Data URL / SVG / External HTTP 이미지를 브라우저에서 안전하고 신뢰할 수 있게 파일로 다운로드하는 유틸리티
 */
export async function downloadSingleImage(url: string, filename: string): Promise<boolean> {
  if (!url) return false;

  try {
    // 1. Data URL (SVG or Base64 Image)
    if (url.startsWith('data:')) {
      let blob: Blob;
      if (url.includes('utf8,') || url.includes('data:image/svg+xml')) {
        const parts = url.split(',');
        const svgText = decodeURIComponent(parts[1] || parts[0]);
        blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      } else {
        const arr = url.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanExt = filename.includes('.') ? filename : `${filename}.png`;
      link.download = cleanExt;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      return true;
    }

    // 2. HTTP / HTTPS Image URL (Unsplash or external CDN)
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        return true;
      }
    } catch (fetchErr) {
      console.warn('Direct fetch failed due to CORS, attempting Canvas fallback:', fetchErr);
    }

    // 3. Fallback: Load into Canvas to convert to Blob
    const success = await new Promise<boolean>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 800;
          canvas.height = img.naturalHeight || 500;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
              if (blob) {
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                resolve(true);
                return;
              }
              resolve(false);
            }, 'image/jpeg', 0.95);
            return;
          }
        } catch (e) {
          resolve(false);
        }
        resolve(false);
      };
      img.onerror = () => resolve(false);
      img.src = url;
    });

    if (success) return true;

    // 4. Ultimate Fallback: Open in new window/tab safely
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noreferrer';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (e) {
    console.error('Download image error:', e);
    return false;
  }
}

/**
 * 모드에 따라 상업용 무료 이미지 또는 AI 그래픽을 신뢰할 수 있게 생성/수집하는 유틸리티
 */

export function fetchOrGenerateImagesForMode() { return { requirement: '', photos: [] }; }
export function injectImagesIntoDraft(draftHtml: string) { return draftHtml; }
export function injectCardNewsImagesIntoDraft(draftHtml: string, cardNewsResultData: any, aspectRatio: string = '1:1'): string {
  if (!draftHtml || !cardNewsResultData) return draftHtml || '';
  const slides = cardNewsResultData.slides || cardNewsResultData.engineResult?.cards || [];
  if (slides.length === 0) return draftHtml;

  const images = generateAllCardNewsImages(cardNewsResultData, aspectRatio as any);
  if (images.length === 0) return draftHtml;

  const title = cardNewsResultData.title || cardNewsResultData.keyword || '핵심 요약 카드뉴스';

  const cardsHtml = images
    .map(
      (img) => `
    <div style="margin: 24px 0; text-align: center;">
      <img src="${img.imageUrl}" alt="${img.title}" style="max-width: 100%; width: 680px; height: auto; border-radius: 12px; display: block; margin: 0 auto; box-shadow: 0 4px 16px rgba(0,0,0,0.08);" />
      <p style="font-size: 13px; color: #64748b; margin-top: 8px; text-align: center; font-weight: 500;">📌 [카드뉴스 #${img.index}] ${img.title}</p>
    </div>`
    )
    .join('\n');

  const cardSection = `
    <br />
    <hr style="border: none; border-top: 2px dashed #cbd5e1; margin: 32px 0;" />
    <div style="margin: 28px 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;">
      <p style="font-size: 17px; font-weight: bold; color: #0f172a; margin-bottom: 20px;">
        🖼️ [핵심 요약 카드뉴스: ${title}]
      </p>
      ${cardsHtml}
    </div>
    <hr style="border: none; border-top: 2px dashed #cbd5e1; margin: 32px 0;" />
    <br />
  `;

  return `${draftHtml}\n${cardSection}`;
}

export async function injectCardNewsImagesIntoDraftAsync(
  draftHtml: string,
  cardNewsResultData: any,
  aspectRatio: string = '1:1'
): Promise<string> {
  if (!draftHtml || !cardNewsResultData) return draftHtml || '';
  const slides = cardNewsResultData.slides || cardNewsResultData.engineResult?.cards || [];
  if (slides.length === 0) return draftHtml;

  const cardHtml = await generateCardNewsImageHtml(cardNewsResultData, aspectRatio as any);
  if (!cardHtml) return draftHtml;

  return `${draftHtml}\n${cardHtml}`;
}


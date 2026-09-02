import { CardNewsResult, CardNewsItem } from '../types';
import {
  CardNewsCard,
  CardNewsStyle,
  CardAspectRatio,
  createCardDesign,
  CardDesign,
  CardElement,
} from '../components/seo/CardNewsCardRenderer';
import { stripInternalImageGuides } from './imagePipeline';

/**
 * Escapes XML/SVG special characters safely for SVG text rendering
 */
function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Splits text into multiple wrapped lines for SVG rendering
 */
function wrapSvgText(text: string, maxCharsPerLine: number = 22): string[] {
  if (!text) return [];
  const clean = text.trim();
  if (clean.length <= maxCharsPerLine) return [clean];

  const words = clean.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      if (word.length > maxCharsPerLine) {
        // Break long single word
        for (let i = 0; i < word.length; i += maxCharsPerLine) {
          lines.push(word.slice(i, i + maxCharsPerLine));
        }
        currentLine = '';
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Helper to split paragraphs and wrap lines for Canvas 2D text rendering
 */
function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const clean = text.trim();
  if (!clean) return [];

  const rawParagraphs = clean.split('\n');
  const resultLines: string[] = [];

  for (const para of rawParagraphs) {
    if (!para.trim()) {
      resultLines.push('');
      continue;
    }

    const words = para.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width <= maxWidth || !currentLine) {
        currentLine = testLine;
      } else {
        resultLines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines;
}

/**
 * Directly renders a CardDesign onto an HTML5 Canvas using standard 2D Context.
 * This guarantees 100% reliable, synchronous, high-resolution PNG generation
 * without any cross-origin SVG restrictions or tainted canvas issues.
 */
export async function renderCardDesignToCanvas(
  design: CardDesign,
  width = 1000,
  height = 1000
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  // 1. Draw Background
  ctx.fillStyle = design.background || '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 2. Filter & Sort Elements
  const validElements = design.elements.filter((el) => {
    if (el.type === 'number' && (el.id.includes('page') || el.id.includes('number') || el.id.includes('small-number'))) {
      return false;
    }
    if (el.id === 'page' || el.id === 'number' || el.id === 'small-number' || el.id === 'chapter') {
      return false;
    }
    return true;
  });

  const sortedElements = validElements.slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  // Helper for drawing rounded rectangle
  function drawRoundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    if (!ctx) return;
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // Preload any image elements safely
  const imageElements = sortedElements.filter((el) => el.type === 'image' && el.src);
  const loadedImages = new Map<string, HTMLImageElement>();
  await Promise.all(
    imageElements.map(async (el) => {
      if (!el.src || loadedImages.has(el.src)) return;
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((res) => {
          img.onload = () => res(null);
          img.onerror = () => res(null);
          img.src = el.src!;
        });
        if (img.complete && img.naturalWidth > 0) {
          loadedImages.set(el.src, img);
        }
      } catch (_) {}
    })
  );

  // 3. Render Elements onto Canvas
  for (const el of sortedElements) {
    const x = (el.x / 100) * width;
    const y = (el.y / 100) * height;
    const elW = (el.width / 100) * width;
    const elH = (el.height / 100) * height;
    const opacity = el.opacity !== undefined ? el.opacity : 1;

    ctx.save();
    ctx.globalAlpha = opacity;

    if (el.rotation) {
      const cx = x + elW / 2;
      const cy = y + elH / 2;
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    if (el.type === 'shape') {
      const rx = el.borderRadius ? Math.min(el.borderRadius * 5, 48) : 0;
      drawRoundedRect(x, y, elW, elH, rx);
      if (el.background && el.background !== 'transparent') {
        ctx.fillStyle = el.background;
        ctx.fill();
      }
      if (el.border) {
        ctx.strokeStyle = el.border;
        ctx.lineWidth = el.borderWidth || 1.5;
        if (el.borderStyle === 'dashed') {
          ctx.setLineDash([8, 8]);
        } else if (el.borderStyle === 'dotted') {
          ctx.setLineDash([3, 6]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();
      }
    } else if (el.type === 'image' && el.src) {
      const img = loadedImages.get(el.src);
      const rx = el.borderRadius ? Math.min(el.borderRadius * 5, 20) : 8;
      ctx.save();
      drawRoundedRect(x, y, elW, elH, rx);
      ctx.clip();
      if (img) {
        ctx.drawImage(img, x, y, elW, elH);
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(x, y, elW, elH);
      }
      ctx.restore();
    } else if (el.type === 'line') {
      const lineThickness = Math.max(2, (el.height / 100) * height || 2);
      ctx.fillStyle = el.background || el.color || '#94a3b8';
      drawRoundedRect(x, y, elW, lineThickness, 2);
      ctx.fill();
    } else if (el.type === 'badge' && el.text) {
      const badgeRx = 16;
      drawRoundedRect(x, y, elW, elH, badgeRx);
      ctx.fillStyle = el.background || '#10b981';
      ctx.fill();

      ctx.fillStyle = el.color || '#ffffff';
      ctx.font = '800 16px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.text, x + elW / 2, y + elH / 2);
    } else if ((el.type === 'text' || el.type === 'number') && el.text) {
      const scaleFactor = width / 550;
      let fontSize = Math.max(14, Math.round((el.fontSize || 16) * scaleFactor));
      const fontWeight = el.fontWeight || 600;
      const color = el.color || '#1e293b';
      let lineHeight = fontSize * (el.lineHeight || 1.35);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 2, y - 2, elW + 4, elH + 4);
      ctx.clip();

      ctx.fillStyle = color;
      ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", sans-serif`;
      ctx.textBaseline = 'top';

      let textX = x;
      if (el.align === 'center') {
        textX = x + elW / 2;
        ctx.textAlign = 'center';
      } else if (el.align === 'right') {
        textX = x + elW;
        ctx.textAlign = 'right';
      } else {
        ctx.textAlign = 'left';
      }

      let lines = wrapCanvasText(ctx, el.text, elW);

      // Dynamically scale down font if text height exceeds element height
      let attempts = 0;
      while (lines.length * lineHeight > elH && fontSize > 13 && attempts < 5) {
        fontSize = Math.max(12, Math.round(fontSize * 0.9));
        lineHeight = fontSize * (el.lineHeight || 1.3);
        ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", sans-serif`;
        lines = wrapCanvasText(ctx, el.text, elW);
        attempts++;
      }

      let currentY = y;
      if (el.verticalAlign === 'center') {
        const totalTextHeight = lines.length * lineHeight;
        currentY = Math.max(y, y + (elH - totalTextHeight) / 2);
      } else if (el.verticalAlign === 'bottom') {
        const totalTextHeight = lines.length * lineHeight;
        currentY = Math.max(y, y + elH - totalTextHeight);
      }

      for (const line of lines) {
        if (currentY + lineHeight > y + elH + 10) break;
        ctx.fillText(line, textX, currentY);
        currentY += lineHeight;
      }
      ctx.restore();
    }

    ctx.restore();
  }

  return canvas;
}

/**
 * Renders a single CardNewsCard to a real PNG Blob and PNG Data URL using Canvas 2D
 */
export async function renderCardToPngBlob(
  card: CardNewsCard | CardNewsItem | any,
  globalStyle: CardNewsStyle = 'photoreal',
  keyword = '',
  aspectRatio: CardAspectRatio = '1:1'
): Promise<{ blob: Blob | null; dataUrl: string }> {
  const design = createCardDesign({
    card,
    keyword,
    style: globalStyle,
    aspectRatio,
  });

  const width = 1000;
  const height = aspectRatio === '16:9' ? 562 : aspectRatio === '4:3' ? 750 : 1000;

  try {
    const canvas = await renderCardDesignToCanvas(design, width, height);
    const dataUrl = canvas.toDataURL('image/png', 0.95);

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png', 0.95);
    });

    return { blob, dataUrl };
  } catch (err) {
    console.warn('Direct canvas rendering failed, using svg fallback:', err);
    const svg = generateCardNewsSvg(card, globalStyle, keyword, aspectRatio);
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    const pngUrl = await svgToPngDataUrl(dataUrl, width, height);
    return { blob: null, dataUrl: pngUrl || dataUrl };
  }
}

/**
 * Generates an SVG string representation of a CardNewsCard based on its CardDesign
 * Completely self-contained with system fonts (no external @import) to avoid canvas tainting.
 */
export function generateCardNewsSvg(
  card: CardNewsCard | CardNewsItem | any,
  globalStyle: CardNewsStyle = 'photoreal',
  keyword: string = '',
  aspectRatio: CardAspectRatio = '1:1'
): string {
  const design: CardDesign = createCardDesign({
    card,
    keyword,
    style: globalStyle,
    aspectRatio,
  });

  const width = 1000;
  const height = aspectRatio === '16:9' ? 562 : aspectRatio === '4:3' ? 750 : 1000;

  const elements = design.elements.filter((el) => {
    if (el.type === 'number' && (el.id.includes('page') || el.id.includes('number') || el.id.includes('small-number'))) {
      return false;
    }
    if (el.id === 'page' || el.id === 'number' || el.id === 'small-number' || el.id === 'chapter') {
      return false;
    }
    return true;
  });

  const sortedElements = elements.slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  let svgElements = '';

  for (const el of sortedElements) {
    const x = (el.x / 100) * width;
    const y = (el.y / 100) * height;
    const elWidth = (el.width / 100) * width;
    const elHeight = (el.height / 100) * height;
    const opacity = el.opacity !== undefined ? el.opacity : 1;
    const rotTransform = el.rotation ? ` transform="rotate(${el.rotation} ${x + elWidth / 2} ${y + elHeight / 2})"` : '';

    if (el.type === 'shape') {
      const rx = el.borderRadius ? Math.min(el.borderRadius * 5, 48) : 0;
      const fill = el.background || 'transparent';
      const strokeWidth = el.borderWidth || 1.5;
      const dashArray = el.borderStyle === 'dashed' ? ' stroke-dasharray="8 8"' : el.borderStyle === 'dotted' ? ' stroke-dasharray="2 6" stroke-linecap="round"' : '';
      const strokeAttr = el.border ? ` stroke="${el.border}" stroke-width="${strokeWidth}"${dashArray}` : '';
      svgElements += `
    <rect x="${x}" y="${y}" width="${elWidth}" height="${elHeight}" rx="${rx}" fill="${fill}" opacity="${opacity}"${strokeAttr}${rotTransform} />`;
    } else if (el.type === 'image' && el.src) {
      const rx = el.borderRadius ? Math.min(el.borderRadius * 5, 20) : 8;
      svgElements += `
    <g${rotTransform}>
      <clipPath id="clip-${el.id}">
        <rect x="${x}" y="${y}" width="${elWidth}" height="${elHeight}" rx="${rx}" />
      </clipPath>
      <image href="${escapeXml(el.src)}" x="${x}" y="${y}" width="${elWidth}" height="${elHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${el.id})" opacity="${opacity}" />
    </g>`;
    } else if (el.type === 'line') {
      const lineThickness = Math.max(2, (el.height / 100) * height || 2);
      svgElements += `
    <rect x="${x}" y="${y}" width="${elWidth}" height="${lineThickness}" rx="2" fill="${el.background || el.color || '#94a3b8'}" opacity="${opacity}"${rotTransform} />`;
    } else if (el.type === 'badge' && el.text) {
      const badgeRx = 16;
      const textX = x + elWidth / 2;
      const textY = y + elHeight / 2 + 5;
      svgElements += `
    <g${rotTransform}>
      <rect x="${x}" y="${y}" width="${elWidth}" height="${elHeight}" rx="${badgeRx}" fill="${el.background || '#10b981'}" opacity="${opacity}" />
      <text x="${textX}" y="${textY}" text-anchor="middle" fill="${el.color || '#ffffff'}" font-family="-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" font-size="14" font-weight="800" letter-spacing="0.5">${escapeXml(el.text)}</text>
    </g>`;
    } else if ((el.type === 'text' || el.type === 'number') && el.text) {
      const fontSize = Math.max(14, (el.fontSize || 16) * 1.35);
      const fontWeight = el.fontWeight || 600;
      const fill = el.color || '#1e293b';
      const textAnchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';
      const textX = el.align === 'center' ? x + elWidth / 2 : el.align === 'right' ? x + elWidth : x;

      const maxChars = Math.max(12, Math.floor(elWidth / (fontSize * 0.55)));
      const lines = wrapSvgText(el.text, maxChars);
      const lineHeight = fontSize * (el.lineHeight || 1.3);

      const tspans = lines
        .map((line, idx) => {
          const dy = idx === 0 ? 0 : lineHeight;
          return `<tspan x="${textX}" dy="${dy}">${escapeXml(line)}</tspan>`;
        })
        .join('');

      const startY = y + fontSize;

      svgElements += `
    <text x="${textX}" y="${startY}" text-anchor="${textAnchor}" fill="${fill}" font-family="-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" opacity="${opacity}"${rotTransform}>
      ${tspans}
    </text>`;
    }
  }

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", sans-serif; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="${design.background}" />
  ${svgElements}
</svg>`;

  return svgContent;
}

/**
 * Converts a CardNewsCard into an SVG Data URL
 */
export function generateCardNewsDataUrl(
  card: CardNewsCard | CardNewsItem | any,
  globalStyle: CardNewsStyle = 'photoreal',
  keyword: string = '',
  aspectRatio: CardAspectRatio = '1:1'
): string {
  const svg = generateCardNewsSvg(card, globalStyle, keyword, aspectRatio);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Converts an SVG Data URL or SVG raw string into a high-resolution PNG Data URL via Canvas
 */
export async function svgToPngDataUrl(
  svgContentOrDataUrl: string,
  width = 800,
  height = 800
): Promise<string> {
  if (!svgContentOrDataUrl) return '';

  let rawSvg = svgContentOrDataUrl;
  if (rawSvg.startsWith('data:image/svg+xml;utf8,')) {
    rawSvg = decodeURIComponent(rawSvg.replace('data:image/svg+xml;utf8,', ''));
  } else if (rawSvg.startsWith('data:image/svg+xml;base64,')) {
    try {
      rawSvg = atob(rawSvg.replace('data:image/svg+xml;base64,', ''));
    } catch (_) {}
  }

  // Remove any @import statements inside SVG that cause browser canvas security/blocking
  rawSvg = rawSvg.replace(/@import\s+url\([^)]+\);?/gi, '');

  return new Promise((resolve) => {
    try {
      const blob = new Blob([rawSvg], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const timer = setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        resolve(svgContentOrDataUrl);
      }, 2500);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const pngUrl = canvas.toDataURL('image/png', 0.95);
            URL.revokeObjectURL(blobUrl);
            resolve(pngUrl);
            return;
          }
        } catch (e) {
          console.warn('Canvas drawImage failed:', e);
        }
        URL.revokeObjectURL(blobUrl);
        resolve(svgContentOrDataUrl);
      };

      img.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(blobUrl);
        resolve(svgContentOrDataUrl);
      };

      img.src = blobUrl;
    } catch (e) {
      resolve(svgContentOrDataUrl);
    }
  });
}

/**
 * Extracts and generates standalone SVG image items for all cards in a CardNewsResult
 */
export function generateAllCardNewsImages(
  cardNews: CardNewsResult,
  aspectRatio: CardAspectRatio = '1:1'
): Array<{ title: string; imageUrl: string; index: number }> {
  const cards: CardNewsItem[] = cardNews.engineResult?.cards || [];
  const slides = cardNews.slides || [];
  const count = Math.max(cards.length, slides.length);
  const results: Array<{ title: string; imageUrl: string; index: number }> = [];

  const style = (cardNews.aiGraphicStyle || cardNews.engineResult?.globalStyle || 'photoreal') as CardNewsStyle;
  const keyword = cardNews.keyword || cardNews.title || '카드뉴스';

  for (let i = 0; i < count; i++) {
    const cardItem: CardNewsItem | undefined = cards[i];
    const slideItem = slides[i];

    const effectiveCard: CardNewsItem = cardItem || {
      cardNumber: i + 1,
      title: slideItem?.title || `${keyword} 핵심 요약 ${i + 1}`,
      subtitle: slideItem?.subtitle,
      body: '',
      contentPoints: slideItem?.contentPoints || [],
      imageSource: (slideItem as any)?.imageUrl ? 'ai_graphic' : 'none',
      imageUrl: (slideItem as any)?.imageUrl || (cardNews as any)?.imageUrl,
      layout: (slideItem?.type as any) || 'content',
      cta: slideItem?.highlightText,
    };

    const dataUrl = generateCardNewsDataUrl(effectiveCard, style, keyword, aspectRatio);
    results.push({
      title: effectiveCard.title || `${keyword} ${i + 1}`,
      imageUrl: dataUrl,
      index: i + 1,
    });
  }

  return results;
}

/**
 * Extracts and converts all card news slides into PNG Blobs and PNG Data URLs using direct Canvas 2D
 */
export async function generateAllCardNewsPngImages(
  cardNews: CardNewsResult,
  aspectRatio: CardAspectRatio = '1:1'
): Promise<Array<{ title: string; imageUrl: string; index: number; blob: Blob | null }>> {
  const cards: CardNewsItem[] = cardNews.engineResult?.cards || [];
  const slides = cardNews.slides || [];
  const count = Math.max(cards.length, slides.length);
  const results: Array<{ title: string; imageUrl: string; index: number; blob: Blob | null }> = [];

  const style = (cardNews.aiGraphicStyle || cardNews.engineResult?.globalStyle || 'photoreal') as CardNewsStyle;
  const keyword = cardNews.keyword || cardNews.title || '카드뉴스';

  for (let i = 0; i < count; i++) {
    const cardItem: CardNewsItem | undefined = cards[i];
    const slideItem = slides[i];

    const effectiveCard: CardNewsItem = cardItem || {
      cardNumber: i + 1,
      title: slideItem?.title || `${keyword} 핵심 요약 ${i + 1}`,
      subtitle: slideItem?.subtitle,
      body: '',
      contentPoints: slideItem?.contentPoints || [],
      imageSource: (slideItem as any)?.imageUrl ? 'ai_graphic' : 'none',
      imageUrl: (slideItem as any)?.imageUrl || (cardNews as any)?.imageUrl,
      layout: (slideItem?.type as any) || 'content',
      cta: slideItem?.highlightText,
    };

    const { blob, dataUrl } = await renderCardToPngBlob(effectiveCard, style, keyword, aspectRatio);

    results.push({
      title: effectiveCard.title || `${keyword} ${i + 1}`,
      imageUrl: dataUrl,
      index: i + 1,
      blob,
    });
  }

  return results;
}

/**
 * Generates pure image-based HTML for card news without tables or complex nested divs.
 * Each slide is rendered as a standalone, styled <img> tag with pure PNG Data URL for optimal Naver Blog paste support.
 */
export async function generateCardNewsImageHtml(
  cardNews: CardNewsResult,
  aspectRatio: CardAspectRatio = '1:1'
): Promise<string> {
  const images = await generateAllCardNewsPngImages(cardNews, aspectRatio);
  if (!images || images.length === 0) return '';

  const title = cardNews.title || cardNews.keyword || '핵심 요약 카드뉴스';

  const cardsHtml = images
    .map(
      (img) => `
    <div style="margin: 24px 0; text-align: center;">
      <img src="${img.imageUrl}" alt="${escapeXml(img.title)}" style="max-width: 100%; width: 680px; height: auto; border-radius: 12px; display: block; margin: 0 auto; box-shadow: 0 4px 16px rgba(0,0,0,0.08);" />
      <p style="font-size: 13px; color: #64748b; margin-top: 8px; text-align: center; font-weight: 500;">📌 [카드뉴스 #${img.index}] ${escapeXml(img.title)}</p>
    </div>`
    )
    .join('\n');

  return `
    <br />
    <hr style="border: none; border-top: 2px dashed #cbd5e1; margin: 32px 0;" />
    <div style="margin: 28px 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;">
      <p style="font-size: 17px; font-weight: bold; color: #0f172a; margin-bottom: 20px;">
        🖼️ [핵심 요약 카드뉴스: ${escapeXml(title)}]
      </p>
      ${cardsHtml}
    </div>
    <hr style="border: none; border-top: 2px dashed #cbd5e1; margin: 32px 0;" />
    <br />
  `;
}

/**
 * Scans an HTML string and converts any remaining SVG data URLs to PNG data URLs
 */
export async function convertAllSvgDataUrlsToPng(html: string): Promise<string> {
  if (!html || !html.includes('data:image/svg+xml')) return html;

  const svgRegex = /data:image\/svg\+xml[^"'\s>]+/g;
  const matches = Array.from(new Set(html.match(svgRegex) || []));

  let result = html;
  for (const svgUrl of matches) {
    try {
      const pngUrl = await svgToPngDataUrl(svgUrl, 800, 800);
      if (pngUrl && pngUrl.startsWith('data:image/png')) {
        result = result.split(svgUrl).join(pngUrl);
      }
    } catch (e) {
      console.warn('Failed to convert svg url to png:', e);
    }
  }

  return result;
}

import { applyUserBlogStyle, preparePlainTextFromHtml as formatPlainText } from './blogFormatter';
import { UserBlogStyle } from '../types';

/**
 * Prepares clean, standard HTML for pasting into Naver Blog SmartEditor ONE
 * Applies user blog style config or default Naver blog formatting
 */
export function prepareNaverBlogHtml(html: string, styleConfig?: UserBlogStyle): string {
  return applyUserBlogStyle(html, styleConfig);
}

/**
 * Converts rich HTML into clean plain text for clipboard fallback
 */
export function preparePlainTextFromHtml(html: string): string {
  return formatPlainText(html);
}

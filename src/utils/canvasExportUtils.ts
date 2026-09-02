import html2canvas from 'html2canvas';

let _colorCanvasCtx: CanvasRenderingContext2D | null = null;
function getColorCanvasCtx(): CanvasRenderingContext2D | null {
  if (!_colorCanvasCtx && typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      _colorCanvasCtx = canvas.getContext('2d', { willReadFrequently: true });
    } catch (e) {
      _colorCanvasCtx = null;
    }
  }
  return _colorCanvasCtx;
}

/**
 * Mathematically converts OKLab (L, a, b) to sRGB [R, G, B] (0..255).
 */
function oklabToSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055);

  const R = Math.max(0, Math.min(255, Math.round(gamma(rLin) * 255)));
  const G = Math.max(0, Math.min(255, Math.round(gamma(gLin) * 255)));
  const B = Math.max(0, Math.min(255, Math.round(gamma(bLin) * 255)));

  return [R, G, B];
}

/**
 * Parses any modern or complex CSS color string (oklab, oklch, color-mix, lab, lch, color, etc.)
 * into standard rgb() or rgba() format using browser Canvas 2D context rendering with accurate mathematical fallback.
 */
export function parseCssColorToRgb(colorStr: string): string {
  if (!colorStr) return 'rgb(15, 23, 42)';
  const trimmed = colorStr.trim();

  // If already standard hex or rgb/rgba/hsl/hsla, return directly
  if (/^#([0-9a-f]{3,8})$/i.test(trimmed) || /^(?:rgb|hsl)a?\([^)]+\)$/i.test(trimmed)) {
    return trimmed;
  }

  // 1. Try Browser Canvas 2D engine (supported in all modern browsers)
  try {
    const ctx = getColorCanvasCtx();
    if (ctx) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'; // default reset
      ctx.fillStyle = trimmed;
      ctx.fillRect(0, 0, 1, 1);

      const data = ctx.getImageData(0, 0, 1, 1).data;
      const alpha = +(data[3] / 255).toFixed(3);
      if (alpha < 1) {
        return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${alpha})`;
      }
      return `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
    }
  } catch (e) {
    // fallback to mathematical conversion
  }

  // 2. Mathematical Fallback for OKLCH
  try {
    const oklchMatch = trimmed.match(/oklch\(\s*([\d.%]+)\s+([\d.%-]+)\s+([\d.%-]+|none)(?:deg|rad|turn)?(?:\s*\/\s*([\d.%]+))?\s*\)/i);
    if (oklchMatch) {
      let L = parseFloat(oklchMatch[1]);
      if (oklchMatch[1].endsWith('%')) L /= 100;
      let C = parseFloat(oklchMatch[2]);
      if (oklchMatch[2].endsWith('%')) C /= 100;
      let H = oklchMatch[3] === 'none' ? 0 : parseFloat(oklchMatch[3]) || 0;
      const alphaVal = oklchMatch[4] ? (oklchMatch[4].endsWith('%') ? parseFloat(oklchMatch[4]) / 100 : parseFloat(oklchMatch[4])) : 1;

      const hRad = (H * Math.PI) / 180;
      const a = C * Math.cos(hRad);
      const b = C * Math.sin(hRad);
      const [r, g, bComp] = oklabToSrgb(L, a, b);
      return alphaVal < 1 ? `rgba(${r}, ${g}, ${bComp}, ${alphaVal})` : `rgb(${r}, ${g}, ${bComp})`;
    }
  } catch (e) {
    // ignore
  }

  // 3. Mathematical Fallback for OKLab
  try {
    const oklabMatch = trimmed.match(/oklab\(\s*([\d.%]+)\s+([\d.%-]+)\s+([\d.%-]+)(?:\s*\/\s*([\d.%]+))?\s*\)/i);
    if (oklabMatch) {
      let L = parseFloat(oklabMatch[1]);
      if (oklabMatch[1].endsWith('%')) L /= 100;
      const a = parseFloat(oklabMatch[2]);
      const b = parseFloat(oklabMatch[3]);
      const alphaVal = oklabMatch[4] ? (oklabMatch[4].endsWith('%') ? parseFloat(oklabMatch[4]) / 100 : parseFloat(oklabMatch[4])) : 1;

      const [r, g, bComp] = oklabToSrgb(L, a, b);
      return alphaVal < 1 ? `rgba(${r}, ${g}, ${bComp}, ${alphaVal})` : `rgb(${r}, ${g}, ${bComp})`;
    }
  } catch (e) {
    // ignore
  }

  return 'rgb(15, 23, 42)';
}

/**
 * Replaces modern color functions (oklch, oklab, color-mix, lab, lch, hwb, color) in a CSS text block
 * with evaluated rgb/rgba strings so html2canvas never encounters unsupported color functions.
 */
export function sanitizeModernCssColors(cssText: string): string {
  if (!cssText) return cssText;

  const lower = cssText.toLowerCase();
  if (
    !lower.includes('oklch') &&
    !lower.includes('oklab') &&
    !lower.includes('color-mix') &&
    !lower.includes('lab(') &&
    !lower.includes('lch(') &&
    !lower.includes('hwb(') &&
    !lower.includes('color(')
  ) {
    return cssText;
  }

  let result = cssText;

  // 1. Replace color-mix(in oklab, ...) or color-mix(in oklch, ...) with in srgb
  result = result.replace(/color-mix\s*\(\s*in\s+(?:oklab|oklch|lab|lch|srgb-linear)/gi, 'color-mix(in srgb');

  // 2. Loop and replace oklch(...), oklab(...), lab(...), lch(...), hwb(...), color(...) and color-mix(...) function calls with paren tracking
  const funcRegex = /(?:oklch|oklab|color-mix|lab|lch|hwb|color)\s*\(/gi;
  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(result)) !== null) {
    const startIdx = match.index;
    let parenCount = 1;
    let endIdx = startIdx + match[0].length;

    while (endIdx < result.length && parenCount > 0) {
      if (result[endIdx] === '(') parenCount++;
      else if (result[endIdx] === ')') parenCount--;
      endIdx++;
    }

    if (parenCount === 0) {
      const fullFuncCall = result.slice(startIdx, endIdx);
      const converted = parseCssColorToRgb(fullFuncCall);
      result = result.slice(0, startIdx) + converted + result.slice(endIdx);
      funcRegex.lastIndex = startIdx + converted.length;
    } else {
      result = result.slice(0, startIdx) + 'rgb(15, 23, 42)' + result.slice(endIdx);
      funcRegex.lastIndex = startIdx + 15;
    }
  }

  // 3. Fallback regex passes for any remaining unparsed functions
  result = result.replace(/oklch\s*\([^)]+\)/gi, (m) => parseCssColorToRgb(m));
  result = result.replace(/oklab\s*\([^)]+\)/gi, (m) => parseCssColorToRgb(m));
  result = result.replace(/color-mix\s*\([^)]+\)/gi, (m) => parseCssColorToRgb(m));
  result = result.replace(/lab\s*\([^)]+\)/gi, (m) => parseCssColorToRgb(m));
  result = result.replace(/lch\s*\([^)]+\)/gi, (m) => parseCssColorToRgb(m));

  // 4. Failsafe: replace any remaining bare "oklab" or "oklch" occurrences
  result = result.replace(/\boklab\b/gi, 'srgb').replace(/\boklch\b/gi, 'srgb');

  return result;
}

type Html2CanvasOptions = NonNullable<Parameters<typeof html2canvas>[1]>;

/**
 * Safely captures an HTML element as a HTMLCanvasElement using html2canvas.
 * Automatically handles and sanitizes unsupported modern CSS color functions like `oklch` / `oklab` / `color-mix`
 * which cause html2canvas to fail with "Attempting to parse an unsupported color function 'oklch'".
 */
export async function safeCaptureHtmlToCanvas(
  targetElement: HTMLElement,
  customOptions: Partial<Html2CanvasOptions> = {}
): Promise<HTMLCanvasElement> {
  const origElements = [targetElement, ...Array.from(targetElement.querySelectorAll('*'))] as HTMLElement[];

  return html2canvas(targetElement, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false,
    onclone: (clonedDoc, clonedTarget) => {
      try {
        // 1. Gather all CSS rules from document.styleSheets in main window
        let aggregatedCss = '';

        try {
          const stylesheets = Array.from(document.styleSheets);
          for (const sheet of stylesheets) {
            try {
              const rules = Array.from(sheet.cssRules || []);
              for (const rule of rules) {
                aggregatedCss += rule.cssText + '\n';
              }
            } catch (e) {
              // Ignore cross-origin stylesheet access restriction
            }
          }
        } catch (e) {
          // ignore
        }

        // Also gather constructable stylesheets if present
        try {
          if ((document as any).adoptedStyleSheets && (document as any).adoptedStyleSheets.length > 0) {
            for (const sheet of (document as any).adoptedStyleSheets) {
              try {
                const rules = Array.from(sheet.cssRules || []);
                for (const rule of rules as any[]) {
                  aggregatedCss += rule.cssText + '\n';
                }
              } catch (e) {}
            }
          }
        } catch (e) {}

        // Gather text from all <style> tags in original document and clonedDoc
        const origStyleTags = Array.from(document.querySelectorAll('style'));
        for (const styleTag of origStyleTags) {
          if (styleTag.textContent) {
            aggregatedCss += styleTag.textContent + '\n';
          }
        }

        const styleTags = Array.from(clonedDoc.querySelectorAll('style'));
        for (const styleTag of styleTags) {
          if (styleTag.textContent) {
            aggregatedCss += styleTag.textContent + '\n';
          }
        }

        // 2. Remove all <link rel="stylesheet"> elements from clonedDoc so html2canvas doesn't fetch raw CSS with oklch/oklab
        const linkTags = Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"]'));
        for (const link of linkTags) {
          link.remove();
        }

        // 3. Remove existing <style> tags from clonedDoc
        for (const styleTag of styleTags) {
          styleTag.remove();
        }

        // 4. Create single sanitized <style> tag in clonedDoc.head
        if (aggregatedCss) {
          const sanitizedCss = sanitizeModernCssColors(aggregatedCss);
          const newStyle = clonedDoc.createElement('style');
          newStyle.textContent = sanitizedCss;
          clonedDoc.head.appendChild(newStyle);
        }

        // 5. Sanitize inline styles on all elements in clonedDoc
        const allClonedElements = Array.from(clonedDoc.querySelectorAll('*')) as HTMLElement[];
        for (const el of allClonedElements) {
          if (el.style && el.style.cssText) {
            const lowerStyle = el.style.cssText.toLowerCase();
            if (
              lowerStyle.includes('oklch') ||
              lowerStyle.includes('oklab') ||
              lowerStyle.includes('color-mix') ||
              lowerStyle.includes('lab(') ||
              lowerStyle.includes('lch(')
            ) {
              el.style.cssText = sanitizeModernCssColors(el.style.cssText);
            }
          }
          // Sanitize SVG presentation attributes
          const svgAttrs = ['fill', 'stroke', 'stop-color', 'flood-color'];
          for (const attr of svgAttrs) {
            const attrVal = el.getAttribute(attr);
            if (attrVal) {
              const lowerAttr = attrVal.toLowerCase();
              if (
                lowerAttr.includes('oklch') ||
                lowerAttr.includes('oklab') ||
                lowerAttr.includes('color-mix') ||
                lowerAttr.includes('lab(') ||
                lowerAttr.includes('lch(')
              ) {
                el.setAttribute(attr, parseCssColorToRgb(attrVal));
              }
            }
          }
        }

        // 6. Inline resolved computed visual styles from original DOM nodes to cloned DOM nodes
        const clonedElements = [clonedTarget, ...Array.from(clonedTarget.querySelectorAll('*'))] as HTMLElement[];
        const count = Math.min(origElements.length, clonedElements.length);

        for (let i = 0; i < count; i++) {
          const orig = origElements[i];
          const cloned = clonedElements[i];
          if (!orig || !cloned) continue;

          try {
            const computedStyle = window.getComputedStyle(orig);

            // 6-a. Background color (preserve rgba alpha opacity perfectly)
            const bgColor = computedStyle.backgroundColor;
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
              cloned.style.backgroundColor = parseCssColorToRgb(bgColor);
            }

            // 6-b. Text color
            const textColor = computedStyle.color;
            if (textColor) {
              cloned.style.color = parseCssColorToRgb(textColor);
            }

            // 6-c. Background image (gradients, etc.)
            const bgImage = computedStyle.backgroundImage;
            if (bgImage && bgImage !== 'none' && bgImage !== 'initial') {
              cloned.style.backgroundImage = sanitizeModernCssColors(bgImage);
            }

            // 6-d. Element Opacity
            const opacityVal = computedStyle.opacity;
            if (opacityVal && opacityVal !== '1') {
              cloned.style.opacity = opacityVal;
            }

            // 6-e. Z-Index
            const zIndexVal = computedStyle.zIndex;
            if (zIndexVal && zIndexVal !== 'auto') {
              cloned.style.zIndex = zIndexVal;
            }

            // 6-f. Border Colors
            const borderColor = computedStyle.borderColor;
            if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)' && borderColor !== 'transparent') {
              cloned.style.borderColor = parseCssColorToRgb(borderColor);
            }

            // 6-g. Box Shadow
            const boxShadow = computedStyle.boxShadow;
            if (boxShadow && boxShadow !== 'none') {
              cloned.style.boxShadow = sanitizeModernCssColors(boxShadow);
            }

            // 6-h. If img tag, ensure anonymous CORS and display
            if (cloned.tagName === 'IMG') {
              (cloned as HTMLImageElement).crossOrigin = 'anonymous';
            }
          } catch (e) {
            // ignore individual element inline copy errors
          }
        }
      } catch (cloneErr) {
        console.warn('[safeCaptureHtmlToCanvas] Warning during style sanitization:', cloneErr);
      }

      if (customOptions.onclone) {
        customOptions.onclone(clonedDoc, clonedTarget);
      }
    },
    ...customOptions,
  });
}



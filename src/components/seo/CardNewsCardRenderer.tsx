import React, {
  forwardRef,
  useMemo,
  type CSSProperties,
} from "react";
import { CardNewsItem } from "../../types";

/* =========================================================
   CARD NEWS DESIGN ENGINE
   ---------------------------------------------------------
   기존 UI형 카드 구조를 제거하고
   "캔버스 + 디자인 레이어" 방식으로 렌더링한다.

   핵심:
   1. 카드 콘텐츠와 디자인을 분리
   2. 각 요소를 absolute positioning
   3. 템플릿마다 완전히 다른 composition
   4. 이미지 / 텍스트 / 도형 / 번호 / 라인 등을 독립 레이어로 처리
   5. 기존 CardNewsCard 데이터와 호환
========================================================= */

/* =========================================================
   TYPES
========================================================= */

export type CardNewsStyle =
  | "photoreal"
  | "simple_icon"
  | "casual"
  | "fairytale";

export type CardLayout =
  | "cover"
  | "content"
  | "summary"
  | "comparison"
  | "checklist"
  | "timeline"
  | "step_process"
  | "metric"
  | "cta"
  | "list";

export type CardAspectRatio =
  | "1:1"
  | "4:3"
  | "16:9";

export type CardTemplate =
  | "cover"
  | "content"
  | "key_point"
  | "step"
  | "comparison"
  | "tip"
  | "warning"
  | "summary"
  | "cta"
  | "checklist"
  | "timeline";

export type CardElementType =
  | "text"
  | "image"
  | "shape"
  | "line"
  | "number"
  | "badge"
  | "circle"
  | "icon";

export interface CardElement {
  id: string;

  type: CardElementType;

  x: number;
  y: number;
  width: number;
  height: number;

  zIndex?: number;

  rotation?: number;

  text?: string;

  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;

  color?: string;

  align?: "left" | "center" | "right";

  verticalAlign?: "top" | "center" | "bottom";

  src?: string;

  objectFit?: "cover" | "contain";

  background?: string;

  border?: string;

  borderStyle?: "dashed" | "dotted" | "solid";

  borderWidth?: number;

  borderRadius?: number;

  opacity?: number;

  padding?: string;

  shadow?: string;

  textTransform?: "none" | "uppercase";

  italic?: boolean;
}

export interface CardDesign {
  width: number;
  height: number;

  background: string;

  template: CardTemplate;

  elements: CardElement[];
}

export interface CardNewsCard {
  cardNumber: number;

  cardRole?:
    | "cover"
    | "key_point"
    | "step"
    | "comparison"
    | "tip"
    | "warning"
    | "summary"
    | "cta"
    | string;

  title: string;

  subtitle?: string;

  body?: string;

  contentPoints?: string[];

  imageSource?:
    | "ai_graphic"
    | "user_photo"
    | "free_image"
    | "infographic"
    | "none";

  imageUrl?: string;

  imagePrompt?: string;

  layout?: CardLayout | string;

  style?: CardNewsStyle | string;

  visualStyle?: string;

  graphicElements?: any;

  cta?: string;
}

export interface CardNewsCardRendererProps {
  card: CardNewsCard | CardNewsItem | any;

  totalCards?: number;

  keyword?: string;

  styleName?: string;

  globalStyle?: CardNewsStyle | string;

  imageMode?: string;

  className?: string;

  aspectRatio?: CardAspectRatio;

  showFooterWatermark?: boolean;
}

/* =========================================================
   FONT
========================================================= */

const FONT_FAMILY =
  "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

const DISPLAY_FONT =
  "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

/* =========================================================
   THEME
========================================================= */

interface DesignTheme {
  bg: string;

  surface: string;

  surfaceAlt: string;

  text: string;

  muted: string;

  accent: string;

  accentSoft: string;

  accentText: string;

  border: string;

  dark: string;

  cream: string;
}

const THEME_PALETTES: Record<
  string,
  DesignTheme[]
> = {
  food: [
    {
      bg: "#F7F1E8",
      surface: "#FFFDF9",
      surfaceAlt: "#EDE0D0",
      text: "#2A211C",
      muted: "#756960",
      accent: "#B95D35",
      accentSoft: "#EFD6C7",
      accentText: "#FFFFFF",
      border: "#DCCABA",
      dark: "#211A17",
      cream: "#F7EFE3",
    },
    {
      bg: "#F3EBDC",
      surface: "#FFFDF8",
      surfaceAlt: "#E7D9C4",
      text: "#27221E",
      muted: "#706960",
      accent: "#687340",
      accentSoft: "#DCE2C9",
      accentText: "#FFFFFF",
      border: "#D7CBB7",
      dark: "#20251A",
      cream: "#F7F0E2",
    },
  ],

  travel: [
    {
      bg: "#EEF5F4",
      surface: "#FFFFFF",
      surfaceAlt: "#DDEBE9",
      text: "#1E292B",
      muted: "#637274",
      accent: "#1E899A",
      accentSoft: "#D5EDF0",
      accentText: "#FFFFFF",
      border: "#C9DDDF",
      dark: "#102A2F",
      cream: "#F5FAF9",
    },
    {
      bg: "#F1F3EC",
      surface: "#FFFFFF",
      surfaceAlt: "#DEE6D9",
      text: "#202A22",
      muted: "#687168",
      accent: "#4D7B58",
      accentSoft: "#DCE9DE",
      accentText: "#FFFFFF",
      border: "#CDD9CE",
      dark: "#1E3022",
      cream: "#F7FAF5",
    },
  ],

  beauty: [
    {
      bg: "#FAF0F2",
      surface: "#FFFFFF",
      surfaceAlt: "#F0DDE2",
      text: "#332328",
      muted: "#786A6E",
      accent: "#B85C73",
      accentSoft: "#F2D7DF",
      accentText: "#FFFFFF",
      border: "#E6CCD3",
      dark: "#291B20",
      cream: "#FFF8F8",
    },
    {
      bg: "#F7EFEB",
      surface: "#FFFFFF",
      surfaceAlt: "#EBD9D2",
      text: "#302522",
      muted: "#756B66",
      accent: "#A25D4A",
      accentSoft: "#F0DCD6",
      accentText: "#FFFFFF",
      border: "#E1CDC5",
      dark: "#2B201D",
      cream: "#FFF9F5",
    },
  ],

  finance: [
    {
      bg: "#EFF5F1",
      surface: "#FFFFFF",
      surfaceAlt: "#DCEAE1",
      text: "#1D2A22",
      muted: "#647269",
      accent: "#267752",
      accentSoft: "#D8EBDD",
      accentText: "#FFFFFF",
      border: "#C8DCD0",
      dark: "#16281F",
      cream: "#F7FBF8",
    },
    {
      bg: "#F0F3F8",
      surface: "#FFFFFF",
      surfaceAlt: "#DDE4F0",
      text: "#1E2633",
      muted: "#667181",
      accent: "#315BC1",
      accentSoft: "#DDE7FF",
      accentText: "#FFFFFF",
      border: "#CAD5E7",
      dark: "#16223A",
      cream: "#F7F9FD",
    },
  ],

  tech: [
    {
      bg: "#F1F4F8",
      surface: "#FFFFFF",
      surfaceAlt: "#DDE5F0",
      text: "#19212D",
      muted: "#647183",
      accent: "#3A65E8",
      accentSoft: "#DDE6FF",
      accentText: "#FFFFFF",
      border: "#CAD6E8",
      dark: "#111A2B",
      cream: "#F8FAFF",
    },
    {
      bg: "#EFF6F4",
      surface: "#FFFFFF",
      surfaceAlt: "#DCEBE6",
      text: "#1D2926",
      muted: "#66746F",
      accent: "#008975",
      accentSoft: "#D7F0EA",
      accentText: "#FFFFFF",
      border: "#C8DDD8",
      dark: "#102C27",
      cream: "#F7FCFA",
    },
  ],

  default: [
    {
      bg: "#F6F2EA",
      surface: "#FFFDF8",
      surfaceAlt: "#E9E1D4",
      text: "#292522",
      muted: "#746D65",
      accent: "#5D6B5D",
      accentSoft: "#DEE6DC",
      accentText: "#FFFFFF",
      border: "#DCD3C5",
      dark: "#20261F",
      cream: "#FAF5EB",
    },
    {
      bg: "#F4F1F6",
      surface: "#FFFFFF",
      surfaceAlt: "#E6E0EA",
      text: "#29262D",
      muted: "#716C78",
      accent: "#7565C8",
      accentSoft: "#E7E2F7",
      accentText: "#FFFFFF",
      border: "#D8D1E3",
      dark: "#262232",
      cream: "#FAF8FC",
    },
  ],
};

/* =========================================================
   HELPERS
========================================================= */

function cleanString(value?: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStyle(
  value?: string
): CardNewsStyle {
  const raw = String(value || "")
    .toLowerCase()
    .trim();

  if (
    raw.includes("photo") ||
    raw.includes("real") ||
    raw.includes("magazine") ||
    raw.includes("editorial")
  ) {
    return "photoreal";
  }

  if (
    raw.includes("icon") ||
    raw.includes("simple") ||
    raw.includes("minimal") ||
    raw.includes("infographic")
  ) {
    return "simple_icon";
  }

  if (
    raw.includes("fairytale") ||
    raw.includes("fairy") ||
    raw.includes("story") ||
    raw.includes("warm") ||
    raw.includes("감성")
  ) {
    return "fairytale";
  }

  return "casual";
}

function isCoverCard(
  card: CardNewsCard
): boolean {
  const number = Number(card.cardNumber);

  const layout = String(
    card.layout || ""
  ).toLowerCase();

  return (
    number === 1 ||
    layout === "cover"
  );
}

function hashString(
  value: string
): number {
  return [...value].reduce(
    (acc, char) =>
      (acc * 31 +
        char.charCodeAt(0)) >>>
      0,
    7
  );
}

export function getThemePalette(
  card: CardNewsCard,
  keyword?: string
): DesignTheme {
  const seed =
    `${keyword || ""} ` +
    `${card.title || ""} ` +
    `${card.body || ""} ` +
    `${card.subtitle || ""}`;

  const lower = seed.toLowerCase();

  let category = "default";

  if (
    /맛집|카페|음식|메뉴|맛|식당|디저트|커피|베이커리|고기|식음|요리|레시피/.test(
      lower
    )
  ) {
    category = "food";
  } else if (
    /여행|호텔|숙소|관광|명소|해외|국내|바다|제주|비행|축제|캠핑/.test(
      lower
    )
  ) {
    category = "travel";
  } else if (
    /화장품|뷰티|메이크업|스킨케어|헤어|패션|네일|스타일|피부/.test(
      lower
    )
  ) {
    category = "beauty";
  } else if (
    /주식|재테크|부동산|대출|금리|투자|절약|세금|지원금|환급|연말정산|머니/.test(
      lower
    )
  ) {
    category = "finance";
  } else if (
    /ai|앱|테크|it|스마트폰|소프트웨어|프로그램|컴퓨터|노트북|생산성/.test(
      lower
    )
  ) {
    category = "tech";
  }

  const palettes =
    THEME_PALETTES[category] ||
    THEME_PALETTES.default;

  return palettes[
    hashString(seed) %
      palettes.length
  ];
}

/* =========================================================
   CONTENT HELPERS & DEDUPLICATION
========================================================= */

function isDuplicateText(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const cleanA = cleanString(a).toLowerCase().replace(/[\s\-_.,!?'"~:;()[\]]/g, '');
  const cleanB = cleanString(b).toLowerCase().replace(/[\s\-_.,!?'"~:;()[\]]/g, '');
  if (!cleanA || !cleanB) return false;
  return cleanA === cleanB || (cleanA.length > 5 && cleanB.includes(cleanA)) || (cleanB.length > 5 && cleanA.includes(cleanB));
}

function getPoints(
  card: CardNewsCard
): string[] {
  const points = (
    card.contentPoints || []
  )
    .map(cleanString)
    .filter(Boolean);

  const title = cleanString(card.title);
  const sub = cleanString(card.subtitle);
  const body = cleanString(card.body);

  const uniquePoints: string[] = [];
  for (const p of points) {
    if (isDuplicateText(p, title) || isDuplicateText(p, sub) || isDuplicateText(p, body)) {
      continue;
    }
    if (uniquePoints.some((existing) => isDuplicateText(p, existing))) {
      continue;
    }
    uniquePoints.push(p);
  }
  return uniquePoints;
}

function getTitle(
  card: CardNewsCard
): string {
  return (
    cleanString(card.title) ||
    "새로운 이야기"
  );
}

function getBody(
  card: CardNewsCard
): string {
  const body = cleanString(card.body);
  const title = cleanString(card.title);
  const sub = cleanString(card.subtitle);
  if (isDuplicateText(body, title) || isDuplicateText(body, sub)) {
    return "";
  }
  return body;
}

function getSubtitle(
  card: CardNewsCard
): string {
  const sub = cleanString(card.subtitle);
  const title = cleanString(card.title);
  if (isDuplicateText(sub, title)) {
    return "";
  }
  return sub;
}

function getCTA(
  card: CardNewsCard
): string {
  const cta = cleanString(card.cta);
  const title = cleanString(card.title);
  const body = cleanString(card.body);
  if (cta && (isDuplicateText(cta, title) || isDuplicateText(cta, body))) {
    return "저장해두고 필요할 때 꺼내보세요";
  }
  return (
    cta ||
    "저장해두고 필요할 때 꺼내보세요"
  );
}

function shortenText(
  text: string,
  max: number
): string {
  const value = cleanString(text);

  if (value.length <= max) {
    return value;
  }

  return `${value.slice(
    0,
    Math.max(0, max - 1)
  )}…`;
}

/* =========================================================
   TEMPLATE SELECTION
========================================================= */

function selectTemplate(card: CardNewsCard): CardTemplate {
  const role = String(card.cardRole || "").toLowerCase().trim();
  const layout = String(card.layout || "").toLowerCase().trim();

  if (role === "cover" || layout.includes("cover") || card.cardNumber === 1) return "cover";
  if (role === "comparison" || layout.includes("comparison") || layout.includes("vs")) return "comparison";
  if (role === "step" || layout.includes("timeline") || layout.includes("step") || layout.includes("process")) return "step";
  if (role === "warning" || layout.includes("warning") || layout.includes("caution")) return "warning";
  if (role === "tip" || layout.includes("tip") || layout.includes("guide")) return "tip";
  if (role === "key_point" || layout.includes("key_point") || layout.includes("metric") || layout.includes("highlight")) return "key_point";
  if (role === "summary" || layout.includes("summary")) return "summary";
  if (role === "cta" || layout.includes("cta") || layout.includes("action")) return "cta";
  if (layout.includes("checklist") || layout.includes("list")) return "checklist";

  return "content";
}

/* =========================================================
   ELEMENT FACTORY
========================================================= */

function textElement(
  id: string,
  options: Partial<CardElement> &
    Pick<
      CardElement,
      "x" | "y" | "width" | "height"
    >,
  text: string
): CardElement {
  return {
    id,
    type: "text",
    zIndex: 10,
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: -0.5,
    color: "#222222",
    align: "left",
    verticalAlign: "center",
    ...options,
    text,
  };
}

function imageElement(
  id: string,
  options: Partial<CardElement> &
    Pick<
      CardElement,
      "x" | "y" | "width" | "height"
    >,
  src?: string
): CardElement {
  return {
    id,
    type: "image",
    zIndex: 4,
    objectFit: "cover",
    borderRadius: 0,
    ...options,
    src,
  };
}

function shapeElement(
  id: string,
  options: Partial<CardElement> &
    Pick<
      CardElement,
      "x" | "y" | "width" | "height"
    >
): CardElement {
  return {
    id,
    type: "shape",
    zIndex: 1,
    background: "transparent",
    ...options,
  };
}

function badgeElement(
  id: string,
  text: string,
  x: number,
  y: number,
  width: number,
  background: string,
  color: string,
  height: number = 5
): CardElement {
  return {
    id,
    type: "badge",
    x,
    y,
    width,
    height,
    zIndex: 20,
    text,
    fontSize: 8.5,
    fontWeight: 800,
    color,
    align: "center",
    background,
    borderRadius: 999,
    padding: "0 10px",
  };
}

function getResponsiveTitleSize(title: string, base: number = 24): number {
  const len = cleanString(title).length;
  if (len <= 12) return base;
  if (len <= 20) return Math.max(16, Math.round(base * 0.85));
  if (len <= 28) return Math.max(14, Math.round(base * 0.72));
  return Math.max(12.5, Math.round(base * 0.6));
}

function getResponsiveBodySize(body: string, base: number = 12): number {
  const len = cleanString(body).length;
  if (len <= 45) return base;
  if (len <= 85) return Math.max(10.5, Math.round(base * 0.9));
  return Math.max(9.5, Math.round(base * 0.78));
}

/* =========================================================
   TEMPLATE: 1. COVER
========================================================= */
function createCoverDesign(card: CardNewsCard, theme: DesignTheme, aspectRatio: CardAspectRatio): CardDesign {
  const elements: CardElement[] = [];
  const hasImg = !!card.imageUrl;
  
  if (hasImg) {
    elements.push(imageElement("bg-img", { x: 0, y: 0, width: 100, height: 100 }, card.imageUrl));
    elements.push(shapeElement("bg-overlay", { x: 0, y: 0, width: 100, height: 100, background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.88) 100%)", zIndex: 2 }));
  } else {
    elements.push(shapeElement("bg-color", { x: 0, y: 0, width: 100, height: 100, background: theme.accent }));
    elements.push(shapeElement("bg-pattern", { x: -20, y: -20, width: 60, height: 60, borderRadius: 999, background: theme.accentSoft, opacity: 0.25, zIndex: 2 }));
    elements.push(shapeElement("bg-pattern2", { x: 70, y: 70, width: 50, height: 50, borderRadius: 999, background: theme.dark, opacity: 0.15, zIndex: 2 }));
  }

  const textColor = hasImg ? "#FFFFFF" : theme.accentText;
  const accentColor = hasImg ? theme.accent : theme.cream;

  const rawTitle = shortenText(getTitle(card), 32);
  const titleSize = getResponsiveTitleSize(rawTitle, aspectRatio === "16:9" ? 30 : 26);
  const subtitle = shortenText(getSubtitle(card) || "CARD NEWS", 20);

  elements.push(badgeElement("eyebrow", subtitle, 8, 12, 38, accentColor, hasImg ? "#FFFFFF" : theme.text));
  
  elements.push(textElement("title", {
    x: 8, y: 48, width: 84, height: 40, fontSize: titleSize, fontWeight: 900,
    color: textColor, verticalAlign: "bottom", lineHeight: 1.2, letterSpacing: -0.5, zIndex: 5
  }, rawTitle));

  elements.push(shapeElement("line", { x: 8, y: 92, width: 24, height: 0.6, background: accentColor, zIndex: 5 }));
  
  return { width: 1000, height: 1000, template: "cover", background: theme.dark, elements };
}

/* =========================================================
   TEMPLATE: 2. KEY_POINT
========================================================= */
function createKeyPointDesign(card: CardNewsCard, theme: DesignTheme, aspectRatio: CardAspectRatio): CardDesign {
  const elements: CardElement[] = [];
  elements.push(shapeElement("bg", { x: 0, y: 0, width: 100, height: 100, background: theme.bg }));

  // 중앙 강조 카드
  elements.push(shapeElement("card-box", {
    x: 6, y: 6, width: 88, height: 88, borderRadius: 8, background: theme.surface,
    border: theme.border, borderWidth: 1, shadow: "0 8px 24px rgba(0,0,0,0.06)", zIndex: 2
  }));

  const rawTitle = shortenText(getTitle(card), 28);
  const titleSize = getResponsiveTitleSize(rawTitle, 22);
  const rawBody = shortenText(getBody(card), 95);
  const bodySize = getResponsiveBodySize(rawBody, 12);
  const subtitle = shortenText(getSubtitle(card) || "KEY POINT", 18);

  elements.push(badgeElement("key-badge", `★ ${subtitle}`, 12, 14, 34, theme.accent, theme.accentText));

  elements.push(textElement("title", {
    x: 12, y: 26, width: 76, height: 24, fontSize: titleSize, fontWeight: 900,
    color: theme.dark, lineHeight: 1.25, zIndex: 5
  }, rawTitle));

  elements.push(shapeElement("sep", { x: 12, y: 54, width: 20, height: 0.6, background: theme.accent, zIndex: 5 }));

  if (rawBody) {
    elements.push(textElement("body", {
      x: 12, y: 60, width: 76, height: 28, fontSize: bodySize, fontWeight: 500,
      color: theme.text, lineHeight: 1.5, verticalAlign: "top", zIndex: 5
    }, rawBody));
  }

  return { width: 1000, height: 1000, template: "key_point", background: theme.bg, elements };
}

/* =========================================================
   TEMPLATE: 3. STEP
========================================================= */
function createStepDesign(card: CardNewsCard, theme: DesignTheme, aspectRatio: CardAspectRatio): CardDesign {
  const elements: CardElement[] = [];
  elements.push(shapeElement("bg", { x: 0, y: 0, width: 100, height: 100, background: theme.surface }));

  const rawTitle = shortenText(getTitle(card), 28);
  const titleSize = getResponsiveTitleSize(rawTitle, 21);

  elements.push(badgeElement("step-badge", "STEP GUIDE", 8, 8, 30, theme.accentSoft, theme.accent));

  elements.push(textElement("title", {
    x: 8, y: 16, width: 84, height: 14, fontSize: titleSize, fontWeight: 900,
    color: theme.dark, lineHeight: 1.2
  }, rawTitle));

  const points = getPoints(card);
  const startY = 34;
  const maxPoints = points.slice(0, 3);
  const count = Math.max(1, maxPoints.length);
  const stepHeight = 16;
  const gap = 4;

  maxPoints.forEach((pt, i) => {
    const yPos = startY + i * (stepHeight + gap);
    
    // 단계 번호 박스
    elements.push(shapeElement(`step-num-bg-${i}`, {
      x: 8, y: yPos, width: 10, height: stepHeight, borderRadius: 4, background: theme.accent, zIndex: 5
    }));
    elements.push(textElement(`step-num-${i}`, {
      x: 8, y: yPos, width: 10, height: stepHeight, fontSize: 11, fontWeight: 900,
      color: "#FFFFFF", align: "center", verticalAlign: "center", zIndex: 6
    }, `0${i + 1}`));

    // 단계 내용 박스
    elements.push(shapeElement(`step-box-${i}`, {
      x: 20, y: yPos, width: 72, height: stepHeight, borderRadius: 4, background: theme.surfaceAlt, zIndex: 4
    }));
    elements.push(textElement(`step-text-${i}`, {
      x: 23, y: yPos, width: 66, height: stepHeight, fontSize: 10.5, fontWeight: 600,
      color: theme.text, verticalAlign: "center", lineHeight: 1.35, zIndex: 5
    }, shortenText(pt, 40)));
  });

  return { width: 1000, height: 1000, template: "step", background: theme.surface, elements };
}

/* =========================================================
   TEMPLATE: 4. COMPARISON
========================================================= */
function createComparisonDesign(card: CardNewsCard, theme: DesignTheme, aspectRatio: CardAspectRatio): CardDesign {
  const elements: CardElement[] = [];
  elements.push(shapeElement("bg-left", { x: 0, y: 0, width: 50, height: 100, background: theme.surface }));
  elements.push(shapeElement("bg-right", { x: 50, y: 0, width: 50, height: 100, background: theme.surfaceAlt }));

  const rawTitle = shortenText(getTitle(card), 28);
  const titleSize = getResponsiveTitleSize(rawTitle, 21);

  elements.push(textElement("title", {
    x: 8, y: 8, width: 84, height: 16, fontSize: titleSize, fontWeight: 900,
    color: theme.text, align: "center", zIndex: 10
  }, rawTitle));

  const points = getPoints(card);
  const leftPoint = shortenText(points[0] || "A 항목 특징", 45);
  const rightPoint = shortenText(points[1] || "B 항목 특징", 45);

  elements.push(textElement("point-left", {
    x: 6, y: 32, width: 36, height: 55, fontSize: 11, fontWeight: 600,
    color: theme.text, align: "center", verticalAlign: "center", lineHeight: 1.4, zIndex: 5
  }, leftPoint));

  elements.push(textElement("point-right", {
    x: 58, y: 32, width: 36, height: 55, fontSize: 11, fontWeight: 600,
    color: theme.text, align: "center", verticalAlign: "center", lineHeight: 1.4, zIndex: 5
  }, rightPoint));

  elements.push(shapeElement("vs-badge", { x: 42, y: 46, width: 16, height: 16, borderRadius: 999, background: theme.accent, zIndex: 10 }));
  elements.push(textElement("vs-text", { x: 42, y: 46, width: 16, height: 16, fontSize: 12, fontWeight: 900, color: "#FFF", align: "center", verticalAlign: "center", zIndex: 11 }, "VS"));

  return { width: 1000, height: 1000, template: "comparison", background: theme.surface, elements };
}

/* =========================================================
   TEMPLATE: 5. TIP
========================================================= */
function createTipDesign(card: CardNewsCard, theme: DesignTheme, aspectRatio: CardAspectRatio): CardDesign {
  const elements: CardElement[] = [];
  elements.push(shapeElement("bg", { x: 0, y: 0, width: 100, height: 100, background: theme.cream }));

  elements.push(shapeElement("inner-panel", {
    x: 6, y: 6, width: 88, height: 88, borderRadius: 8, background: theme.surface,
    border: theme.border, borderWidth: 1, zIndex: 2
  }));

  const rawTitle = shortenText(getTitle(card), 28);
  const titleSize = getResponsiveTitleSize(rawTitle, 22);

  elements.push(badgeElement("tip-badge", "💡 실전 TIP", 12, 14, 28, theme.accent, theme.accentText));

  elements.push(textElement("title", {
    x: 12, y: 24, width: 76, height: 16, fontSize: titleSize, fontWeight: 900,
    color: theme.dark, lineHeight: 1.2, zIndex: 5
  }, rawTitle));

  const points = getPoints(card);
  const rawBody = shortenText(getBody(card), 90);

  if (points.length > 0) {
    const startY = 44;
    points.slice(0, 3).forEach((pt, i) => {
      const yPos = startY + i * 14;
      elements.push(shapeElement(`tip-bullet-${i}`, {
        x: 12, y: yPos + 2, width: 3.5, height: 3.5, borderRadius: 999, background: theme.accent, zIndex: 5
      }));
      elements.push(textElement(`tip-point-${i}`, {
        x: 18, y: yPos, width: 70, height: 12, fontSize: 10.5, fontWeight: 600,
        color: theme.text, verticalAlign: "center", lineHeight: 1.35, zIndex: 5
      }, shortenText(pt, 42)));
    });
  } else if (rawBody) {
    elements.push(textElement("tip-body", {
      x: 12, y: 44, width: 76, height: 42, fontSize: 11.5, fontWeight: 500,
      color: theme.text, verticalAlign: "top", lineHeight: 1.5, zIndex: 5
    }, rawBody));
  }

  return { width: 1000, height: 1000, template: "tip", background: theme.cream, elements };
}

/* =========================================================
   TEMPLATE: 6. WARNING
========================================================= */
function createWarningDesign(card: CardNewsCard, theme: DesignTheme, aspectRatio: CardAspectRatio): CardDesign {
  const elements: CardElement[] = [];
  elements.push(shapeElement("bg", { x: 0, y: 0, width: 100, height: 100, background: "#FFF9F6" }));

  // 경고 강조 테두리 박스
  elements.push(shapeElement("warn-box", {
    x: 6, y: 6, width: 88, height: 88, borderRadius: 8, background: "#FFFFFF",
    border: "#F4A261", borderWidth: 2, shadow: "0 8px 24px rgba(230, 81, 0, 0.08)", zIndex: 2
  }));

  const rawTitle = shortenText(getTitle(card), 28);
  const titleSize = getResponsiveTitleSize(rawTitle, 22);

  elements.push(badgeElement("warn-badge", "⚠️ 주의사항", 12, 14, 30, "#E76F51", "#FFFFFF"));

  elements.push(textElement("title", {
    x: 12, y: 24, width: 76, height: 16, fontSize: titleSize, fontWeight: 900,
    color: "#264653", lineHeight: 1.2, zIndex: 5
  }, rawTitle));

  const points = getPoints(card);
  const rawBody = shortenText(getBody(card), 90);

  if (points.length > 0) {
    const startY = 44;
    points.slice(0, 3).forEach((pt, i) => {
      const yPos = startY + i * 14;
      elements.push(shapeElement(`warn-bullet-${i}`, {
        x: 12, y: yPos + 2, width: 3.5, height: 3.5, borderRadius: 2, background: "#E76F51", zIndex: 5
      }));
      elements.push(textElement(`warn-point-${i}`, {
        x: 18, y: yPos, width: 70, height: 12, fontSize: 10.5, fontWeight: 600,
        color: "#2B2D42", verticalAlign: "center", lineHeight: 1.35, zIndex: 5
      }, shortenText(pt, 42)));
    });
  } else if (rawBody) {
    elements.push(textElement("warn-body", {
      x: 12, y: 44, width: 76, height: 42, fontSize: 11.5, fontWeight: 500,
      color: "#2B2D42", verticalAlign: "top", lineHeight: 1.5, zIndex: 5
    }, rawBody));
  }

  return { width: 1000, height: 1000, template: "warning", background: "#FFF9F6", elements };
}

/* =========================================================
   TEMPLATE: 7. SUMMARY
========================================================= */
function createSummaryDesign(card: CardNewsCard, theme: DesignTheme, aspectRatio: CardAspectRatio): CardDesign {
  const elements: CardElement[] = [];
  elements.push(shapeElement("bg", { x: 0, y: 0, width: 100, height: 100, background: theme.bg }));

  elements.push(shapeElement("inner-card", {
    x: 6, y: 6, width: 88, height: 88, borderRadius: 8, background: theme.surface,
    border: theme.border, borderWidth: 1, shadow: "0 8px 24px rgba(0,0,0,0.05)", zIndex: 2
  }));

  const rawTitle = shortenText(getTitle(card), 28);
  const titleSize = getResponsiveTitleSize(rawTitle, 22);
  const rawBody = shortenText(getBody(card), 105);
  const bodySize = getResponsiveBodySize(rawBody, 11.5);

  elements.push(badgeElement("sum-badge", "3줄 요약", 36, 12, 28, theme.accentSoft, theme.accent));

  elements.push(textElement("title", {
    x: 10, y: 22, width: 80, height: 16, fontSize: titleSize, fontWeight: 900,
    color: theme.dark, align: "center", zIndex: 5
  }, rawTitle));

  elements.push(shapeElement("sep", { x: 38, y: 40, width: 24, height: 0.6, background: theme.accent, zIndex: 5 }));

  const points = getPoints(card);
  if (points.length > 0) {
    const startY = 46;
    points.slice(0, 3).forEach((pt, i) => {
      const yPos = startY + i * 13;
      elements.push(textElement(`sum-point-${i}`, {
        x: 12, y: yPos, width: 76, height: 11, fontSize: 10.5, fontWeight: 600,
        color: theme.text, align: "center", verticalAlign: "center", lineHeight: 1.35, zIndex: 5
      }, `• ${shortenText(pt, 38)}`));
    });
  } else if (rawBody) {
    elements.push(textElement("body", {
      x: 12, y: 46, width: 76, height: 42, fontSize: bodySize, fontWeight: 500,
      color: theme.text, align: "center", verticalAlign: "top", lineHeight: 1.55, zIndex: 5
    }, rawBody));
  }

  return { width: 1000, height: 1000, template: "summary", background: theme.bg, elements };
}

/* =========================================================
   TEMPLATE: 8. CTA
========================================================= */
function createCtaDesign(card: CardNewsCard, theme: DesignTheme, aspectRatio: CardAspectRatio): CardDesign {
  const elements: CardElement[] = [];
  elements.push(shapeElement("bg", { x: 0, y: 0, width: 100, height: 100, background: theme.dark }));
  
  elements.push(shapeElement("circle-dec", { x: -20, y: 50, width: 50, height: 50, borderRadius: 999, background: theme.accent, opacity: 0.3 }));
  elements.push(shapeElement("circle-dec2", { x: 70, y: -10, width: 40, height: 40, borderRadius: 999, background: theme.accentSoft, opacity: 0.15 }));

  const rawTitle = shortenText(getTitle(card), 30);
  const titleSize = getResponsiveTitleSize(rawTitle, 23);
  const ctaText = shortenText(getCTA(card) || "저장하고 다시 보기", 18);

  elements.push(textElement("title", {
    x: 8, y: 28, width: 84, height: 32, fontSize: titleSize, fontWeight: 900,
    color: "#FFFFFF", align: "center", lineHeight: 1.3, zIndex: 5
  }, rawTitle));

  elements.push(shapeElement("btn", {
    x: 20, y: 68, width: 60, height: 12, borderRadius: 999, background: theme.accent, zIndex: 10
  }));

  elements.push(textElement("btn-text", {
    x: 20, y: 68, width: 60, height: 12, fontSize: 12, fontWeight: 800,
    color: "#FFFFFF", align: "center", verticalAlign: "center", zIndex: 11
  }, ctaText));

  return { width: 1000, height: 1000, template: "cta", background: theme.dark, elements };
}

/* =========================================================
   TEMPLATE: CONTENT (DEFAULT)
========================================================= */
function createContentDesign(card: CardNewsCard, theme: DesignTheme, aspectRatio: CardAspectRatio): CardDesign {
  const elements: CardElement[] = [];
  const hasImg = !!card.imageUrl;

  elements.push(shapeElement("bg", { x: 0, y: 0, width: 100, height: 100, background: theme.bg }));

  if (hasImg) {
    elements.push(imageElement("img", { x: 6, y: 6, width: 88, height: 46, borderRadius: 6 }, card.imageUrl));
    
    const rawTitle = shortenText(getTitle(card), 28);
    const titleSize = getResponsiveTitleSize(rawTitle, 19);
    const rawBody = shortenText(getBody(card), 85);
    const bodySize = getResponsiveBodySize(rawBody, 11);

    elements.push(textElement("title", {
      x: 6, y: 55, width: 88, height: 14, fontSize: titleSize, fontWeight: 800,
      color: theme.text, lineHeight: 1.25, zIndex: 5
    }, rawTitle));

    if (rawBody) {
      elements.push(textElement("body", {
        x: 6, y: 71, width: 88, height: 23, fontSize: bodySize, fontWeight: 500,
        color: theme.muted, lineHeight: 1.45, verticalAlign: "top", zIndex: 5
      }, rawBody));
    }
  } else {
    // 이미지가 없을 때도 깔끔하게 꽉 찬 카드 레이아웃
    elements.push(shapeElement("card-panel", {
      x: 6, y: 6, width: 88, height: 88, borderRadius: 8, background: theme.surface,
      border: theme.border, borderWidth: 1, shadow: "0 6px 20px rgba(0,0,0,0.04)", zIndex: 2
    }));

    const rawTitle = shortenText(getTitle(card), 28);
    const titleSize = getResponsiveTitleSize(rawTitle, 22);
    const rawBody = shortenText(getBody(card), 110);
    const bodySize = getResponsiveBodySize(rawBody, 12);
    const subtitle = shortenText(getSubtitle(card) || "INFO", 20);

    elements.push(badgeElement("info-badge", subtitle, 12, 14, 30, theme.accentSoft, theme.accent));

    elements.push(textElement("title", {
      x: 12, y: 25, width: 76, height: 20, fontSize: titleSize, fontWeight: 900,
      color: theme.dark, lineHeight: 1.25, zIndex: 5
    }, rawTitle));

    elements.push(shapeElement("sep", { x: 12, y: 48, width: 18, height: 0.6, background: theme.accent, zIndex: 5 }));

    const points = getPoints(card);
    if (points.length > 0) {
      const startY = 54;
      points.slice(0, 3).forEach((pt, i) => {
        const yPos = startY + i * 12;
        elements.push(textElement(`content-point-${i}`, {
          x: 12, y: yPos, width: 76, height: 11, fontSize: 10.5, fontWeight: 600,
          color: theme.text, verticalAlign: "center", lineHeight: 1.35, zIndex: 5
        }, `• ${shortenText(pt, 40)}`));
      });
    } else if (rawBody) {
      elements.push(textElement("body", {
        x: 12, y: 54, width: 76, height: 34, fontSize: bodySize, fontWeight: 500,
        color: theme.text, verticalAlign: "top", lineHeight: 1.5, zIndex: 5
      }, rawBody));
    }
  }

  return { width: 1000, height: 1000, template: "content", background: theme.bg, elements };
}

/* =========================================================
   TEMPLATE: CHECKLIST (LEGACY ALIAS)
========================================================= */
function createChecklistDesign(card: CardNewsCard, theme: DesignTheme, aspectRatio: CardAspectRatio): CardDesign {
  return createTipDesign(card, theme, aspectRatio);
}

/* =========================================================
   TEMPLATE: TIMELINE (LEGACY ALIAS)
========================================================= */
function createTimelineDesign(card: CardNewsCard, theme: DesignTheme, aspectRatio: CardAspectRatio): CardDesign {
  return createStepDesign(card, theme, aspectRatio);
}

/* =========================================================
   DESIGN FACTORY
========================================================= */
export function createCardDesign({ card, keyword, style, aspectRatio }: { card: CardNewsCard; keyword?: string; style: CardNewsStyle; aspectRatio: CardAspectRatio; }): CardDesign {
  const theme = getThemePalette(card, keyword);
  const template = selectTemplate(card);

  switch (template) {
    case "cover": return createCoverDesign(card, theme, aspectRatio);
    case "key_point": return createKeyPointDesign(card, theme, aspectRatio);
    case "step": return createStepDesign(card, theme, aspectRatio);
    case "comparison": return createComparisonDesign(card, theme, aspectRatio);
    case "tip": return createTipDesign(card, theme, aspectRatio);
    case "warning": return createWarningDesign(card, theme, aspectRatio);
    case "summary": return createSummaryDesign(card, theme, aspectRatio);
    case "cta": return createCtaDesign(card, theme, aspectRatio);
    case "checklist": return createChecklistDesign(card, theme, aspectRatio);
    case "timeline": return createTimelineDesign(card, theme, aspectRatio);
    case "content":
    default:
      return createContentDesign(card, theme, aspectRatio);
  }
}
/* =========================================================
   ELEMENT RENDERER
========================================================= */

const CardElementRenderer: React.FC<{
  element: CardElement;
}> = ({ element }) => {
  const style: CSSProperties = {
    position: "absolute",

    left: `${element.x}%`,
    top: `${element.y}%`,

    width: `${element.width}%`,
    height: `${element.height}%`,

    zIndex:
      element.zIndex ?? 1,

    boxSizing: "border-box",

    transform:
      element.rotation
        ? `rotate(${element.rotation}deg)`
        : undefined,

    opacity:
      element.opacity,

    minWidth: 0,
    minHeight: 0,
  };

  /* -------------------------------------------------------
     SHAPE
  ------------------------------------------------------- */

  if (
    element.type ===
    "shape"
  ) {
    return (
      <div
        style={{
          ...style,

          background:
            element.background,

          border: element.border
            ? `${element.borderWidth || 1}px ${element.borderStyle || "solid"} ${element.border}`
            : undefined,

          borderRadius:
            element.borderRadius,

          boxShadow:
            element.shadow,

          overflow: "hidden",
        }}
      />
    );
  }

  /* -------------------------------------------------------
     IMAGE
  ------------------------------------------------------- */

  if (
    element.type ===
    "image"
  ) {
    if (!element.src) {
      return null;
    }

    return (
      <img
        src={element.src}
        alt=""
        draggable={false}
        style={{
          ...style,

          display: "block",

          objectFit:
            element.objectFit ||
            "cover",

          borderRadius:
            element.borderRadius,

          border: element.border
            ? `${element.borderWidth || 1}px ${element.borderStyle || "solid"} ${element.border}`
            : undefined,

          boxShadow:
            element.shadow,

          userSelect: "none",
        }}
      />
    );
  }

  /* -------------------------------------------------------
     LINE
  ------------------------------------------------------- */

  if (
    element.type ===
    "line"
  ) {
    return (
      <div
        style={{
          ...style,

          background:
            element.background ||
            element.color,

          borderRadius:
            element.borderRadius ||
            999,
        }}
      />
    );
  }

  /* -------------------------------------------------------
     TEXT / NUMBER / BADGE
  ------------------------------------------------------- */

  if (
    element.type ===
      "text" ||
    element.type ===
      "number" ||
    element.type ===
      "badge"
  ) {
    const isBadge =
      element.type ===
      "badge";

    return (
      <div
        style={{
          ...style,

          display: "flex",

          flexDirection:
            "column",

          justifyContent:
            element.verticalAlign ===
            "top"
              ? "flex-start"
              : element.verticalAlign ===
                "bottom"
              ? "flex-end"
              : "center",

          alignItems:
            element.align ===
            "right"
              ? "flex-end"
              : element.align ===
                "center"
              ? "center"
              : "flex-start",

          padding:
            element.padding,

          background:
            element.background,

          border:
            element.border,

          borderRadius:
            element.borderRadius,

          boxShadow:
            element.shadow,

          color:
            element.color,

          fontFamily:
            DISPLAY_FONT,

          fontSize:
            element.fontSize,

          fontWeight:
            element.fontWeight,

          lineHeight:
            element.lineHeight,

          letterSpacing:
            element.letterSpacing,

          fontStyle:
            element.italic
              ? "italic"
              : undefined,

          textTransform:
            element.textTransform,

          textAlign:
            element.align ||
            "left",

          wordBreak:
            "keep-all",

          overflowWrap:
            "break-word",

          whiteSpace:
            "pre-wrap",

          overflow: "hidden",

          overflowX:
            "hidden",

          overflowY:
            "hidden",

          textOverflow:
            "ellipsis",

          maxHeight:
            "100%",

          boxSizing:
            "border-box",

          WebkitFontSmoothing:
            "antialiased",

          textRendering:
            "optimizeLegibility",

          ...(isBadge
            ? {
                whiteSpace:
                  "nowrap",
              }
            : {}),
        }}
      >
        {element.text}
      </div>
    );
  }

  return null;
}

/* =========================================================
   DESIGN RENDERER
========================================================= */

function CardDesignRenderer({
  design,
}: {
  design: CardDesign;
}) {
  return (
    <div
      style={{
        position: "relative",

        width: "100%",
        height: "100%",

        overflow: "hidden",

        background:
          design.background,

        fontFamily:
          FONT_FAMILY,

        isolation: "isolate",
      }}
    >
      {design.elements
        .slice()
        .sort(
          (a, b) =>
            (a.zIndex || 0) -
            (b.zIndex || 0)
        )
        .map(
          (element) => (
            <CardElementRenderer
              key={element.id}
              element={element}
            />
          )
        )}
    </div>
  );
}

/* =========================================================
   MAIN RENDERER
========================================================= */

export const CardNewsCardRenderer =
  forwardRef<
    HTMLDivElement,
    CardNewsCardRendererProps
  >(
    (
      {
        card,
        totalCards = 6,
        keyword = "",

        styleName,
        globalStyle,

        imageMode:
          _imageMode,

        className = "",

        aspectRatio =
          "1:1",

        showFooterWatermark:
          _showFooterWatermark =
            false,
      },
      ref
    ) => {
      /* ---------------------------------------------------
         STYLE
      --------------------------------------------------- */

      const selectedStyle =
        useMemo<CardNewsStyle>(
          () => {
            const candidates =
              [
                globalStyle,

                (card as any)
                  ?.aiGraphicStyle,

                card?.style,

                styleName,
              ];

            for (
              const value of candidates
            ) {
              if (value) {
                return normalizeStyle(
                  String(value)
                );
              }
            }

            return "casual";
          },
          [
            globalStyle,
            card,
            card?.style,
            (card as any)
              ?.aiGraphicStyle,
            styleName,
          ]
        );

      /* ---------------------------------------------------
         ASPECT
      --------------------------------------------------- */

      const safeAspectRatio: CardAspectRatio =
        aspectRatio ===
        "4:3"
          ? "4:3"
          : aspectRatio ===
            "16:9"
          ? "16:9"
          : "1:1";

      const aspectValue =
        safeAspectRatio ===
        "16:9"
          ? "16 / 9"
          : safeAspectRatio ===
            "4:3"
          ? "4 / 3"
          : "1 / 1";

      /* ---------------------------------------------------
         DESIGN
      --------------------------------------------------- */

      const design =
        useMemo(
          () =>
            createCardDesign({
              card,
              keyword,
              style:
                selectedStyle,
              aspectRatio:
                safeAspectRatio,
            }),
          [
            card,
            keyword,
            selectedStyle,
            safeAspectRatio,
          ]
        );

      /* ---------------------------------------------------
         RENDER
      --------------------------------------------------- */

      return (
        <div
          ref={ref}
          className={className}
          data-card-news-card={
            card?.cardNumber ||
            1
          }
          data-card-style={
            selectedStyle
          }
          data-card-template={
            design.template
          }
          data-card-aspect-ratio={
            safeAspectRatio
          }
          style={{
            position:
              "relative",

            width: "100%",

            aspectRatio:
              aspectValue,

            overflow:
              "hidden",

            boxSizing:
              "border-box",

            borderRadius: 0,

            isolation:
              "isolate",

            minWidth: 0,

            minHeight: 0,

            background:
              design.background,
          }}
        >
          <CardDesignRenderer
            design={design}
          />
        </div>
      );
    }
  );

CardNewsCardRenderer.displayName =
  "CardNewsCardRenderer";


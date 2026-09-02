export type AiGraphicStyleKey = 'photoreal' | 'simple_icon' | 'casual' | 'fairytale';

export interface AiGraphicStyleOption {
  id: AiGraphicStyleKey;
  label: string;
  badge: string;
  desc: string;
  promptAddon: string;
  accentColor: string;
}

export const AI_GRAPHIC_STYLES: AiGraphicStyleOption[] = [
  {
    id: 'photoreal',
    label: '포토 리얼',
    badge: '실사/고화질',
    desc: '에디토리얼 매거진 레이아웃 & 고화질 감성 스톡 사진',
    promptAddon: 'photorealistic 8k photography, real photo, editorial magazine style layout, natural lighting, high resolution, detailed commercial photo, authentic context',
    accentColor: 'border-blue-500/40 text-blue-300 bg-blue-500/10',
  },
  {
    id: 'simple_icon',
    label: '심플 아이콘',
    badge: '깔끔/미니멀',
    desc: '화이트 배경 & 딥블루 라인 아이콘 인포그래픽',
    promptAddon: 'Minimalist corporate infographic card style, clean solid white background, no flashy gradients. Use deep navy and slate blue as primary accent colors. Feature a clean typography title at the top, followed by a horizontal row of minimalist line icons (thin-stroke vectors) with short descriptive text labels beneath each. Include a subtle rounded container box at the bottom for key takeaways. Professional, clean, corporate, and easy to read.',
    accentColor: 'border-slate-400/40 text-slate-700 bg-slate-100',
  },
  {
    id: 'casual',
    label: '캐주얼',
    badge: '친근/트렌디',
    desc: '연한 미색 배경 & 딥블루 포인트의 친근한 인포그래픽',
    promptAddon: 'Casual friendly vector infographic card design, clean white or off-white background, deep navy and slate blue accent lines and typography. Clean logo and title header with cute vector illustration visual, rounded container boxes at the bottom with neat icons. Modern, clean, readable, friendly SNS card layout.',
    accentColor: 'border-blue-400/40 text-blue-800 bg-blue-50',
  },
  {
    id: 'fairytale',
    label: '동화 삽화',
    badge: '감성/크림톤',
    desc: '크림톤 배경 & 귀여운 플랫 일러스트 따뜻한 코스형',
    promptAddon: 'Warm and cozy travel itinerary card design, clean cream or white background with dark navy text. Divide the layout clearly into sections like morning, afternoon, and evening using cute flat vector illustrations or friendly storybook-style spot art. Use soft pastel accents, rounded badge elements for markers (e.g., 오전, 오후, 1, 2), and a clean rounded container box at the bottom for tips. Friendly, charming, and neat layout.',
    accentColor: 'border-amber-400/40 text-amber-900 bg-amber-50',
  },
];

export function getAiGraphicStyleLabel(style: string): string {
  const found = AI_GRAPHIC_STYLES.find((s) => s.id === style);
  return found ? found.label : '포토 리얼';
}

/**
 * 본문 내용/키워드, 문단 문맥, 이미지 목적 및 선택된 그래픽 스타일을 결합하여
 * 정보 연관성 1순위 중심의 고품질 프롬프트를 생성하는 유틸리티
 */
export function buildAiGraphicPrompt(
  style: AiGraphicStyleKey | string,
  keyword: string,
  contextSnippet?: string,
  purpose?: string
): string {
  const mainKw = (keyword || '주제').trim();
  const context = (contextSnippet || '').trim();
  const imagePurpose = (purpose || '').trim();

  let coreSubject = '';
  if (imagePurpose && context) {
    coreSubject = `${imagePurpose}, ${context.slice(0, 120)}`;
  } else if (imagePurpose) {
    coreSubject = `${imagePurpose}, ${mainKw}`;
  } else if (context) {
    coreSubject = `${context.slice(0, 140)}, ${mainKw}`;
  } else {
    coreSubject = mainKw;
  }

  const cleanSubject = coreSubject.replace(/[^\w\s가-힣,.]/gi, ' ').replace(/\s+/g, ' ').trim();

  const currentStyleKey = (style || 'photoreal').toLowerCase();

  const noBlankSpaceDirective = "fully completed finished artwork, fully populated layout, no blank space, no empty placeholders, highly detailed, no text";

  if (currentStyleKey === 'photoreal') {
    return `${cleanSubject}, photorealistic 8k photography, real photo, editorial magazine style layout, natural lighting, high resolution, detailed commercial photo, authentic scene, ${noBlankSpaceDirective}`;
  }

  if (currentStyleKey === 'simple_icon') {
    return `Minimalist corporate infographic illustration representing ${cleanSubject}, clean solid white background, no flashy gradients, deep navy and slate blue line icons, thin-stroke vector graphic, professional clean corporate style, illustration style, ${noBlankSpaceDirective}`;
  }

  if (currentStyleKey === 'casual') {
    return `Casual friendly vector graphic illustration representing ${cleanSubject}, clean white or off-white background, deep navy and slate blue accent lines, cute flat vector visual, modern readable SNS card illustration, illustration style, ${noBlankSpaceDirective}`;
  }

  if (currentStyleKey === 'fairytale') {
    return `Warm and cozy travel itinerary style illustration representing ${cleanSubject}, clean cream or light white background, cute flat vector storybook art, soft pastel accents, charming gentle atmosphere, illustration style, ${noBlankSpaceDirective}`;
  }

  return `${cleanSubject}, illustration style, natural lighting, high resolution, ${noBlankSpaceDirective}`;
}
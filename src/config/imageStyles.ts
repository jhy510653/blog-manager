/**
 * Image Style Configuration and Prompt Templates
 * Independent configuration for AI image generation across blog drafting.
 */

export interface ImageStyleConfig {
  id: 'photoreal' | 'fairytale';
  label: string;
  badge: string;
  description: string;
  promptTemplate: string;
  negativePrompt: string;
  allowedContentTypes: string[];
}

export type ImageAspectRatio = '1:1' | '3:4' | '4:5' | '9:16' | '16:9';

export const IMAGE_STYLES: Record<'photoreal' | 'fairytale', ImageStyleConfig> = {
  photoreal: {
    id: 'photoreal',
    label: '실사 스타일',
    badge: '자연스러운 실사',
    description: '스마트폰 카메라로 자연광에서 직접 촬영한 듯한 과보정 없는 자연스러운 사진',
    promptTemplate: `입력된 {topic}을 실제 사람이 스마트폰으로 현장에서 촬영한 듯한 자연스러운 블로그용 사진으로 표현한다.

사진은 고성능 스마트폰 카메라로 촬영한 현실적인 사진 품질을 유지한다.

자연광을 우선 사용하고, 스마트폰 카메라 특유의 자연스러운 HDR을 표현한다.
색상은 실제 눈으로 보는 것에 가깝게 표현하며 과도한 채도, 대비, 선명도 및 색보정을 사용하지 않는다.

완벽하게 연출된 광고 사진이나 화보 사진이 아니라 실제 여행, 생활, 정보 콘텐츠에서 사용자가 직접 촬영한 것처럼 자연스럽고 현실적인 장면으로 구성한다.

구도는 지나치게 완벽하거나 인위적으로 대칭적이지 않게 한다.
실제 촬영에서 발생할 수 있는 자연스러운 여백과 약간의 불완전함을 허용한다.

장면의 핵심 대상이 무엇인지 명확하게 표현하되 불필요하게 화면을 가득 채우지 않는다.

실제 공간의 재질, 표면, 빛, 그림자, 거리감 및 주변 환경을 자연스럽게 표현한다.

사용자가 입력한 {topic}의 의미를 해석하여 가장 적절한 장소, 상황, 계절, 시간대, 날씨 및 촬영 시점을 스스로 결정한다.

입력된 주제를 단순히 문자 그대로 묘사하지 말고 블로그 콘텐츠에서 실제로 사용할 수 있는 장면으로 시각화한다.

이미지 비율은 {aspectRatio}를 따른다.

이미지 안에는 어떠한 제목, 설명문, 글자, 로고 또는 워터마크도 넣지 않는다.`,
    negativePrompt: `광고컷, 화보컷, 스튜디오 촬영, 과도한 연출, 3D 렌더링, CGI, 게임 그래픽, 플라스틱 같은 표면, 과도한 HDR, 과도한 채도, 과도한 선명도, 과도한 색보정, 비현실적인 조명, 인공적인 구도, 지나치게 완벽한 구도, 비현실적인 질감, AI 이미지 특유의 인공적인 느낌, 일러스트, 만화, 텍스트, 글자, 로고, 워터마크`,
    allowedContentTypes: ['정보 탐색형', '구매 추천형', '비교 분석형'],
  },
  fairytale: {
    id: 'fairytale',
    label: '동화 일러스트 스타일',
    badge: '따뜻한 감성 삽화',
    description: '따뜻한 그림책 느낌의 수채화 & 구아슈 질감과 서정적인 자연 색감',
    promptTemplate: `서정적 초록빛 동화 일러스트

① 사용자 입력

아래 두 부분만 수정하세요.

주제 또는 제목

[{topic}]

이미지 비율

[{aspectRatio}]

예시: 1:1 / 3:4 / 4:5 / 9:16 / 16:9

② 제작 지시

입력된 [주제 또는 제목] 하나를 바탕으로, 따뜻하고 서정적인 한 장의 감성 동화책 일러스트를 제작한다.

사용자에게 등장인물, 장소, 계절, 시간대, 날씨, 소품, 색상, 장면 등을 추가로 질문하지 않는다.

AI가 주제의 의미와 감정을 해석하여 가장 잘 어울리는 장면, 인물 또는 동물, 자연환경, 계절, 시간대, 날씨, 색채, 시점과 구도를 스스로 결정한다.

단순히 주제를 그대로 설명하는 그림보다는, 한 장의 그림만 보아도 작은 이야기가 느껴지는 시적인 순간으로 재해석한다.

③ 핵심 그림 스타일

전체적인 이미지는 다음 감성을 결합한다.

lyrical picture-book illustration + soft watercolor painting + hand-painted gouache texture + delicate ink drawing + dreamy nature illustration + poetic editorial art

사진처럼 사실적인 이미지가 아니라, 사람이 직접 종이에 물감과 붓으로 그린 듯한 따뜻하고 부드러운 손그림 작품으로 표현한다.

색은 맑고 풍부하되 자극적으로 사용하지 않는다.

특히 다음 계열을 중심으로 자연스럽게 조화시킨다.

에메랄드 그린

세이지 그린

연두

풀빛 초록

아이보리와 따뜻한 화이트

부드러운 노랑

작은 주황·코랄·붉은색 포인트

밤 장면에서는 청록·딥블루·문빛 크림색

초록색 한 가지로 화면을 채우지 말고 밝고 어두운 여러 녹색이 자연스럽게 층을 이루도록 한다.

④ 자연 표현

자연은 단순한 배경이 아니라 그림의 가장 중요한 주인공 중 하나로 표현한다.

필요에 따라 다음 요소를 자유롭게 활용한다.

큰 나무, 늘어진 나뭇가지, 풀밭, 들꽃, 연잎, 연꽃, 덩굴, 작은 꽃잎, 빗방울, 초승달 또는 보름달, 반딧불, 바람에 흔들리는 풀, 물가, 언덕, 숲, 여름 하늘

실제 비율보다 나무나 잎, 꽃, 언덕 등을 조금 크게 표현하여 사람이 자연 속에 포근하게 감싸여 있는 느낌을 만든다.

나뭇잎과 풀을 하나하나 지나치게 사실적으로 묘사하지 않고, 부드러운 붓 터치와 작은 점묘, 번지는 수채 물감, 가느다란 손그림 선으로 표현한다.

곳곳에 아주 작은 꽃잎이나 빛의 점, 금빛 또는 따뜻한 노란 점을 흩뿌려 화면에 생명감을 더한다.

⑤ 인물 표현

사람이 필요한 주제라면 인물은 지나치게 크게 배치하지 않는다.

인물은 자연 속에 조용히 존재하는 작은 이야기의 주인공처럼 표현한다.

얼굴은 사실적인 초상화보다 단순하고 사랑스러운 그림책 캐릭터 스타일로 표현한다.

표정은 과장하지 않고 편안하고 자연스럽게 한다.

아이, 가족, 친구, 반려동물 등이 등장할 경우 서로의 행동과 시선만으로 작은 이야기가 느껴지도록 구성한다.

예:

나무 아래 누워 책을 읽는 사람

들판에 나란히 앉아 달을 보는 아이들

비 오는 날 우산을 들고 걷는 친구들

커다란 연잎 아래 앉아 수박을 먹는 아이

그네를 타며 바람을 느끼는 사람

풀밭에서 강아지와 쉬는 아이

꽃 사이를 뛰어가는 아이들

다만 이러한 예시를 그대로 반복하지 말고 입력된 주제에 가장 자연스러운 새로운 장면을 매번 창작한다.

⑥ 구도

입력된 **[이미지 비율]**에 정확히 맞춘다.

그림 전체를 사물로 빽빽하게 채우지 않는다.

넓은 여백과 자연 요소가 만든 공간감을 적극적으로 활용한다.

화면의 한쪽에는 큰 나무, 잎, 언덕 또는 꽃과 같은 자연 요소를 배치하고, 다른 영역에는 비교적 넓고 잔잔한 공간을 남겨 숨 쉴 수 있는 구도를 만든다.

인물이 있다면 화면 중앙에 무조건 크게 배치하지 말고 상황에 따라 아래쪽, 한쪽 모서리, 나무 아래, 언덕 너머 등으로 배치한다.

장면에 깊이가 느껴지도록

foreground vegetation → main subject → soft distant background

구조를 자연스럽게 활용한다.

⑦ 질감과 표현 방식

종이에 직접 그린 듯한 미세한 질감을 유지한다.

transparent watercolor washes

soft gouache layers

subtle dry-brush texture

delicate pencil or ink lines

visible handmade brush marks

slightly irregular edges

gentle color bleeding

subtle paper texture

tiny painted dots and petals

디지털 벡터처럼 지나치게 깨끗한 선이나 완벽한 도형은 피한다.

3D 렌더링, 사진 합성, 지나치게 매끈한 디지털 페인팅 느낌도 사용하지 않는다.

⑧ 분위기

최종 작품에서는 다음 감정 중 주제에 가장 적합한 감정이 자연스럽게 느껴져야 한다.

평온함, 여유, 어린 시절의 기억, 작은 행복, 우정, 기다림, 여름날의 바람, 비 오는 날의 설렘, 자연 속 휴식, 가족의 온기, 조용한 외로움, 희망, 그리움

억지로 극적인 장면을 만들기보다는 평범한 순간이 오래 기억에 남는 한 장면처럼 표현한다.

⑨ 제목 해석 규칙

사용자가 주제 대신 제목을 입력한 경우, 제목을 이미지 안에 문자로 크게 쓰는 것이 아니라 제목이 가진 의미와 감정을 해석하여 하나의 장면으로 시각화한다.

예를 들어

[비가 오면 만나자]
→ 초록빛 들판의 빗속에서 우산을 쓴 아이들이 서로에게 걸어가는 장면

[우리들의 여름]
→ 늦은 오후 커다란 나무 아래에서 함께 쉬고 있는 아이들의 장면

[달빛 아래서]
→ 넓은 풀 언덕에 나란히 앉아 달을 바라보는 친구들의 장면

처럼 표현한다.

기본적으로 이미지 안에는 제목이나 문구를 넣지 않는다.

⑩ 최종 이미지 목표

최종 결과는 단순한 풍경화나 캐릭터 그림이 아니라,

한여름 그림책의 한 페이지처럼
자연의 냄새와 바람이 느껴지고,
한 장만 보아도 앞뒤 이야기를 상상하게 만드는
따뜻하고 서정적인 감성 일러스트

가 되어야 한다.

화려함보다 여백, 색감, 자연, 작은 인물과 감정의 조화를 우선한다.`,
    negativePrompt: `No photorealism,
no 3D rendering,
no glossy digital art,
no excessive details,
no cluttered composition,
no hard outlines,
no artificial lighting,
no text,
no watermark,
no logo.`,
    allowedContentTypes: ['정보 탐색형', '구매 추천형', '비교 분석형'],
  },
};

/**
 * Checks whether AI image generation is allowed for a given content type or writing style.
 * "경험 리뷰형" returns false; "정보 탐색형", "구매 추천형", "비교 분석형" return true.
 */
export function isAiImageAllowedForContentType(contentTypeOrStyle?: string): boolean {
  if (!contentTypeOrStyle) return true;
  const normalized = contentTypeOrStyle.trim().toLowerCase();

  // If it is experience review type, AI image generation is forbidden
  if (
    normalized.includes('경험') ||
    normalized.includes('리뷰') ||
    normalized.includes('후기') ||
    normalized.includes('review') ||
    normalized.includes('experience')
  ) {
    return false;
  }

  return true;
}

/**
 * Builds the final prompt by replacing {topic} and {aspectRatio} placeholders.
 */
export function buildImagePrompt(
  styleId: 'photoreal' | 'fairytale' | string,
  topic: string,
  aspectRatio: ImageAspectRatio = '16:9'
): { prompt: string; negativePrompt: string } {
  const selectedStyle =
    styleId === 'fairytale' ? IMAGE_STYLES.fairytale : IMAGE_STYLES.photoreal;

  const cleanTopic = (topic || '주제 관련 장면').trim();
  const replacedPrompt = selectedStyle.promptTemplate
    .replaceAll('{topic}', cleanTopic)
    .replaceAll('{aspectRatio}', aspectRatio);

  return {
    prompt: replacedPrompt,
    negativePrompt: selectedStyle.negativePrompt,
  };
}

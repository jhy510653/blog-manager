export type MainTabType = 'dashboard' | 'challenges' | 'members' | 'announcements' | 'resources' | 'toolkit' | 'revenue' | 'trends' | 'subscription';

export interface NavigationTabItem {
  id: MainTabType;
  label: string;          // 데스크톱 사이드바 & 상단 헤더 표시명 (예: '홈 대시보드', '트렌드 키워드 수집')
  shortLabel: string;     // 모바일 하단 탭바 표시명 (예: '홈', '소재 추천', 'AI 툴킷')
  badge: string;          // 뱃지 문구 (예: 'HOT', 'TOP', 'AI', 'NEW' 등, 없으면 빈 문자열)
  badgeColor?: string;    // 뱃지 스타일 클래스
  description: string;    // 관리자 및 툴팁용 설명
}

export const DEFAULT_NAVIGATION_TABS: Record<MainTabType, NavigationTabItem> = {
  dashboard: {
    id: 'dashboard',
    label: '홈 대시보드',
    shortLabel: '홈',
    badge: '',
    badgeColor: '',
    description: '홈 대시보드, 챌린지 종합 현황 및 공지/자료 요약',
  },
  challenges: {
    id: 'challenges',
    label: '챌린지 현황',
    shortLabel: '챌린지',
    badge: '',
    badgeColor: 'bg-blue-50 text-blue-600',
    description: '기수별 챌린지 진행 현황 및 일별 실시간 리더보드',
  },
  members: {
    id: 'members',
    label: '가입 멤버',
    shortLabel: '멤버',
    badge: '',
    badgeColor: 'bg-gray-100 text-gray-600',
    description: '전체 참가 멤버 목록 및 네이버 블로그/트위터 바로가기',
  },
  announcements: {
    id: 'announcements',
    label: '공지사항 & 자료실',
    shortLabel: '공지/자료',
    badge: '',
    badgeColor: '',
    description: '운영진 공지사항 및 주차별 수익화 가이드 자료실',
  },
  resources: {
    id: 'resources',
    label: '챌린지 자료실',
    shortLabel: '자료실',
    badge: '',
    badgeColor: '',
    description: '챌린지 참여자를 위한 주차별 실전자료 및 템플릿',
  },
  trends: {
    id: 'trends',
    label: '키워드 수집',
    shortLabel: '키워드 수집',
    badge: 'HOT',
    badgeColor: 'bg-rose-50 text-rose-600 font-bold',
    description: '키워드 분석, 황금 키워드, 일간 급상승, 월간 인기 실전 블로그 소재 수집',
  },
  toolkit: {
    id: 'toolkit',
    label: 'AI 초안 생성기',
    shortLabel: '초안 생성기',
    badge: 'AI',
    badgeColor: 'bg-indigo-50 text-indigo-600 font-black',
    description: '블로그 SEO 글작성기, 카드뉴스 제작, 이미지 생성 툴킷',
  },
  revenue: {
    id: 'revenue',
    label: '수익 인증 명예의 전당',
    shortLabel: '수익 인증',
    badge: 'TOP',
    badgeColor: 'bg-amber-50 text-amber-700 font-extrabold',
    description: '참가자 실제 수익 인증 및 명예의 전당 랭킹',
  },
  subscription: {
    id: 'subscription',
    label: '사이트 구독',
    shortLabel: '구독',
    badge: 'PRO',
    badgeColor: 'bg-emerald-50 text-emerald-700 font-bold',
    description: '멤버십 등급 구독 및 AI 툴킷 무제한 이용권 상품 안내',
  },
};

const LOCAL_STORAGE_NAV_TABS_KEY = 'cpa_navigation_tab_settings';

export function getStoredNavigationTabs(): Record<MainTabType, NavigationTabItem> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_NAV_TABS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = {
        ...DEFAULT_NAVIGATION_TABS,
        ...parsed,
      };
      // Auto-migrate legacy default labels
      if (merged.toolkit?.label === 'AI 수익화 툴킷' || merged.toolkit?.label === 'AI 수익화 툴킷(Beta)') {
        merged.toolkit = {
          ...merged.toolkit,
          label: 'AI 초안 생성기',
          shortLabel: '초안 생성기',
        };
        saveStoredNavigationTabs(merged);
      }
      if (merged.trends?.label === '트렌드 키워드' || merged.trends?.label === '트렌드 키워드 수집') {
        merged.trends = {
          ...merged.trends,
          label: '키워드 수집',
          shortLabel: '키워드 수집',
        };
        saveStoredNavigationTabs(merged);
      }
      return merged;
    }
  } catch (err) {
    console.warn('Failed to parse navigation tabs from localStorage:', err);
  }
  return { ...DEFAULT_NAVIGATION_TABS };
}

export function saveStoredNavigationTabs(tabs: Record<MainTabType, NavigationTabItem>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_NAV_TABS_KEY, JSON.stringify(tabs));
  } catch (err) {
    console.warn('Failed to save navigation tabs to localStorage:', err);
  }
}

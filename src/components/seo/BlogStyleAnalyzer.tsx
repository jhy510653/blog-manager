import React, { useState, useEffect } from 'react';
import { StyleProfile } from '../../types';
import { extractAndParseJson } from '../../utils/jsonUtils';
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
  RotateCw,
  FileText,
  HelpCircle,
  Zap,
} from 'lucide-react';

interface BlogStyleAnalyzerProps {
  styleProfile: StyleProfile | null;
  onStyleProfileChange: (profile: StyleProfile | null) => void;
  onShowToast: (message: string) => void;
  currentUser?: any;
  isAdmin?: boolean;
}

const SAMPLE_POSTS = [
  `안녕하세요! 오늘은 제가 3개월 동안 직접 써보고 반한 데일리 무선 청소기 솔직 후기를 가져왔습니다.
솔직히 처음엔 흡입력이 약하면 어쩌나 걱정했는데, 막상 마룻바닥과 카펫 모두 돌려보니 기대 이상이더라고요.
특히 무게가 1.2kg밖에 안 되어서 손목에 무리가 전혀 안 가는 점이 제일 마음에 들었습니다.
배터리 타임도 표준 모드로 40분은 넉넉하게 돌아가서 30평대 집 청소하기에 부족함이 없었어요.
다음 포스팅에서는 먼지통 세척 꿀팁도 자세히 정리해 드릴게요! 궁금한 점은 댓글 남겨주세요 :)`,

  `주말에 가족들과 함께 다녀온 속초 오션뷰 카페 방문기입니다.
바다 바로 앞에 위치해서 창가 자리에 앉으면 푸른 동해 바다가 한눈에 시원하게 들어옵니다.
시그니처 메뉴인 흑임자 크림 라떼는 고소한 크림과 쌉싸름한 에스프레소 조화가 아주 훌륭했어요.
주차 공간도 넉넉하고 2층에는 야외 테라스석도 마련되어 있어서 날씨 좋은 날 방문하기 딱 좋습니다.
다만 주말 오후 2시 전후로는 웨이팅이 조금 있는 편이니 오전 일찍 방문하시는 것을 추천드립니다!`,

  `블로그 수익화 6개월 차, 방문자 수 3배 늘린 실전 키워드 발굴 노하우를 공개합니다.
단순히 조회수가 높은 대형 키워드만 노리면 상위 노출 경쟁에서 밀리기 쉽습니다.
제가 직접 적용했던 핵심은 바로 '검색 의도 분석'과 '황금 롱테일 키워드 조합'이었는데요.
검색자가 실제로 필요로 하는 해결책을 서두에 명확히 제시하고, 본문에서는 구체적인 비교표와 팩트 위주로 전개하는 것이 체류 시간을 늘리는 비결입니다.
오늘 알려드린 3가지 원칙을 여러분의 다음 글에 꼭 적용해보세요!`
];

export const BlogStyleAnalyzer: React.FC<BlogStyleAnalyzerProps> = ({
  styleProfile,
  onStyleProfileChange,
  onShowToast,
  currentUser,
  isAdmin = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [posts, setPosts] = useState<string[]>(['', '', '']);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const storageKey = `ai_blog_style_profile_${currentUser?.id || currentUser?.email || 'guest'}`;

  // Load from local storage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && !styleProfile) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && (parsed.tone || parsed.sentenceStyle)) {
          onStyleProfileChange(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load saved style profile:', e);
    }
  }, [storageKey]);

  const handleFillSamples = () => {
    setPosts([...SAMPLE_POSTS]);
    onShowToast('✓ 3개의 샘플 블로그 글이 입력되었습니다.');
  };

  const handlePostChange = (index: number, value: string) => {
    const updated = [...posts];
    updated[index] = value;
    setPosts(updated);
  };

  const handleAddPost = () => {
    if (posts.length >= 5) {
      onShowToast('최대 5개까지 입력 가능합니다.');
      return;
    }
    setPosts([...posts, '']);
    setActiveTab(posts.length);
  };

  const handleRemovePost = (index: number) => {
    if (posts.length <= 3) {
      onShowToast('최소 3개 이상의 글이 필요합니다.');
      return;
    }
    const updated = posts.filter((_, i) => i !== index);
    setPosts(updated);
    setActiveTab((prev) => Math.max(0, Math.min(prev, updated.length - 1)));
  };

  const handleAnalyze = async () => {
    const validPosts = posts.map((p) => p.trim()).filter((p) => p.length >= 20);
    if (validPosts.length < 3) {
      onShowToast('⚠️ 최소 3개 이상의 블로그 글 본문(각 20자 이상)을 입력해주세요.');
      return;
    }

    setIsAnalyzing(true);
    onShowToast('🧠 블로그 글 3편을 정밀 분석하여 나만의 문체 프로필을 추출하는 중...');

    try {
      const res = await fetch('/api/gemini/toolkit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'analyze_style',
          blogPosts: validPosts,
          userId: currentUser?.id || currentUser?.naverId,
          userEmail: currentUser?.email,
          userName: currentUser?.name,
          isAdmin,
          isChallengeParticipant: true,
        }),
      });

      if (!res.ok) {
        let errorMsg = '문체 분석 중 오류가 발생했습니다.';
        try {
          const errData = await res.json();
          if (errData.message || errData.error) errorMsg = errData.message || errData.error;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      let rawResult = data.result || data;
      let parsedProfile: StyleProfile | null = null;

      if (typeof rawResult === 'string') {
        parsedProfile = extractAndParseJson<StyleProfile>(rawResult);
      } else if (rawResult && typeof rawResult === 'object') {
        parsedProfile = rawResult;
      }

      if (!parsedProfile) {
        throw new Error('문체 프로필 데이터를 파싱할 수 없습니다.');
      }

      parsedProfile.analyzedAt = new Date().toISOString();

      onStyleProfileChange(parsedProfile);
      try {
        localStorage.setItem(storageKey, JSON.stringify(parsedProfile));
      } catch (_) {}

      onShowToast('🎉 내 블로그 맞춤 문체 분석이 완료되었습니다! AI 초안 생성 시 자동 반영됩니다.');
      setIsOpen(false);
    } catch (err: any) {
      console.error('Style analysis failed:', err);
      onShowToast(`❌ 문체 분석 실패: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleResetProfile = () => {
    if (window.confirm('저장된 맞춤 문체 프로필을 초기화하고 기본 스타일로 복귀하시겠습니까?')) {
      onStyleProfileChange(null);
      try {
        localStorage.removeItem(storageKey);
      } catch (_) {}
      onShowToast('✓ 문체 프로필이 초기화되었습니다.');
    }
  };

  const hasProfile = Boolean(styleProfile && (styleProfile.tone || styleProfile.sentenceStyle));
  const validCount = posts.filter((p) => p.trim().length >= 20).length;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs transition-all">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">작성자 블로그 문체 분석 (개인화 스타일)</h3>
              {hasProfile ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> 맞춤 문체 적용 중
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  선택 옵션
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {hasProfile
                ? `말투: ${styleProfile?.tone || '자연스러운 어조'} | 문장: ${styleProfile?.sentenceStyle || '표준 호흡'}`
                : '평소 작성한 블로그 글 3편을 넣으면 AI가 말투와 호흡을 분석하여 내 스타일로 초안을 생성합니다.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {hasProfile && (
            <button
              type="button"
              onClick={handleResetProfile}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="문체 프로필 초기화"
            >
              <Trash2 className="w-3.5 h-3.5" />
              초기화
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors"
          >
            {hasProfile ? '문체 프로필 관리 / 재분석' : '내 블로그 글 분석하기'}
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Profile Summary Badge if active & collapsed */}
      {hasProfile && !isOpen && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          {styleProfile?.openingStyle && (
            <span className="text-xs px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-slate-700">
              <strong className="text-slate-900">도입:</strong> {styleProfile.openingStyle}
            </span>
          )}
          {styleProfile?.endingStyle && (
            <span className="text-xs px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-slate-700">
              <strong className="text-slate-900">마무리:</strong> {styleProfile.endingStyle}
            </span>
          )}
          {styleProfile?.preferredPatterns && styleProfile.preferredPatterns.length > 0 && (
            <span className="text-xs px-2.5 py-1 bg-blue-50/70 border border-blue-200/60 rounded-lg text-blue-800">
              선호 키워드/표현: {styleProfile.preferredPatterns.slice(0, 3).join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Expandable Form & Active Details */}
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
          {/* If already analyzed, show current profile overview */}
          {hasProfile && (
            <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  현재 적용 중인 문체 프로필
                </span>
                {styleProfile?.analyzedAt && (
                  <span className="text-[11px] text-slate-400">
                    분석일: {new Date(styleProfile.analyzedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">말투/어조: </span>
                  <span className="text-slate-900 font-semibold">{styleProfile?.tone || '미지정'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">문장 호흡: </span>
                  <span className="text-slate-900 font-semibold">{styleProfile?.sentenceStyle || '미지정'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">문단 구성: </span>
                  <span className="text-slate-900 font-semibold">{styleProfile?.paragraphStyle || '미지정'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">강조 방식: </span>
                  <span className="text-slate-900 font-semibold">{styleProfile?.emphasisStyle || '미지정'}</span>
                </div>
              </div>
              {styleProfile?.preferredPatterns && styleProfile.preferredPatterns.length > 0 && (
                <div>
                  <span className="text-slate-500 font-medium">선호 표현/패턴: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {styleProfile.preferredPatterns.map((p, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/60 rounded text-[11px]">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {styleProfile?.avoidPatterns && styleProfile.avoidPatterns.length > 0 && (
                <div>
                  <span className="text-slate-500 font-medium">지양 패턴: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {styleProfile.avoidPatterns.map((p, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200/60 rounded text-[11px]">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instructions and Sample Fill */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-xs text-slate-600 font-medium">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>평소 직접 작성하신 블로그 글의 본문(최소 3개)을 붙여넣어 주세요.</span>
            </div>
            <button
              type="button"
              onClick={handleFillSamples}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 px-2.5 py-1 rounded-lg transition-colors self-start sm:self-auto"
            >
              <Zap className="w-3 h-3" />
              예시 글 불러오기
            </button>
          </div>

          {/* Post Tabs */}
          <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1.5 overflow-x-auto">
            {posts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === idx
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>글 {idx + 1}</span>
                {p.trim().length >= 20 ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                )}
                {posts.length > 3 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePost(idx);
                    }}
                    className="hover:text-red-300 ml-1"
                    title="삭제"
                  >
                    ×
                  </span>
                )}
              </button>
            ))}

            {posts.length < 5 && (
              <button
                type="button"
                onClick={handleAddPost}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-lg transition-colors"
                title="글 추가"
              >
                + 글 추가
              </button>
            )}
          </div>

          {/* Active Post Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>[글 {activeTab + 1}] 본문 내용</span>
              <span>{posts[activeTab]?.length || 0}자</span>
            </div>
            <textarea
              rows={4}
              value={posts[activeTab] || ''}
              onChange={(e) => handlePostChange(activeTab, e.target.value)}
              placeholder={`작성하셨던 ${activeTab + 1}번째 블로그 글의 본문 텍스트를 복사하여 붙여넣으세요.`}
              className="w-full text-xs text-slate-800 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-sans leading-relaxed"
            />
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>
                준비 상태: <strong className={validCount >= 3 ? 'text-emerald-600' : 'text-amber-600'}>{validCount} / 3개</strong> 글 입력 완료
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing || validCount < 3}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all"
              >
                {isAnalyzing ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    문체 분석 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    {hasProfile ? '문체 프로필 재분석하기' : '나만의 문체 프로필 분석 시작'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

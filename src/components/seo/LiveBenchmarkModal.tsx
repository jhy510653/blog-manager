import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Search,
  FileText,
  ExternalLink,
  Info,
  CheckCircle2,
  Code2,
  RefreshCw,
  Sparkles,
  Layers,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';
import { TopPostItem } from '../../types';

interface LiveBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  keyword: string;
  initialTopPosts?: TopPostItem[];
  initialRelatedKeywords?: string[];
  initialBenchmarkPrompt?: string;
  onApplyKeyword?: (keyword: string) => void;
}

export const LiveBenchmarkModal: React.FC<LiveBenchmarkModalProps> = ({
  isOpen,
  onClose,
  keyword,
  initialTopPosts,
  initialRelatedKeywords,
  initialBenchmarkPrompt,
  onApplyKeyword
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [topPosts, setTopPosts] = useState<TopPostItem[]>(initialTopPosts || []);
  const [relatedKeywords, setRelatedKeywords] = useState<string[]>(initialRelatedKeywords || []);
  const [benchmarkPrompt, setBenchmarkPrompt] = useState<string>(initialBenchmarkPrompt || '');
  const [fetchedAt, setFetchedAt] = useState<string>('');
  const [showRawPrompt, setShowRawPrompt] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBenchmarkData = async (targetKw: string) => {
    if (!targetKw.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/benchmark-preview?keyword=${encodeURIComponent(targetKw.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || '네이버 데이터 수집 중 오류가 발생했습니다.');
      }
      setTopPosts(data.topPosts || []);
      setRelatedKeywords(data.relatedKeywords || []);
      setBenchmarkPrompt(data.benchmarkPrompt || '');
      setFetchedAt(new Date().toLocaleTimeString('ko-KR'));
    } catch (err: any) {
      setError(err?.message || '네이버 데이터 수집에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && keyword.trim()) {
      if (initialTopPosts && initialTopPosts.length > 0) {
        setTopPosts(initialTopPosts);
        setRelatedKeywords(initialRelatedKeywords || []);
        setBenchmarkPrompt(initialBenchmarkPrompt || '');
        setFetchedAt(new Date().toLocaleTimeString('ko-KR'));
      } else {
        fetchBenchmarkData(keyword);
      }
    }
  }, [isOpen, keyword]);

  if (!isOpen) return null;

  const handleCopyPrompt = () => {
    if (!benchmarkPrompt) return;
    navigator.clipboard.writeText(benchmarkPrompt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  실시간 네이버 수집 원본 데이터 검증
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-mono font-bold">
                  LIVE BENCHMARK
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                키워드 <span className="font-extrabold text-blue-400">"{keyword}"</span>의 실시간 네이버 상위 1~5위 글 및 연관검색어 수집 내역입니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchBenchmarkData(keyword)}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              title="실시간 네이버 데이터 다시 수집"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Status summary pill bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800 text-[11px]">
            <div className="flex items-center gap-4">
              <span className="text-slate-400">
                수집 상태: <strong className="text-emerald-400">✓ 정상 연결</strong>
              </span>
              <span className="text-slate-400">
                연관검색어: <strong className="text-emerald-400">{relatedKeywords.length}개</strong>
              </span>
              <span className="text-slate-400">
                상위 노출 포스팅: <strong className="text-blue-400">{topPosts.length}개</strong>
              </span>
            </div>
            {fetchedAt && (
              <span className="text-slate-500 font-mono text-[10px]">
                수집 시각: {fetchedAt}
              </span>
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-xl text-xs">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-300">네이버 실시간 검색 결과를 수집 및 분석 중입니다...</p>
              <p className="text-xs text-slate-500">연관검색어 및 상위 1~5위 포스팅의 제목과 본문 스니펫을 스크랩하고 있습니다.</p>
            </div>
          ) : (
            <>
              {/* ① 연관검색어 검증 */}
              <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-emerald-400 text-xs flex items-center gap-1.5">
                    <Search className="w-4 h-4" />
                    <span>① 실시간 네이버 연관 검색어</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                      총 {relatedKeywords.length}개 수집
                    </span>
                  </span>
                </div>

                {relatedKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {relatedKeywords.map((kw, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-emerald-300 font-medium text-[11px] hover:border-emerald-500 transition-colors"
                      >
                        <span className="text-slate-500 mr-1">#{idx + 1}</span>
                        {kw}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">네이버 연관검색어 응답이 없습니다.</p>
                )}
              </div>

              {/* ② & ③ 블로그 상위 1~5위 실제 제목 및 스니펫 */}
              <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-blue-400 text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>② & ③ 네이버 블로그 상위 1~5위 실제 제목 및 본문 요약 스니펫</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold">
                      {topPosts.length}개 포스팅 수집
                    </span>
                  </span>
                </div>

                {topPosts.length > 0 ? (
                  <div className="space-y-3">
                    {topPosts.map((post, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900 rounded-xl p-3.5 border border-slate-800 space-y-2.5 hover:border-slate-700 transition-all"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 flex-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold shrink-0 mt-0.5 ${
                              idx === 0
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : idx === 1
                                ? 'bg-slate-300/20 text-slate-200 border border-slate-400/40'
                                : idx === 2
                                ? 'bg-amber-700/20 text-amber-400 border border-amber-700/40'
                                : 'bg-blue-900/40 text-blue-300 border border-blue-700/40'
                            }`}>
                              {idx + 1}위
                            </span>
                            <div className="space-y-0.5 flex-1">
                              <h5 className="font-extrabold text-xs sm:text-sm text-white leading-snug">
                                {post.title}
                              </h5>
                              {post.bloggername && (
                                <p className="text-[10px] text-slate-400">
                                  작성 블로거: <strong className="text-slate-300">{post.bloggername}</strong>
                                </p>
                              )}
                            </div>
                          </div>

                          {post.link && (
                            <a
                              href={post.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-[10px] font-bold flex items-center gap-1 border border-slate-700 transition-colors shrink-0"
                            >
                              <span>원문 포스팅 열기</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        {/* Snippet summary */}
                        <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-800/80 space-y-1">
                          <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            <span>네이버 검색 본문 요약 스니펫:</span>
                          </span>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {post.description || '스니펫 요약 데이터가 없습니다.'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">상위 노출 포스팅 수집 결과가 없습니다.</p>
                )}
              </div>

              {/* ④ AI 최종 기획안 반영 확인 & 프롬프트 원문 */}
              <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-indigo-400 text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                    <span>④ AI 최종 기획안 반영 원리 & 전송 데이터</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setShowRawPrompt(!showRawPrompt)}
                    className="text-[10px] font-mono text-indigo-300 hover:text-white underline flex items-center gap-1 cursor-pointer"
                  >
                    <Code2 className="w-3 h-3" />
                    <span>{showRawPrompt ? '프롬프트 닫기' : 'AI 주입 프롬프트 확인'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 space-y-1">
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>연관검색어 기반 키워드 클러스터링</span>
                    </span>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      네이버 자동완성 및 연관검색어 {relatedKeywords.length}개를 분석하여 독자가 실제로 검색하는 핵심 키워드와 롱테일 키워드로 분류하여 기획안에 배치합니다.
                    </p>
                  </div>

                  <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 space-y-1">
                    <span className="font-bold text-blue-400 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      <span>상위 1~5위 글 패턴 분석 & 차별화 소제목</span>
                    </span>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      현재 1~5위를 점유 중인 글들의 제목 구조와 스니펫 내용을 분석하여, 기존 글들이 다루는 공통 정보는 충실히 담되 누락된 검색 의도를 보완하는 차별화된 H2 목차를 자동 설계합니다.
                    </p>
                  </div>
                </div>

                {showRawPrompt && benchmarkPrompt && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>AI 모델에 실시간으로 주입되는 벤치마크 텍스트 블록:</span>
                      <button
                        type="button"
                        onClick={handleCopyPrompt}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{isCopied ? '복사됨' : '복사'}</span>
                      </button>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-indigo-900/60 text-[10px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto select-all">
                      {benchmarkPrompt}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span>AI 블로그 초안 생성 시 이 실시간 수집 데이터가 시스템 프롬프트에 자동 주입됩니다.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

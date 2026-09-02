import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  Rss,
  CheckCircle2,
  Clock,
  Sparkles,
  Code2,
  Copy,
  Check,
  AlertTriangle,
  Play,
  Server,
  FileCode,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Participant } from '../types';
import { runBatchDataCollector, verifyAndSyncParticipantData, syncBulkToSupabase } from '../services/rssCollector';

interface RssCollectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  onDataUpdated: (updatedList: Participant[]) => void;
}

export const RssCollectorModal: React.FC<RssCollectorModalProps> = ({
  isOpen,
  onClose,
  participants,
  onDataUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'run' | 'cronGuide' | 'code'>('run');
  const [isRunning, setIsRunning] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedHeader, setCopiedHeader] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app-domain.run.app';
  const cronEndpointUrl = `${currentOrigin}/api/cron/update`;
  const defaultCronSecret = 'my-super-secret-cron-key-12345';
  const authHeaderValue = `Bearer ${defaultCronSecret}`;

  const curlSnippet = `curl -X POST "${cronEndpointUrl}" \\
  -H "Authorization: Bearer ${defaultCronSecret}" \\
  -H "Content-Type: application/json"`;

  const handleRunCollector = async () => {
    setIsRunning(true);
    setLogs([]);
    setProgressMsg('네이버 블로그 RSS 파싱 및 트위터 수집 시작 중...');

    try {
      const { updatedParticipants, uniqueBlogPosts, logSummary } = await runBatchDataCollector(
        participants,
        (current, total, name) => {
          setProgressMsg(`(${current}/${total}) ${name} 님의 RSS 수집 중...`);
        }
      );

      setProgressMsg('데이터 정합성 검증 중...');
      const { verifiedParticipants, auditLog } = await verifyAndSyncParticipantData(updatedParticipants);

      setProgressMsg('Supabase DB에 고유 포스팅 원장 및 통계 저장 중...');
      await syncBulkToSupabase(verifiedParticipants, uniqueBlogPosts);

      setLogs([...logSummary, ...auditLog]);
      onDataUpdated(verifiedParticipants);
      setProgressMsg(
        `수집 완료! 고유 포스팅 ${uniqueBlogPosts.length}개 원장 등록 및 모든 참가자 정보가 최신 상태로 갱신되었습니다.`
      );
    } catch (err: any) {
      setLogs((prev) => [...prev, `[오류] 수집 실패: ${err.message}`]);
      setProgressMsg('수집 중 일부 오류가 발생했습니다.');
    } finally {
      setIsRunning(false);
    }
  };

  const copyToClipboard = (text: string, type: 'url' | 'header' | 'curl') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else if (type === 'header') {
      setCopiedHeader(true);
      setTimeout(() => setCopiedHeader(false), 2000);
    } else if (type === 'curl') {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-orange-900 via-amber-950 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-400">
              <Rss className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight">자동 RSS 수집기 & 일별 스케줄러(Cron)</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-500/20 text-orange-300 border border-orange-400/30">
                  매일 자정 실행
                </span>
              </div>
              <p className="text-xs text-orange-200/90">
                네이버 블로그 RSS 파싱 및 cron-job.org 외부 스케줄러를 통한 자동 일별 갱신
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-orange-300 hover:text-white hover:bg-orange-900/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Nav Tabs */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center space-x-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('run')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'run'
                ? 'bg-white text-orange-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Play className="w-4 h-4 text-orange-600" />
            <span>① RSS 수집기 라이브 테스트</span>
          </button>

          <button
            onClick={() => setActiveTab('cronGuide')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'cronGuide'
                ? 'bg-white text-orange-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Clock className="w-4 h-4 text-orange-600" />
            <span>② 외부 스케줄러(cron-job.org) 연동 가이드</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'code'
                ? 'bg-white text-orange-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Code2 className="w-4 h-4 text-orange-600" />
            <span>③ cURL 테스트 & API 스펙</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 max-h-[68vh] overflow-y-auto">
          {/* TAB 1: Live Collector Execution */}
          {activeTab === 'run' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-xl space-y-1 text-orange-950">
                <h4 className="font-bold text-xs flex items-center gap-1.5 text-orange-900">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                  <span>네이버 블로그 RSS 즉시 수집 & 테스트</span>
                </h4>
                <p className="text-[11px] text-orange-800">
                  등록된 참가자의 네이버 블로그 URL(
                  <code className="bg-orange-100 px-1 rounded font-mono">https://rss.blog.naver.com/아이디.xml</code>)을
                  호출하여 챌린지 기간 작성한 글을 수집하고 Supabase DB에 실시간 저장합니다.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <strong className="text-slate-900 block font-bold text-xs">
                    현재 등록된 대상 참가자: {participants.length}명
                  </strong>
                  <p className="text-[11px] text-slate-500">
                    블로그 RSS 파싱, 중복 포스팅 필터링 및 통계 동기화 실행
                  </p>
                </div>

                <button
                  onClick={handleRunCollector}
                  disabled={isRunning}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
                  <span>{isRunning ? '수집 실행 중...' : '지금 RSS 수집 실행'}</span>
                </button>
              </div>

              {progressMsg && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 font-medium text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{progressMsg}</span>
                </div>
              )}

              {/* Logs output */}
              {logs.length > 0 && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 text-xs">수집 로그 및 결과</label>
                  <div className="bg-slate-900 text-orange-300 p-3.5 rounded-xl font-mono text-[11px] overflow-y-auto max-h-52 leading-relaxed border border-slate-800 space-y-1">
                    {logs.map((log, idx) => (
                      <div key={idx} className="border-b border-slate-800/80 pb-1 last:border-none">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: External Scheduler (cron-job.org) Guide */}
          {activeTab === 'cronGuide' && (
            <div className="space-y-4 text-xs text-slate-700">
              <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-2.5 text-orange-950">
                <Clock className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-orange-900 text-xs">
                    cron-job.org 같은 외부 무료 스케줄러로 이 서버 URL의 /api/cron/update를 매일 호출하도록 등록하세요
                  </h4>
                  <p className="text-[11px] text-orange-800 mt-1 leading-relaxed">
                    본 시스템은 Cloud Run 컨테이너 환경에서 실행되므로, 외부 무료 스케줄러(cron-job.org 등)를 통해 <strong>매일 자정 (00:00 KST)</strong>에 아래 엔드포인트를 호출하면 전체 참가자의 블로그 RSS를 자동으로 파싱하고 DB를 갱신합니다.
                  </p>
                </div>
              </div>

              <ol className="space-y-3 list-none">
                <li className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <span className="w-5 h-5 rounded-full bg-orange-600 text-white font-bold text-[10px] flex items-center justify-center">
                        1
                      </span>
                      <span>스케줄러 서비스 가입 및 작업 생성</span>
                    </span>
                    <a
                      href="https://cron-job.org"
                      target="_blank"
                      rel="noreferrer"
                      className="text-orange-700 hover:underline inline-flex items-center gap-1 text-[11px] font-bold"
                    >
                      <span>cron-job.org 이동</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-600 pl-6 leading-relaxed">
                    무료 스케줄러 사이트 <strong className="text-slate-900">cron-job.org</strong>에 가입한 후 대시보드에서 <strong>[Create Cronjob]</strong> 버튼을 클릭합니다.
                  </p>
                </li>

                <li className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-orange-600 text-white font-bold text-[10px] flex items-center justify-center">
                      2
                    </span>
                    <span>호출 URL 및 Method 설정</span>
                  </span>
                  <div className="pl-6 space-y-1.5">
                    <p className="text-[11px] text-slate-600">
                      • <strong>Method:</strong> <span className="font-mono font-bold text-orange-700 bg-orange-100 px-1 rounded">POST</span> 선택
                    </p>
                    <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                      <code className="text-[11px] font-mono text-slate-800 truncate select-all">{cronEndpointUrl}</code>
                      <button
                        onClick={() => copyToClipboard(cronEndpointUrl, 'url')}
                        className="ml-2 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUrl ? '복사됨' : 'URL 복사'}</span>
                      </button>
                    </div>
                  </div>
                </li>

                <li className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <span className="w-5 h-5 rounded-full bg-orange-600 text-white font-bold text-[10px] flex items-center justify-center">
                        3
                      </span>
                      <span>Authorization 인증 헤더 설정 (필수)</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      보안 검증
                    </span>
                  </div>
                  <div className="pl-6 space-y-1.5">
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      cron-job.org의 <strong>[Advanced / Headers]</strong> 섹션에서 [Add Header]를 클릭하고 아래 인증 헤더를 등록합니다.
                    </p>
                    <div className="bg-white border border-slate-200 rounded-lg p-2 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-700">
                        <span><strong>Header Name:</strong> <code className="bg-slate-100 px-1 rounded text-orange-800">Authorization</code></span>
                        <button
                          onClick={() => copyToClipboard(authHeaderValue, 'header')}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {copiedHeader ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedHeader ? '복사됨' : 'Value 복사'}</span>
                        </button>
                      </div>
                      <div className="text-[11px] font-mono text-slate-800 bg-slate-50 p-1.5 rounded border border-slate-100 select-all">
                        <strong>Header Value:</strong> {authHeaderValue}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      * 서버 환경변수 <code className="font-mono">CRON_SECRET</code>과 일치하는 값을 Bearer 토큰으로 전송해야 보안 검증을 통과합니다.
                    </p>
                  </div>
                </li>

                <li className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-orange-600 text-white font-bold text-[10px] flex items-center justify-center">
                      4
                    </span>
                    <span>실행 주기 및 저장</span>
                  </span>
                  <p className="text-[11px] text-slate-600 pl-6 leading-relaxed">
                    • <strong>Execution Schedule:</strong> <strong>Every day (00:00 KST / 매일 자정)</strong> 선택<br />
                    • 하단의 [Create Cronjob]을 클릭하여 저장을 완료하면, 매일 자정에 서버가 자동으로 RSS 데이터를 수집하고 Supabase에 안전하게 누적합니다.
                  </p>
                </li>
              </ol>
            </div>
          )}

          {/* TAB 3: Code & cURL View */}
          {activeTab === 'code' && (
            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1">
                    <Code2 className="w-4 h-4 text-orange-600" />
                    <span>1. cURL 터미널 테스트 명령어</span>
                  </label>
                  <button
                    onClick={() => copyToClipboard(curlSnippet, 'curl')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCurl ? '복사됨!' : '명령어 복사'}</span>
                  </button>
                </div>
                <div className="bg-slate-900 text-orange-300 p-3.5 rounded-xl font-mono text-[11px] leading-relaxed border border-slate-800 overflow-x-auto">
                  <pre>{curlSnippet}</pre>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-orange-600" />
                  <span>2. 서버 환경변수 (CRON_SECRET)</span>
                </label>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-[11px] space-y-1.5 leading-relaxed">
                  <p>
                    서버의 <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-900">.env</code> 파일에 정의된 <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-900">CRON_SECRET</code> 값과 요청 헤더의 Bearer 토큰이 일치해야만 수집 작업이 승인됩니다.
                  </p>
                  <div className="bg-white p-2 rounded border border-slate-200 font-mono text-[10px] text-slate-800">
                    CRON_SECRET="{defaultCronSecret}"
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

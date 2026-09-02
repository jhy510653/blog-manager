import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  Copy,
  ExternalLink,
  Key,
  Globe,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Code2,
  Check,
  Server,
  CloudCheck,
} from 'lucide-react';
import {
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  getSupabaseClient,
  SUPABASE_SQL_SCHEMA,
  SUPABASE_PURGE_DUMMY_SQL,
  deleteDummyParticipantsFromSupabase,
} from '../lib/supabase';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [copiedPurge, setCopiedPurge] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'guide' | 'config' | 'sql'>('guide');

  useEffect(() => {
    if (isOpen) {
      const config = getStoredSupabaseConfig();
      setUrl(config.url);
      setAnonKey(config.key);
      setTestResult(null);
      setPurgeResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopySchemaSQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2500);
  };

  const handleCopyPurgeSQL = () => {
    navigator.clipboard.writeText(SUPABASE_PURGE_DUMMY_SQL);
    setCopiedPurge(true);
    setTimeout(() => setCopiedPurge(false), 2500);
  };

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    saveStoredSupabaseConfig(url, anonKey);
    onConfigUpdated();

    if (!url.trim() || !anonKey.trim()) {
      setTestResult({
        success: false,
        message: 'URL과 Anon Key가 비어 있어 메모리/로컬 모드로 전환되었습니다.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const client = getSupabaseClient();
    if (!client) {
      setTestResult({
        success: false,
        message: '올바른 URL 형식(https://...)을 입력해 주세요.',
      });
      setTesting(false);
      return;
    }

    try {
      const { error } = await client.from('challenges').select('count', { count: 'exact', head: true });
      if (error) {
        setTestResult({
          success: false,
          message: `연결 오류: ${error.message} (SQL 쿼리로 테이블을 생성을 하셨는지 확인해 주세요)`,
        });
      } else {
        setTestResult({
          success: true,
          message: 'Supabase DB와 정상적으로 연결되었습니다! 바로 사용하실 수 있습니다.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `연결 중 예외 발생: ${err.message || '네트워크 확인 필요'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handlePurgeDummyData = async () => {
    const client = getSupabaseClient();
    if (!client) {
      setPurgeResult('먼저 API Key와 URL을 입력하고 저장해 주세요.');
      return;
    }

    setPurging(true);
    setPurgeResult(null);

    try {
      const res = await deleteDummyParticipantsFromSupabase();
      setPurgeResult(res.message);
      onConfigUpdated();
    } catch (err: any) {
      setPurgeResult(`삭제 실패: ${err.message || 'Supabase 테이블 상태를 확인해주세요'}`);
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight">Supabase 무료 데이터베이스 연동 안내</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Cloud DB
                </span>
              </div>
              <p className="text-xs text-emerald-200/90">
                실시간 데이터 저장소 Supabase 설정, SQL 테이블 및 API Key 등록
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-900/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center space-x-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'guide'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>① 가입 및 키 발급 안내</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'config'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Key className="w-4 h-4 text-emerald-600" />
            <span>② API Key & URL 입력</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'sql'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Code2 className="w-4 h-4 text-emerald-600" />
            <span>③ SQL 테이블 생성 쿼리</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 max-h-[68vh] overflow-y-auto">
          
          {/* TAB 1: Beginner Step-by-Step Guide */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs text-slate-700">
              
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3">
                <CloudCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-950 text-sm">Supabase 무료 클라우드 DB 연동 준비사항</h4>
                  <p className="text-emerald-800 text-xs mt-0.5">
                    Supabase는 매월 무제한 조회와 500MB 무료 용량을 제공하는 PostgreSQL 서비스입니다. 아래 4단계를 따라해보세요.
                  </p>
                </div>
              </div>

              <ol className="space-y-3.5 list-none">
                
                <li className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">1</span>
                      <span>Supabase 무료 회원가입 및 새 프로젝트 생성</span>
                    </span>
                    <a
                      href="https://supabase.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 hover:underline inline-flex items-center gap-1 text-[11px] font-bold"
                    >
                      <span>supabase.com 방문</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-slate-600 text-[11px] pl-6">
                    Github 또는 이메일로 가입 후 <strong className="text-slate-800">[New Project]</strong> 클릭 ➔ 프로젝트 이름(예: <code className="bg-slate-200 px-1 rounded">challenge-db</code>)과 비밀번호 입력 후 생성합니다 (약 1분 소요).
                  </p>
                </li>

                <li className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">2</span>
                    <span>SQL Editor에서 테이블 자동 생성 (3단계 탭 클릭)</span>
                  </span>
                  <p className="text-slate-600 text-[11px] pl-6">
                    Supabase 대시보드 좌측 메뉴의 <strong className="text-slate-800">SQL Editor</strong>로 이동합니다. 위 탭 상단의 <button onClick={() => setActiveTab('sql')} className="text-emerald-700 underline font-bold">③ SQL 테이블 생성 쿼리</button> 버튼을 눌러 복사한 후, SQL Editor에 붙여넣고 <strong className="text-slate-800">[Run]</strong>을 누릅니다.
                  </p>
                </li>

                <li className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">3</span>
                    <span>Project URL & anon public API Key 확인하기</span>
                  </span>
                  <p className="text-slate-600 text-[11px] pl-6">
                    좌측 메뉴 <strong className="text-slate-800">Project Settings ➔ API</strong> 항목으로 이동합니다.<br />
                    • <strong>Project URL</strong> (예: <code className="bg-slate-200 px-1 rounded">https://xyzcompany.supabase.co</code>)<br />
                    • <strong>Project API keys ➔ anon (public)</strong> 키 복사
                  </p>
                </li>

                <li className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">4</span>
                    <span>웹 앱 설정 탭에 입력 또는 env 설정</span>
                  </span>
                  <p className="text-slate-600 text-[11px] pl-6">
                    상단 <button onClick={() => setActiveTab('config')} className="text-emerald-700 underline font-bold">② API Key & URL 입력</button> 탭을 눌러 복사한 URL과 Key를 직접 입력하고 [저장 및 연결 테스트]를 누르면 즉시 실시간 데이터베이스 연동이 완료됩니다!
                  </p>
                </li>

              </ol>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setActiveTab('config')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>다음: API Key 및 URL 입력하기</span>
                  <Key className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: API Key Configuration Form */}
          {activeTab === 'config' && (
            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-slate-700 font-medium">
                  Supabase 대시보드의 <strong className="text-slate-900">Project Settings ➔ API</strong>에서 얻은 URL과 anon public 키를 입력하세요.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Project URL (VITE_SUPABASE_URL)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://your-project-id.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-emerald-600" />
                  <span>anon public Key (VITE_SUPABASE_ANON_KEY)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="eyJhY2Nlc3NfdG9rZW4iOi... (Supabase anon key)"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px] text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <strong className="block font-bold">{testResult.success ? '연결 성공!' : '연결 실패'}</strong>
                    <p className="text-[11px] mt-0.5">{testResult.message}</p>
                  </div>
                </div>
              )}

              {purgeResult && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-[11px] font-bold">
                  {purgeResult}
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handlePurgeDummyData}
                  disabled={purging || !url || !anonKey}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title="Supabase DB에 존재하는 임의 테스트 데이터(p1, p2, p4 등)를 영구 삭제합니다"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${purging ? 'animate-spin' : ''}`} />
                  <span>{purging ? '더미 데이터 삭제 중...' : 'DB 잔여 더미 데이터 정리'}</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="submit"
                    disabled={testing}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>{testing ? '연결 확인 중...' : '설정 저장 및 연결 검증'}</span>
                  </button>
                </div>
              </div>

            </form>
          )}

          {/* TAB 3: Copy SQL Script */}
          {activeTab === 'sql' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">① Supabase 테이블 생성 SQL 쿼리</h4>
                  <p className="text-[11px] text-slate-500">
                    `challenges`, `participants`, `daily_stats` 테이블 및 RLS 보안 규칙
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySchemaSQL}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedSchema ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSchema ? '복사 완료!' : '테이블 생성 SQL 복사'}</span>
                </button>
              </div>

              <div className="relative bg-slate-900 text-emerald-400 p-3.5 rounded-xl border border-slate-800 font-mono text-[11px] overflow-x-auto max-h-48 leading-relaxed">
                <pre>{SUPABASE_SQL_SCHEMA}</pre>
              </div>

              {/* Purge SQL Block */}
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-rose-950 text-xs">② 잔여 더미 레코드(p1, p2, p4 등) 완전 삭제 SQL</h4>
                  <p className="text-[11px] text-rose-700">
                    과거 생성된 더미 ID(p1~p5, test 등) 및 비정상 참가자 데이터를 DB에서 영구 정리합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPurgeSQL}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedPurge ? <Check className="w-4 h-4 text-rose-200" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPurge ? '복사 완료!' : '더미 삭제 SQL 복사'}</span>
                </button>
              </div>

              <div className="relative bg-slate-950 text-rose-300 p-3.5 rounded-xl border border-rose-900/40 font-mono text-[11px] overflow-x-auto max-h-36 leading-relaxed">
                <pre>{SUPABASE_PURGE_DUMMY_SQL}</pre>
              </div>

              <p className="text-[11px] text-slate-500">
                💡 Supabase 대시보드 ➔ <strong>SQL Editor</strong> ➔ New Query ➔ 붙여넣기 후 <strong className="text-slate-800">[Run]</strong> 버튼을 누르시면 즉시 정리됩니다.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            환경 변수 <code className="bg-slate-200 px-1 rounded text-slate-800 font-mono">.env.example</code> 파일 참고
          </span>
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

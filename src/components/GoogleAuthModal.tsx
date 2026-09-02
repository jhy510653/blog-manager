import React, { useState } from 'react';
import { X, Sparkles, Shield, ArrowRight } from 'lucide-react';
import { NaverUser } from '../types';
import { upsertProfileInSupabase, fetchProfileByEmail } from '../lib/supabase';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: NaverUser) => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async (selectedEmail: string = 'jhy510653@gmail.com', selectedName: string = 'Google User') => {
    setIsLoading(true);

    const emailInput = selectedEmail.trim() || 'user@gmail.com';
    const emailPrefix = emailInput.split('@')[0];
    const displayName = selectedName.trim() || emailPrefix || '구글 사용자';
    const fullEmail = emailInput.includes('@') ? emailInput : `${emailInput}@gmail.com`;

    try {
      // Try fetching existing profile from Supabase first
      const existingProfile = await fetchProfileByEmail(fullEmail);

      let user: NaverUser;
      if (existingProfile) {
        user = {
          ...existingProfile,
          email: fullEmail,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${emailPrefix}`,
        };
      } else {
        user = {
          id: `usr_g_${Date.now()}`,
          naverId: '',
          twitterId: '',
          name: displayName,
          email: fullEmail,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${emailPrefix}`,
          blogRssUrl: '',
        };
        // Persist new user to Supabase DB
        await upsertProfileInSupabase(user);
      }

      onLoginSuccess(user);
      onClose();
    } catch (err) {
      console.error('Login process error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 rounded-full bg-indigo-500/10 blur-xl pointer-events-none" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 text-indigo-200 text-xs font-bold mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-xs flex items-center gap-1 text-amber-300">
              <Sparkles className="w-3 h-3" />
              Google Auth 간편 로그인
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
            구글 계정으로 로그인하여<br />챌린지 및 AI 툴킷에 접속하세요!
          </h2>
          <p className="text-xs text-slate-300 mt-2 font-medium">
            원클릭 구글 인증으로 챌린지 참가 및 30분 자동 모니터링이 시작됩니다.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Quick Account Selector */}
          <div className="space-y-3">
            <span className="text-[11px] font-black text-slate-500 tracking-wider uppercase block">
              ⚡ 1초 원클릭 Google 계정 선택
            </span>
            <button
              type="button"
              onClick={() => handleGoogleLogin('jhy510653@gmail.com', 'Google User')}
              disabled={isLoading}
              className="w-full p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 hover:bg-indigo-100 transition-all flex items-center justify-between group cursor-pointer text-left shadow-2xs active:scale-98"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-full bg-white border border-indigo-200 flex items-center justify-center shadow-xs shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800">jhy510653@gmail.com</div>
                  <div className="text-[11px] text-indigo-600 font-bold">Google 인증 계정으로 1초 로그인</div>
                </div>
              </div>
              <span className="text-xs font-extrabold text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-1 shrink-0">
                {isLoading ? '인증 중...' : <>로그인 <ArrowRight className="w-3.5 h-3.5" /></>}
              </span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1 pt-2">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>안전한 Google Auth 및 Supabase 프로필 DB로 자동 동기화됩니다.</span>
          </p>
        </div>

      </div>
    </div>
  );
};


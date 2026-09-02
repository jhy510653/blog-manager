import React from 'react';
import { X, AlertCircle, UserCheck, ArrowRight, Sparkles } from 'lucide-react';

interface ProfileRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredType: 'blog' | 'twitter' | 'both';
  challengeName: string;
  onOpenProfileModal: () => void;
}

export const ProfileRequiredModal: React.FC<ProfileRequiredModalProps> = ({
  isOpen,
  onClose,
  requiredType,
  challengeName,
  onOpenProfileModal,
}) => {
  if (!isOpen) return null;

  const getNoticeMessage = () => {
    if (requiredType === 'blog') {
      return {
        title: '네이버 블로그 아이디 미등록',
        desc: '네이버 블로그 챌린지 참가 및 30분 자동 수집(RSS)을 위해 네이버 아이디 등록이 필요합니다.',
        requiredField: '네이버 아이디 (네이버 블로그 ID)',
      };
    } else if (requiredType === 'twitter') {
      return {
        title: '트위터(X) 계정 ID 미등록',
        desc: '트위터 챌린지 참가 및 트윗/답글 자동 집계를 위해 트위터 아이디(@username) 등록이 필요합니다.',
        requiredField: '트위터 계정 ID (@핸들)',
      };
    } else {
      return {
        title: '네이버 및 트위터 계정 정보 미등록',
        desc: '듀얼 몰입 챌린지 참가를 위해 네이버 아이디와 트위터 계정 ID가 모두 필요합니다.',
        requiredField: '네이버 아이디 & 트위터 계정 ID',
      };
    }
  };

  const notice = getNoticeMessage();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FFFAF5] rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-[#F3E9E0] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold">{notice.title}</h3>
              <p className="text-[11px] text-amber-100 font-medium truncate max-w-[220px]">
                {challengeName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-slate-800">
          <div className="bg-white p-4 rounded-2xl border border-amber-200/80 space-y-2.5 shadow-xs">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-black">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>필수 프로필 정보 확인 안내</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {notice.desc}
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-900">
              <span>필수 입력 항목:</span>
              <span className="text-rose-600 font-black">{notice.requiredField}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 font-medium text-center">
            지금 [프로필 설정]에서 3초 만에 정보를 등록하고 챌린지에 도전해 보세요!
          </p>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProfileModal();
              }}
              className="w-full py-3.5 bg-[#6F4E37] hover:bg-[#5A3E31] text-white font-extrabold rounded-2xl text-xs transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
            >
              <UserCheck className="w-4 h-4" />
              <span>👤 프로필 설정으로 이동하여 등록하기</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-xs text-slate-500 font-bold hover:text-slate-700 transition-colors cursor-pointer"
            >
              나중에 하기
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

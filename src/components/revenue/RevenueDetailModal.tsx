import React, { useState } from 'react';
import {
  X,
  Heart,
  Share2,
  Trophy,
  Coins,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Edit3,
  Trash2,
  ShieldCheck,
  Award,
  Check,
  Copy,
  Maximize2,
} from 'lucide-react';
import { RevenueCertification, NaverUser, RevenueCertificationStatus } from '../../types';

interface RevenueDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cert: RevenueCertification | null;
  currentUser: NaverUser | null;
  isAdminLoggedIn: boolean;
  onToggleLike: (id: string) => void;
  onEditCert?: (cert: RevenueCertification) => void;
  onDeleteCert?: (id: string) => void;
  onUpdateStatus?: (
    id: string,
    status: RevenueCertificationStatus,
    options?: { rejectionReason?: string; isFeatured?: boolean; revenueAmount?: number }
  ) => void;
}

export const RevenueDetailModal: React.FC<RevenueDetailModalProps> = ({
  isOpen,
  onClose,
  cert,
  currentUser,
  isAdminLoggedIn,
  onToggleLike,
  onEditCert,
  onDeleteCert,
  onUpdateStatus,
}) => {
  const [copied, setCopied] = useState(false);
  const [isZoomImage, setIsZoomImage] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!isOpen || !cert) return null;

  const isLiked = currentUser ? cert.likedUserIds?.includes(currentUser.id) : false;
  const isOwner = currentUser ? cert.userId === currentUser.id : false;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdminApprove = () => {
    if (onUpdateStatus) {
      onUpdateStatus(cert.id, 'approved', {
        isFeatured: cert.isFeatured,
      });
    }
  };

  const handleAdminReject = () => {
    if (!rejectReason.trim()) {
      alert('반려 사유를 입력해 주세요.');
      return;
    }
    if (onUpdateStatus) {
      onUpdateStatus(cert.id, 'rejected', {
        rejectionReason: rejectReason.trim(),
      });
      setShowRejectBox(false);
    }
  };

  const handleToggleFeatured = () => {
    if (onUpdateStatus) {
      onUpdateStatus(cert.id, cert.status, {
        isFeatured: !cert.isFeatured,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-200 my-auto overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Top Floating Control Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/90">
          <div className="flex items-center space-x-2">
            {cert.status === 'approved' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                공식 인증 완료
              </span>
            )}
            {cert.status === 'pending' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                심사 대기 중
              </span>
            )}
            {cert.status === 'rejected' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                반려됨
              </span>
            )}
            {cert.isFeatured && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-xs font-extrabold shadow-xs">
                <Award className="w-3.5 h-3.5" />
                명예의 전당
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              title="링크 복사"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>

            {isOwner && onEditCert && (
              <button
                onClick={() => {
                  onClose();
                  onEditCert(cert);
                }}
                className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                title="수정하기"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}

            {(isOwner || isAdminLoggedIn) && onDeleteCert && (
              <button
                onClick={() => {
                  if (confirm('정말 이 수익 인증을 삭제하시겠습니까?')) {
                    onDeleteCert(cert.id);
                    onClose();
                  }
                }}
                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="삭제하기"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scroll Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Author Header & Revenue Hero Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-slate-50 p-5 rounded-3xl border border-amber-200/80">
            
            {/* User Profile */}
            <div className="flex items-center space-x-3.5">
              <img
                src={cert.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${cert.userName}`}
                alt={cert.userName}
                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 object-cover shadow-xs"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900">{cert.userName}</h3>
                  {cert.challengeName && (
                    <span className="px-2 py-0.5 bg-amber-100/80 text-amber-900 font-bold text-[10px] rounded-md">
                      {cert.challengeName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
                  {cert.naverBlogId && (
                    <a
                      href={`https://blog.naver.com/${cert.naverBlogId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-emerald-600 hover:underline flex items-center gap-0.5"
                    >
                      <span>네이버 블로그</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <span>·</span>
                  <span>{new Date(cert.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>
            </div>

            {/* Revenue Big Amount */}
            <div className="text-left sm:text-right bg-white sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-amber-200/60 shadow-2xs sm:shadow-none">
              <span className="text-[11px] font-bold text-amber-800 block">달성 인증 수익</span>
              <span className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight">
                ₩{cert.revenueAmount.toLocaleString('ko-KR')}
              </span>
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
              {cert.title}
            </h1>
          </div>

          {/* Rejection Alert if Rejected */}
          {cert.status === 'rejected' && cert.rejectionReason && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>관리자 반려 사유 안내</span>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed pl-5.5">
                {cert.rejectionReason}
              </p>
            </div>
          )}

          {/* Proof Image Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                수익 정산 증빙 캡처
              </span>
              <button
                type="button"
                onClick={() => setIsZoomImage(true)}
                className="text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                크게 보기
              </button>
            </div>

            <div
              onClick={() => setIsZoomImage(true)}
              className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 flex items-center justify-center cursor-pointer group max-h-[420px]"
            >
              <img
                src={cert.proofImageUrl}
                alt={cert.title}
                className="w-full h-auto max-h-[420px] object-contain transition-transform group-hover:scale-[1.01]"
              />
              <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="px-3.5 py-1.5 bg-black/70 text-white font-bold text-xs rounded-xl backdrop-blur-xs flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5" />
                  클릭하여 원본 확대
                </span>
              </div>
            </div>
          </div>

          {/* Story Content */}
          <div className="space-y-2 bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80">
            <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              수익화 노하우 & 생생 후기
            </h4>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line font-normal">
              {cert.content}
            </div>
          </div>

          {/* Like & Cheer Button */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => onToggleLike(cert.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer active:scale-95 border ${
                isLiked
                  ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-200'
                  : 'bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 border-slate-200 hover:border-rose-200'
              }`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              <span>축하 & 응원하기</span>
              <span className="px-1.5 py-0.5 bg-black/10 rounded-full text-[10px]">
                {cert.likesCount || 0}
              </span>
            </button>

            <span className="text-[11px] text-slate-400 font-medium">
              조회수 {(cert.viewsCount || 0).toLocaleString()}회
            </span>
          </div>

          {/* Admin Management Toolbar */}
          {isAdminLoggedIn && onUpdateStatus && (
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200">관리자 전용 심사 도구</span>
                </div>
                <span className="text-[10px] text-slate-400">현재 상태: {cert.status}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {cert.status !== 'approved' && (
                  <button
                    onClick={handleAdminApprove}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    공식 승인
                  </button>
                )}

                <button
                  onClick={handleToggleFeatured}
                  className={`px-3.5 py-2 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1 ${
                    cert.isFeatured
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  {cert.isFeatured ? '명예의 전당 해제' : '명예의 전당 등록'}
                </button>

                {cert.status !== 'rejected' && (
                  <button
                    onClick={() => setShowRejectBox(!showRejectBox)}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    반려 처리
                  </button>
                )}
              </div>

              {/* Reject Reason Input */}
              {showRejectBox && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <label className="block text-[11px] font-bold text-rose-300">
                    반려 사유 입력:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="예: 수익 증빙 캡처 식별 불가 / 금액 불일치"
                      className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                    />
                    <button
                      onClick={handleAdminReject}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                    >
                      반려 확정
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Fullscreen Image Zoom Modal */}
      {isZoomImage && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsZoomImage(false)}
        >
          <button
            onClick={() => setIsZoomImage(false)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={cert.proofImageUrl}
            alt={cert.title}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

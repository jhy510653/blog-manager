import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Coins,
  Sparkles,
  Trophy,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Trash2,
  FileText,
} from 'lucide-react';
import { RevenueCertification, ChallengeGroup, NaverUser } from '../../types';
import { uploadRevenueProofImage } from '../../lib/supabase';

interface RevenueSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: NaverUser | null;
  groups: ChallengeGroup[];
  onSubmit: (cert: RevenueCertification) => Promise<void> | void;
  editingCert?: RevenueCertification | null;
  onOpenGoogleAuth: () => void;
}

export const RevenueSubmitModal: React.FC<RevenueSubmitModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  groups = [],
  onSubmit,
  editingCert,
  onOpenGoogleAuth,
}) => {
  const [title, setTitle] = useState(editingCert?.title || '');
  const [revenueAmount, setRevenueAmount] = useState<string>(
    editingCert?.revenueAmount ? String(editingCert.revenueAmount) : ''
  );
  const [challengeId, setChallengeId] = useState(editingCert?.challengeId || '');
  const [content, setContent] = useState(editingCert?.content || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(editingCert?.proofImageUrl || '');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  if (!currentUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 border border-amber-200">
            <Coins className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-slate-900">로그인이 필요합니다</h3>
            <p className="text-xs text-slate-600">
              수익 인증을 등록하려면 먼저 구글 계정으로 로그인해 주세요.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              닫기
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenGoogleAuth();
              }}
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              로그인하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('이미지 파일(JPG, PNG, WebP)만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('파일 용량은 최대 10MB까지 가능합니다.');
      return;
    }

    setErrorMsg('');
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleQuickAddAmount = (addVal: number) => {
    const current = parseInt(revenueAmount.replace(/,/g, ''), 10) || 0;
    setRevenueAmount(String(current + addVal));
  };

  const formatNumberWithCommas = (val: string) => {
    const num = val.replace(/[^0-9]/g, '');
    return num ? Number(num).toLocaleString('ko-KR') : '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanAmount = parseInt(revenueAmount.replace(/[^0-9]/g, ''), 10);
    if (!title.trim()) {
      setErrorMsg('수익 인증 제목을 입력해 주세요.');
      return;
    }
    if (!cleanAmount || cleanAmount <= 0) {
      setErrorMsg('올바른 수익 인증 금액을 입력해 주세요.');
      return;
    }
    if (!imagePreview && !imageFile) {
      setErrorMsg('수익 증빙 캡처 이미지를 첨부해 주세요.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('수익 달성 후기 또는 운영 노하우를 간단히 작성해 주세요.');
      return;
    }

    setIsUploading(true);

    try {
      let finalImageUrl = imagePreview;

      // Upload image if a new file was chosen
      if (imageFile) {
        finalImageUrl = await uploadRevenueProofImage(imageFile, currentUser.id);
      }

      const selectedGroup = groups.find(g => g.id === challengeId);

      const certData: RevenueCertification = {
        id: editingCert?.id || `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: currentUser.id,
        userName: currentUser.name || '챌린저',
        userEmail: currentUser.email || '',
        userAvatar: currentUser.avatarUrl || '',
        naverBlogId: currentUser.naverId || '',
        challengeId: challengeId || undefined,
        challengeName: selectedGroup?.name || undefined,
        title: title.trim(),
        content: content.trim(),
        revenueAmount: cleanAmount,
        proofImageUrl: finalImageUrl,
        status: editingCert?.status || 'pending', // Submissions enter pending review
        rejectionReason: editingCert ? editingCert.rejectionReason : undefined,
        isFeatured: editingCert?.isFeatured || false,
        likesCount: editingCert?.likesCount || 0,
        viewsCount: (editingCert?.viewsCount || 0) + 1,
        likedUserIds: editingCert?.likedUserIds || [],
        createdAt: editingCert?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSubmit(certData);
      onClose();
    } catch (err: any) {
      console.error('Revenue submit error:', err);
      setErrorMsg(err?.message || '수익 인증 등록 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 my-auto overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {editingCert ? '수익 인증 수정하기' : '새로운 수익 인증 등록하기'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                챌린지를 통해 거둔 값진 결실을 공유하고 동료들과 성취를 나눠보세요
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2.5 text-xs text-rose-700 font-semibold animate-in shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. 인증 제목 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              인증 제목 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: [애드포스트/제휴] 3기 블로그 챌린지 2주 만에 첫 수익 35만 원 달성!"
              maxLength={80}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
            />
          </div>

          {/* 2. 인증 수익 금액 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              인증 수익 금액 (원) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                ₩
              </div>
              <input
                type="text"
                value={revenueAmount ? formatNumberWithCommas(revenueAmount) : ''}
                onChange={(e) => setRevenueAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                className="w-full pl-8 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-right"
              />
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-xs">
                원
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {[100000, 300000, 500000, 1000000, 3000000, 5000000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickAddAmount(amt)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-lg transition-colors cursor-pointer active:scale-95"
                >
                  +{(amt / 10000).toLocaleString()}만원
                </button>
              ))}
              {revenueAmount && (
                <button
                  type="button"
                  onClick={() => setRevenueAmount('')}
                  className="px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                >
                  초기화
                </button>
              )}
            </div>
          </div>

          {/* 3. 관련 챌린지 선택 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              관련 챌린지 (선택)
            </label>
            <select
              value={challengeId}
              onChange={(e) => setChallengeId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">챌린지 선택 안함 (개인 블로그/SNS 수익)</option>
              {groups.map((grp) => (
                <option key={grp.id} value={grp.id}>
                  {grp.name} ({grp.category === 'blog' ? '네이버 블로그' : grp.category === 'twitter' ? '트위터/X' : '블로그+트위터'})
                </option>
              ))}
            </select>
          </div>

          {/* 4. 증빙 이미지 첨부 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              수익 증빙 캡처 이미지 <span className="text-rose-500">*</span>
            </label>

            {imagePreview ? (
              <div className="relative rounded-2xl border-2 border-amber-200 overflow-hidden bg-slate-900 group">
                <img
                  src={imagePreview}
                  alt="Proof Preview"
                  className="w-full max-h-64 object-contain mx-auto"
                />
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white/90 hover:bg-white text-slate-900 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    이미지 교체
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview('');
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    삭제
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/40 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800">
                    수익 정산 화면, 애드포스트, 원고료 입금 내역 캡처 업로드
                  </p>
                  <p className="text-[11px] text-slate-500">
                    JPG, PNG, WebP (최대 10MB) · 클릭하거나 드래그하여 첨부
                  </p>
                </div>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* 5. 수익 달성 후기 및 팁 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              수익 달성 후기 & 팁 공유 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="챌린지 진행 중 어떤 전략(황금 키워드 공략, 1일 1포스팅 스트릭, 협찬/제휴 등)으로 수익을 창출하셨나요? 동료 챌린저들에게 도움이 될 팁을 자유롭게 남겨주세요!"
              rows={5}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all leading-relaxed"
            />
          </div>

          {/* Information Banner */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start space-x-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-[11px] text-amber-900 leading-relaxed">
              <span className="font-bold">심사 및 명예의 전당 등록 안내:</span> 등록된 수익 인증은 관리자의 진위 확인 후 공식 승인되며, 우수 사례는 <strong>명예의 전당</strong>에 핀 고정되어 모든 챌린저에게 소개됩니다.
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl text-xs shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>인증 등록 중...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingCert ? '수정 완료' : '수익 인증 등록하기'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

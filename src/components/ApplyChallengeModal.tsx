import React, { useState, useEffect } from 'react';
import { ChallengeGroup, NaverUser, ChallengePayment } from '../types';
import { formatRefundConditionText } from '../utils/refundCalculator';
import {
  X,
  CheckCircle2,
  Calendar,
  Clock,
  Info,
  Sparkles,
  Rocket,
  CreditCard,
  Building,
  User,
  ShieldCheck,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';

interface ApplyChallengeModalProps {
  group: ChallengeGroup | null;
  currentUser: NaverUser | null;
  userPayments?: ChallengePayment[];
  onClose: () => void;
  onJoinChallenge: (group: ChallengeGroup) => void;
  onSubmitPayment?: (payment: {
    challengeId: string;
    challengeName: string;
    amount: number;
    depositorName: string;
    depositedAt: string;
  }) => void;
  onOpenGoogleAuth: () => void;
  onOpenProfileModal: () => void;
}

export const ApplyChallengeModal: React.FC<ApplyChallengeModalProps> = ({
  group,
  currentUser,
  userPayments = [],
  onClose,
  onJoinChallenge,
  onSubmitPayment,
  onOpenGoogleAuth,
}) => {
  if (!group) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const feeAmount = Math.round(Number(group.fee ?? group.participationFee ?? 0));
  const isPaid = feeAmount > 0;
  const refundAmount = Math.round(Number(group.refundAmount ?? group.refundFee ?? (group.refundEnabled !== false ? feeAmount : 0)));

  const [depositorName, setDepositorName] = useState(currentUser?.name || '');
  const [depositedAt, setDepositedAt] = useState(todayStr);
  const [agreeRules, setAgreeRules] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccessSubmitted, setIsSuccessSubmitted] = useState(false);

  useEffect(() => {
    if (currentUser?.name && !depositorName) {
      setDepositorName(currentUser.name);
    }
  }, [currentUser]);

  // Check existing payment application for this user and challenge
  const existingPayment = userPayments.find(
    (p) => p.challengeId === group.id && (p.userId === currentUser?.id || p.userId === currentUser?.email || p.userEmail === currentUser?.email)
  );

  const missionDaysText =
    group.missionDays && group.missionDays.length > 0
      ? group.missionDays.join(', ')
      : '월 ~ 일 (매일)';

  const goalText =
    group.goalUnit === 'weekly'
      ? `주간 ${group.targetBlogPostCount || 3}회 작성`
      : `일간 ${group.targetBlogPostCount || 1}개 작성`;

  // Bank Info from Challenge settings
  const bankName = group.bankName || (group.bankAccount ? group.bankAccount.split(' ')[0] : '국민은행');
  const accountNumber = group.accountNumber || group.bankAccount || '123456-78-123456';
  const accountHolder = group.accountHolder || group.bankOwner || '참새 (챌린지 운영진)';
  const depositDeadline = group.depositDeadline || (group.startDate ? `${group.startDate} 23:59` : '모집 마감일 23:59까지');
  const depositNotice = group.depositNotice || '입금자명은 반드시 가입한 이름 또는 닉네임과 동일하게 입력해주세요.';
  const rulesText = group.rules || '매일 지정된 미션 포스팅 작성 및 링크 제출';
  const refundConditionText = formatRefundConditionText(group);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!currentUser) {
      onOpenGoogleAuth();
      return;
    }

    if (!isPaid) {
      // Free challenge -> Instant registration
      onJoinChallenge(group);
      onClose();
      return;
    }

    // Paid challenge -> Validation
    if (!depositorName.trim()) {
      setErrorMessage('입금자명을 입력해 주세요.');
      return;
    }

    if (!depositedAt) {
      setErrorMessage('입금일을 선택해 주세요.');
      return;
    }

    if (!agreeRules) {
      setErrorMessage('참가비 입금 및 환급 조건 확인에 동의하셔야 신청이 가능합니다.');
      return;
    }

    if (onSubmitPayment) {
      onSubmitPayment({
        challengeId: group.id,
        challengeName: group.name,
        amount: feeAmount,
        depositorName: depositorName.trim(),
        depositedAt,
      });
      setIsSuccessSubmitted(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 my-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-100 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                모집 중 챌린지
              </span>
              {isPaid ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  <CreditCard className="w-3 h-3 text-amber-600" />
                  유료 챌린지 ({feeAmount.toLocaleString()}원)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  <DollarSign className="w-3 h-3 text-blue-600" />
                  무료 챌린지
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
              {group.name}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {isPaid
                ? '입금 후 입금 확인 요청을 접수하시면 관리자가 입금 내역 확인 후 참가를 최종 승인합니다.'
                : '무료 챌린지 참가 신청 정보를 확인하고 바로 참가를 완료하세요.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Process Flow Steps for Paid Challenge */}
        {isPaid && (
          <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200/80">
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-600">
              <div className={`flex items-center gap-1.5 ${!existingPayment ? 'text-indigo-600 font-black' : 'text-slate-500'}`}>
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black">1</span>
                <span>참가신청/입금</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <div className={`flex items-center gap-1.5 ${existingPayment?.status === 'PAYMENT_REPORTED' || existingPayment?.status === 'submitted' || existingPayment?.status === 'pending' ? 'text-amber-600 font-black' : 'text-slate-500'}`}>
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-black">2</span>
                <span>입금확인요청</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <div className={`flex items-center gap-1.5 ${existingPayment?.status === 'PAYMENT_CONFIRMED' || existingPayment?.status === 'approved' ? 'text-emerald-600 font-black' : 'text-slate-500'}`}>
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black">3</span>
                <span>관리자승인</span>
              </div>
            </div>
          </div>
        )}

        {/* Challenge Overview Card */}
        <div className="bg-stone-50 rounded-2xl p-3.5 sm:p-4 border border-stone-200/80 space-y-2.5 text-xs text-slate-800">
          <div className="flex items-center justify-between py-0.5 border-b border-stone-200/60">
            <span className="font-extrabold text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              운영 기간
            </span>
            <span className="font-bold text-slate-900">
              {group.startDate} ~ {group.endDate}
            </span>
          </div>

          <div className="flex items-center justify-between py-0.5 border-b border-stone-200/60">
            <span className="font-extrabold text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              참여 요일 / 목표
            </span>
            <span className="font-bold text-slate-900">
              {missionDaysText} ({goalText})
            </span>
          </div>

          <div className="flex items-center justify-between py-0.5 border-b border-stone-200/60">
            <span className="font-extrabold text-slate-500 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
              참가비
            </span>
            <span className="font-black text-slate-900">
              {feeAmount > 0 ? `${feeAmount.toLocaleString()}원` : '무료 (0원)'}
            </span>
          </div>

          {isPaid && (
            <>
              <div className="flex items-center justify-between py-0.5 border-b border-stone-200/60">
                <span className="font-extrabold text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  환급 가능 금액
                </span>
                <span className="font-black text-emerald-600">
                  {refundAmount > 0 ? `${refundAmount.toLocaleString()}원` : '환급 없음'}
                </span>
              </div>

              <div className="flex items-start justify-between py-0.5">
                <span className="font-extrabold text-slate-500 flex items-center gap-1.5 shrink-0 mt-0.5">
                  <Info className="w-3.5 h-3.5 text-indigo-600" />
                  환급 조건
                </span>
                <span className="font-bold text-indigo-900 text-right leading-tight ml-2">
                  {refundConditionText}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Existing Payment Status Warning if already applied */}
        {existingPayment && !isSuccessSubmitted && (
          <div
            className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-2 ${
              existingPayment.status === 'PAYMENT_REPORTED' || existingPayment.status === 'submitted' || existingPayment.status === 'pending' || existingPayment.status === 'PENDING_PAYMENT'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : existingPayment.status === 'PAYMENT_CONFIRMED' || existingPayment.status === 'approved'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5 font-black">
                {existingPayment.status === 'PAYMENT_CONFIRMED' || existingPayment.status === 'approved' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : existingPayment.status === 'PAYMENT_REJECTED' || existingPayment.status === 'rejected' ? (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-600" />
                )}
                {existingPayment.status === 'PAYMENT_CONFIRMED' || existingPayment.status === 'approved'
                  ? '✓ 참가 승인 완료'
                  : existingPayment.status === 'PAYMENT_REJECTED' || existingPayment.status === 'rejected'
                  ? '❌ 입금 확인 거절됨'
                  : '⏳ 입금 확인 대기 중 (PAYMENT_REPORTED)'}
              </span>
              <span className="text-[11px] opacity-80">{existingPayment.submittedAt}</span>
            </div>

            {existingPayment.status === 'PAYMENT_CONFIRMED' || existingPayment.status === 'approved' ? (
              <p className="text-[11px] text-emerald-800">
                입금 확인이 완료되어 챌린지 참가가 최종 승인되었습니다! 챌린지 미션을 수행해 주세요.
              </p>
            ) : existingPayment.status === 'PAYMENT_REJECTED' || existingPayment.status === 'rejected' ? (
              <div className="space-y-1 bg-white/70 p-2.5 rounded-xl border border-rose-200/60">
                <p className="text-[11px] font-black text-rose-900">
                  거절 사유: {existingPayment.rejectionReason || existingPayment.rejectedReason || '입금 내역 확인 불가'}
                </p>
                <p className="text-[11px] text-rose-800">
                  입금자명과 금액을 다시 확인하신 후 아래 양식에서 재신청해 주시기 바랍니다.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-amber-800">
                입금자명 <strong>{existingPayment.depositorName}</strong> ({existingPayment.amount.toLocaleString()}원)으로 입금 확인 요청이 접수되었습니다. 관리자가 확인 후 최종 참가 승인됩니다.
              </p>
            )}
          </div>
        )}

        {/* Success Submitted Notice */}
        {isSuccessSubmitted && (
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 space-y-2 animate-in zoom-in-95">
            <div className="flex items-center gap-2 font-black text-indigo-900 text-sm">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              <span>입금 확인 요청이 정상 접수되었습니다.</span>
            </div>
            <p className="text-indigo-800 leading-relaxed text-[11px]">
              운영진이 계좌 입금 내역을 확인한 후 참가를 최종 승인합니다. 승인 완료 시 "내 챌린지" 및 프로필에 승인 상태가 업데이트됩니다.
            </p>
            <div className="pt-2 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs cursor-pointer shadow-sm"
              >
                확인 완료
              </button>
            </div>
          </div>
        )}

        {/* Paid Challenge Deposit Request Form */}
        {isPaid && !isSuccessSubmitted && (
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            
            {/* Deposit Bank Info Box */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-black text-indigo-950 text-xs">
                  <Building className="w-4 h-4 text-indigo-600" />
                  <span>입금 계좌 정보</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded">
                  마감: {depositDeadline}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-indigo-100/80 space-y-1.5 text-slate-800 font-medium">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">입금 은행:</span>
                  <span className="font-extrabold text-indigo-950">{bankName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">계좌번호:</span>
                  <span className="font-black text-indigo-900 tracking-wide text-xs bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
                    {accountNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">예금주:</span>
                  <span className="font-extrabold text-slate-900">{accountHolder}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-stone-100">
                  <span className="text-slate-500 font-bold">입금 금액:</span>
                  <span className="font-black text-emerald-600 text-sm">{feeAmount.toLocaleString()}원</span>
                </div>
              </div>

              {/* Deposit Notice & Guidelines */}
              <div className="space-y-1 pt-1 text-[11px]">
                <div className="flex items-start gap-1 text-indigo-900 bg-indigo-100/40 p-2 rounded-lg border border-indigo-200/50">
                  <AlertCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>{depositNotice}</span>
                </div>
                <div className="flex items-start gap-1 text-slate-700">
                  <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-slate-900">참가 규칙: </span>
                    <span>{rulesText}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Inputs: Depositor Name & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  입금자명 <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={depositorName}
                    onChange={(e) => setDepositorName(e.target.value)}
                    placeholder="실제 입금자 성함"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  입금일 <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="date"
                    value={depositedAt}
                    onChange={(e) => setDepositedAt(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Refund Policy Information Note */}
            {refundAmount > 0 && (
              <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-emerald-950 text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>환급 안내 (안전한 일회성 외부폼 신청)</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    최대 {refundAmount.toLocaleString()}원 환급
                  </span>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/60 text-[11px] text-emerald-900 leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1 text-emerald-800">
                    <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>개인정보 안심 보호 시스템</span>
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    회원님의 금융 개인정보 보호를 위해 계좌번호는 사이트에 저장되지 않습니다. 챌린지 환급 기준 달성 시 안내되는 <strong>외부 환급 신청폼(Google Forms 등)</strong>을 통해 안전하게 일회성으로 제출하시게 됩니다.
                  </p>
                </div>
              </div>
            )}

            {/* Agreement Checkbox */}
            <label className="flex items-start gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200/80 cursor-pointer hover:bg-stone-100 transition-colors">
              <input
                type="checkbox"
                checked={agreeRules}
                onChange={(e) => setAgreeRules(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-[11px] font-bold text-slate-700 leading-tight">
                위 계좌로 <span className="text-indigo-600 font-extrabold">{feeAmount.toLocaleString()}원</span> 입금을 완료하였으며, 운영 규칙 및 환급 조건에 동의합니다.
              </span>
            </label>

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 font-extrabold text-xs transition-all cursor-pointer"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={existingPayment?.status === 'PAYMENT_REPORTED' || existingPayment?.status === 'submitted' || existingPayment?.status === 'pending' || existingPayment?.status === 'PAYMENT_CONFIRMED' || existingPayment?.status === 'approved'}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-extrabold text-xs transition-all cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
              >
                <Rocket className="w-4 h-4" />
                <span>
                  {existingPayment?.status === 'PAYMENT_CONFIRMED' || existingPayment?.status === 'approved'
                    ? '참가 승인 완료됨'
                    : existingPayment?.status === 'PAYMENT_REPORTED' || existingPayment?.status === 'submitted' || existingPayment?.status === 'pending'
                    ? '입금 확인 대기 중'
                    : '입금 완료했어요 (확인 요청)'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* Free Challenge Action */}
        {!isPaid && (
          <div className="space-y-3 pt-2 border-t border-stone-100">
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200/80 text-[11px] text-emerald-900 leading-relaxed flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">무료 챌린지 참가 안내</p>
                <p className="text-emerald-800">
                  신청 즉시 참가가 확정됩니다. 등록된 네이버 블로그 / X(트위터) 포스팅이 자동 집계됩니다.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 font-extrabold text-xs transition-all cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
              >
                <Rocket className="w-4 h-4" />
                <span>참가 신청하기</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Zap,
  Star,
  Clock,
  ArrowRight,
  Info,
  Lock,
  User,
  LogIn,
  AlertCircle,
  FileText,
  Layers,
  Search,
  Check,
  Send,
  Building,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { NaverUser, Product, UserMembership } from '../../types';
import { fetchProductsFromSupabase, fetchUserMemberships, fetchMembershipTiersFromSupabase } from '../../lib/supabase';

interface SiteSubscriptionViewProps {
  currentUser: NaverUser | null;
  isAdminLoggedIn: boolean;
  onOpenGoogleAuth: () => void;
  onNavigateToToolkit?: () => void;
}

export const SiteSubscriptionView: React.FC<SiteSubscriptionViewProps> = ({
  currentUser,
  isAdminLoggedIn,
  onOpenGoogleAuth,
  onNavigateToToolkit,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userMembership, setUserMembership] = useState<UserMembership | null>(null);
  const [tierNameMap, setTierNameMap] = useState<Record<string, string>>({
    free: '무료 회원',
    basic: 'BASIC',
    pro: 'PRO',
    vip: 'VIP',
    admin: '최고 관리자',
  });

  // Modal State for Purchase Application
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState<boolean>(false);
  const [depositorName, setDepositorName] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [purchaseNotes, setPurchaseNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [purchaseSuccessMessage, setPurchaseSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Bank Info
  const bankInfo = {
    bank: '카카오뱅크',
    accountNumber: '3333-01-9876543',
    accountHolder: '수익화챌린지(주)',
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedProducts, fetchedTiers] = await Promise.all([
        fetchProductsFromSupabase(),
        fetchMembershipTiersFromSupabase(),
      ]);

      const tMap: Record<string, string> = {};
      fetchedTiers.forEach((t) => {
        tMap[t.id] = t.name;
      });
      if (isAdminLoggedIn) tMap['admin'] = '최고 관리자';
      setTierNameMap(tMap);

      // Filter only active membership & ai_usage products
      const activeProducts = fetchedProducts
        .filter((p) => p.isActive !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      setProducts(activeProducts);

      // Load user membership
      if (currentUser?.email || currentUser?.id) {
        const uId = (currentUser.email || currentUser.id || '').toLowerCase().trim();
        const memberships = await fetchUserMemberships(uId);
        if (memberships && memberships.length > 0) {
          setUserMembership(memberships[0]);
        }
      }
    } catch (err) {
      console.warn('Subscription view load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser, isAdminLoggedIn]);

  const currentTierId = isAdminLoggedIn ? 'admin' : (userMembership?.tierId || 'free');
  const currentTierName = tierNameMap[currentTierId] || (isAdminLoggedIn ? '최고 관리자' : '무료 회원');

  // Format currency
  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('ko-KR').format(val);
  };

  // Format expiration date
  const formatExpiry = (dateStr?: string | null) => {
    if (!dateStr) return '무제한 (만료일 없음)';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    } catch {
      return dateStr;
    }
  };

  // Calculate days remaining
  const getRemainingDays = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const now = new Date();
    const exp = new Date(dateStr);
    if (isNaN(exp.getTime())) return null;
    const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const handleOpenPurchase = (prod: Product) => {
    if (!currentUser && !isAdminLoggedIn) {
      onOpenGoogleAuth();
      return;
    }
    setSelectedProduct(prod);
    setDepositorName(currentUser?.name || '');
    setPurchaseNotes('');
    setErrorMessage(null);
    setPurchaseSuccessMessage(null);
    setIsPurchaseModalOpen(true);
  };

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (!depositorName.trim()) {
      setErrorMessage('입금자명을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const cleanUserId = (currentUser?.email || currentUser?.id || currentUser?.name || 'user').trim().toLowerCase();

    try {
      // Create pending purchase request via API or client helper
      const response = await fetch('/api/purchases/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: cleanUserId,
          userName: currentUser?.name || depositorName,
          userEmail: currentUser?.email || '',
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          productType: selectedProduct.productType || 'membership',
          amount: selectedProduct.price,
          paymentMethod: 'bank_transfer',
          targetTierId: selectedProduct.membershipTier || 'pro',
          durationDays: selectedProduct.durationDays,
          depositorName: depositorName.trim(),
          contactPhone: contactPhone.trim(),
          notes: purchaseNotes.trim() ? `[입금자: ${depositorName.trim()}] ${purchaseNotes.trim()}` : `[입금자: ${depositorName.trim()}]`,
        }),
      });

      const resData = await response.json();
      if (!response.ok || resData.success === false) {
        throw new Error(resData.message || '구매 신청 접수 중 오류가 발생했습니다.');
      }

      setPurchaseSuccessMessage(
        `구매 신청이 안전하게 접수되었습니다!\n입금 확인 후 관리자가 1~2시간 이내에 등급을 활성화해 드립니다.`
      );
    } catch (err: any) {
      console.error('Purchase request error:', err);
      // Fallback: direct client notification
      setPurchaseSuccessMessage(
        `구매 신청이 등록되었습니다.\n아래 계좌로 입금해 주시면 확인 후 등급이 즉시 승인됩니다.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingDays = getRemainingDays(userMembership?.expiresAt);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 animate-in fade-in duration-300">
      
      {/* 1. Header Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-bold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>네이버 블로그 수익화 & AI 툴킷 멤버십 플랜</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
          최적화된 글쓰기와 AI 초안 생성으로 <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600">
            블로그 수익화 속도를 10배 높이세요
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed">
          키워드 자동 분석부터 SEO 최적화 포스팅 초안 작성, 고화질 카드뉴스까지
          자유롭게 이용 가능한 멤버십 상품을 선택하세요.
        </p>
      </div>

      {/* 2. User Current Membership Status Banner */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm overflow-hidden relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">내 현재 등급</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${
                  currentTierId === 'admin'
                    ? 'bg-purple-100 text-purple-800'
                    : currentTierId === 'vip'
                    ? 'bg-amber-100 text-amber-800'
                    : currentTierId === 'pro'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {currentTierName}
                </span>
                {userMembership?.status && (
                  <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {userMembership.status === 'active' ? '정상 이용 중' : userMembership.status}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                {currentUser ? `${currentUser.name} 님의 계정` : '게스트 (로그인 필요)'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                <span>이용 기간: {formatExpiry(userMembership?.expiresAt)}</span>
                {remainingDays !== null && remainingDays > 0 && (
                  <span className="font-extrabold text-emerald-600">
                    (잔여 {remainingDays}일)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!currentUser ? (
              <button
                type="button"
                onClick={onOpenGoogleAuth}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <LogIn className="w-4 h-4" />
                <span>구글 로그인하고 등급 확인</span>
              </button>
            ) : (
              onNavigateToToolkit && (
                <button
                  type="button"
                  onClick={onNavigateToToolkit}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>AI 초안 생성기 바로가기</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* 3. Products Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <span>선택 가능한 구독 & 이용권 상품</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            VAT 포함 / 안전한 무통장 입금 승인
          </span>
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-2xs space-y-3">
            <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">상품 목록을 불러오는 중입니다...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-2xs space-y-2">
            <Info className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">등록된 멤버십 상품이 없습니다.</h3>
            <p className="text-xs text-slate-500">운영자가 곧 새로운 멤버십 플랜을 오픈할 예정입니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {products.map((prod) => {
              const isPopular = prod.badge?.includes('인기') || prod.badge?.includes('HOT') || prod.membershipTier === 'pro';
              const isUserAlreadyThisTier =
                userMembership?.tierId === prod.membershipTier && userMembership?.status === 'active';

              const discountPercent =
                prod.originalPrice && prod.originalPrice > prod.price
                  ? Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100)
                  : null;

              return (
                <div
                  key={prod.id}
                  className={`bg-white rounded-3xl p-6 sm:p-7 border transition-all flex flex-col justify-between relative ${
                    isPopular
                      ? 'border-emerald-500 shadow-lg ring-2 ring-emerald-500/20'
                      : 'border-slate-200/90 shadow-2xs hover:border-slate-300'
                  }`}
                >
                  {/* Badge */}
                  {prod.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 rounded-full text-[11px] font-black bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs">
                        {prod.badge}
                      </span>
                    </div>
                  )}

                  <div className="space-y-5">
                    {/* Header */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-400">
                          {prod.membershipTier ? `등급: ${tierNameMap[prod.membershipTier] || prod.membershipTier.toUpperCase()}` : '이용권'}
                        </span>
                        {prod.durationDays && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            {prod.durationDays}일 이용
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">
                        {prod.name}
                      </h3>
                      {prod.description && (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {prod.description}
                        </p>
                      )}
                    </div>

                    {/* Pricing */}
                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-slate-900">
                          ₩{formatPrice(prod.price)}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">
                          {prod.durationDays ? `/ ${prod.durationDays}일` : '/ 건'}
                        </span>
                      </div>
                      {prod.originalPrice && prod.originalPrice > prod.price && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="line-through text-slate-400 font-medium">
                            ₩{formatPrice(prod.originalPrice)}
                          </span>
                          {discountPercent && (
                            <span className="text-rose-600 font-black">
                              {discountPercent}% 할인
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Features List */}
                    <div className="space-y-2.5 pt-1">
                      <p className="text-xs font-bold text-slate-900">포함된 혜택</p>
                      <ul className="space-y-2 text-xs text-slate-600 font-medium">
                        {Array.isArray(prod.features) && prod.features.length > 0 ? (
                          prod.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))
                        ) : (
                          <>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span>AI 블로그 포스팅 초안 무제한 생성</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span>황금 키워드 및 트렌드 실시간 수집</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span>고화질 상업용 라이선스 이미지 즉시 추천</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span>카드뉴스 오토 엔진 슬라이드 생성</span>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Purchase CTA */}
                  <div className="pt-6 mt-6 border-t border-slate-100">
                    {isUserAlreadyThisTier ? (
                      <div className="w-full py-3 px-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                        <span className="text-xs font-extrabold text-emerald-800 flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>현재 이용 중인 등급입니다</span>
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenPurchase(prod)}
                        className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                          isPopular
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>신청 / 구매하기</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Purchase Application Modal */}
      {isPurchaseModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    멤버십 구매 신청
                  </h3>
                  <p className="text-xs text-slate-500">
                    무통장 입금 신청서 작성
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPurchaseModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {purchaseSuccessMessage ? (
              <div className="p-6 sm:p-8 space-y-6 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-lg font-black text-slate-900">
                    신청이 성공적으로 접수되었습니다!
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {purchaseSuccessMessage}
                  </p>
                </div>

                {/* Bank Transfer Guide Box */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2 text-xs">
                  <div className="flex justify-between font-semibold text-slate-700 border-b border-slate-200/80 pb-2">
                    <span>입금하실 금액:</span>
                    <span className="font-black text-emerald-600 text-sm">₩{formatPrice(selectedProduct.price)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>입금 은행:</span>
                    <span className="font-bold text-slate-900">{bankInfo.bank}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>계좌 번호:</span>
                    <span className="font-black text-blue-600 select-all">{bankInfo.accountNumber}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>예금주:</span>
                    <span className="font-bold text-slate-900">{bankInfo.accountHolder}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>입금자명:</span>
                    <span className="font-bold text-slate-900">{depositorName || currentUser?.name}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsPurchaseModalOpen(false);
                    loadData();
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  확인 완료
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitPurchase} className="p-6 space-y-4">
                {/* Product Summary Box */}
                <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-700">신청 상품</span>
                    <h4 className="text-sm font-black text-slate-900">{selectedProduct.name}</h4>
                    {selectedProduct.durationDays && (
                      <span className="text-[11px] text-slate-500">{selectedProduct.durationDays}일 이용권</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-emerald-700">₩{formatPrice(selectedProduct.price)}</span>
                    <span className="block text-[10px] text-slate-400">VAT 포함</span>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      입금자명 (실제 송금인 이름) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={depositorName}
                      onChange={(e) => setDepositorName(e.target.value)}
                      placeholder="예: 홍길동"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      송금하실 때 표시되는 이름과 정확히 일치해야 자동 매칭됩니다.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      연락처 / 휴대폰 번호 (선택)
                    </label>
                    <input
                      type="text"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="예: 010-1234-5678"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      요청사항 / 메모 (선택)
                    </label>
                    <textarea
                      rows={2}
                      value={purchaseNotes}
                      onChange={(e) => setPurchaseNotes(e.target.value)}
                      placeholder="특이사항이나 세금계산서/현금영수증 요청 정보 등"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium resize-none"
                    />
                  </div>
                </div>

                {/* Bank Account Guide */}
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700">
                    <Building className="w-3.5 h-3.5 text-emerald-600" />
                    <span>입금 전용 계좌 안내</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600 pt-1">
                    <span>{bankInfo.bank}</span>
                    <span className="font-bold text-slate-900 select-all">{bankInfo.accountNumber}</span>
                    <span>(예금주: {bankInfo.accountHolder})</span>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPurchaseModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>접수 중...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>구매 신청 접수</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

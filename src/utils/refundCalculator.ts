import { Participant, ChallengeGroup, ChallengeRefund, ChallengePayment, PostReviewItem, ContentReviewStatus, RefundEligibilityStatus } from '../types';
import { calculateParticipantGoal } from './goalCalculator';

/**
 * Generates formatted human-readable refund condition text from ChallengeGroup configuration
 */
export function formatRefundConditionText(group: ChallengeGroup): string {
  if (group.refundEnabled === false || (group.fee ?? group.participationFee ?? 0) === 0) {
    return '환급 없음 (무료 챌린지 또는 환급 미적용)';
  }

  const conditionType = group.refundConditionType || 'ATTENDANCE_RATE';
  const conditionValue = group.refundConditionValue ?? group.refundThreshold ?? 100;
  const refundAmount = group.refundAmount ?? group.refundFee ?? group.fee ?? group.participationFee ?? 0;

  switch (conditionType) {
    case 'ATTENDANCE_RATE':
      return `출석/활동 달성률 ${conditionValue}% 이상 달성 시 ${refundAmount.toLocaleString()}원 환급`;
    case 'POST_COUNT':
      return `총 인증/게시글 ${conditionValue}개 이상 작성 시 ${refundAmount.toLocaleString()}원 환급`;
    case 'MISSION_COMPLETE':
      return `미션 일정 100% 완료 시 ${refundAmount.toLocaleString()}원 환급`;
    case 'CUSTOM':
      return group.refundCondition || `지정 조건 충족 시 ${refundAmount.toLocaleString()}원 환급`;
    case 'NONE':
    default:
      return group.refundCondition || `목표 달성률 ${conditionValue}% 이상 달성 시 전액 환급`;
  }
}

/**
 * Generates automated Challenge Fee & Deposit Notice markdown/text template
 */
export function generateChallengeFeeNoticeText(group: ChallengeGroup): string {
  const fee = group.fee ?? group.participationFee ?? 0;
  const bankName = group.bankName || (group.bankAccount ? group.bankAccount.split(' ')[0] : '국민은행');
  const accountNumber = group.accountNumber || group.bankAccount || '123456-78-123456';
  const accountHolder = group.accountHolder || group.bankOwner || '참새 (운영진)';
  const deadline = group.depositDeadline || (group.startDate ? `${group.startDate} 23:59` : '모집 마감일 23:59까지');
  const conditionText = formatRefundConditionText(group);
  const notice = group.depositNotice || '입금자명은 반드시 가입한 이름 또는 닉네임과 동일하게 입력해주세요.';

  return `[참가비 및 입금 안내]
• 챌린지명: ${group.name}
• 참가비: ${fee > 0 ? `${fee.toLocaleString()}원` : '무료 (0원)'}
• 입금은행: ${bankName}
• 계좌번호: ${accountNumber}
• 예금주: ${accountHolder}
• 입금마감: ${deadline}
• 환급조건: ${conditionText}
• 유의사항: ${notice}

※ 입금 후 챌린지 화면에서 [입금 완료했어요] 버튼을 눌러주시면 관리자가 입금 확인 후 최종 참가 승인됩니다.`;
}

/**
 * Calculates a refund snapshot for a single participant in a challenge group.
 */
export function calculateParticipantRefundSnapshot(
  participant: Participant,
  group: ChallengeGroup,
  allGroups?: ChallengeGroup[],
  payment?: ChallengePayment,
  existingRefund?: ChallengeRefund
): ChallengeRefund {
  const goalResult = calculateParticipantGoal(participant, group, allGroups);
  const achievementRate = Math.round(goalResult.overallRate);
  
  const refundThreshold = group.refundConditionValue ?? group.refundThreshold ?? 100;
  const isRefundEnabled = group.refundEnabled !== false && (group.fee ?? group.participationFee ?? 0) > 0;

  // Deposit/Fee amounts (Integer KRW)
  const targetAmount = Math.round(payment?.amount ?? group.fee ?? group.participationFee ?? group.refundFee ?? 0);
  
  let eligibleAmount = 0;
  if (isRefundEnabled) {
    if (group.refundType === 'fixed') {
      eligibleAmount = Math.round(group.refundAmount ?? group.refundFee ?? targetAmount);
    } else {
      eligibleAmount = Math.round(group.refundAmount || targetAmount);
    }
  }

  // Content Quality Review (Heuristic inspection)
  const simulatedPostItems: PostReviewItem[] = [];
  let reviewedPostsCount = 0;
  let validPostsCount = 0;
  let invalidPostsCount = 0;
  let contentReviewStatus: ContentReviewStatus = 'valid';

  if (participant.history && participant.history.length > 0) {
    participant.history.forEach((h, idx) => {
      const totalDayPosts = (h.blogPosts || 0) + (h.tweets || 0);
      if (totalDayPosts > 0) {
        reviewedPostsCount += totalDayPosts;
        const isSuspicious = totalDayPosts > 10; 
        if (isSuspicious) {
          invalidPostsCount++;
          simulatedPostItems.push({
            id: `post_${participant.id}_${idx}`,
            title: `${h.date} 활동 포스팅 (${totalDayPosts}건)`,
            date: h.date,
            platform: h.blogPosts > 0 ? 'blog' : 'twitter_post',
            status: 'review_required',
            reviewReason: '단일 날짜 이상 과다 포스팅 감지 (검토 필요)',
          });
        } else {
          validPostsCount += totalDayPosts;
          simulatedPostItems.push({
            id: `post_${participant.id}_${idx}`,
            title: `${h.date} 정상 수행 포스팅 (${totalDayPosts}건)`,
            date: h.date,
            platform: h.blogPosts > 0 ? 'blog' : 'twitter_post',
            status: 'valid',
          });
        }
      }
    });
  }

  if (invalidPostsCount > 0) {
    contentReviewStatus = 'suspicious';
  } else if (reviewedPostsCount === 0 && goalResult.actualTotalAll > 0) {
    contentReviewStatus = 'insufficient_data';
  } else {
    contentReviewStatus = 'valid';
  }

  // Automatic eligibility determination based on condition type
  let isConditionSatisfied = false;
  const conditionType = group.refundConditionType || 'ATTENDANCE_RATE';

  if (conditionType === 'POST_COUNT') {
    const requiredPosts = group.refundConditionValue || group.targetBlogPostCount || 10;
    isConditionSatisfied = goalResult.actualTotalAll >= requiredPosts;
  } else if (conditionType === 'MISSION_COMPLETE') {
    isConditionSatisfied = achievementRate >= 100;
  } else {
    // ATTENDANCE_RATE or default
    isConditionSatisfied = achievementRate >= refundThreshold;
  }

  let eligibilityStatus: RefundEligibilityStatus = 'ineligible';
  if (!isRefundEnabled || targetAmount === 0) {
    eligibilityStatus = 'ineligible';
  } else if (contentReviewStatus === 'suspicious') {
    eligibilityStatus = 'review_required';
  } else if (isConditionSatisfied) {
    eligibilityStatus = 'eligible';
  } else {
    eligibilityStatus = 'ineligible';
  }

  // Initial refund status assignment
  let initialRefundStatus = existingRefund?.refundStatus || 'pending_review';
  if (!existingRefund) {
    if (eligibilityStatus === 'review_required') {
      initialRefundStatus = 'pending_review';
    } else if (eligibilityStatus === 'eligible') {
      initialRefundStatus = 'eligible';
    } else {
      initialRefundStatus = 'ineligible';
    }
  }

  const refundId = existingRefund?.id || `ref_${group.id}_${participant.id}`;

  return {
    id: refundId,
    challengeId: group.id,
    challengeName: group.name,
    participantId: participant.id,
    participantName: participant.participantName,
    userId: payment?.userId,
    userEmail: payment?.userEmail,
    paymentId: payment?.id,

    targetAmount,
    eligibleAmount: isConditionSatisfied ? eligibleAmount : 0,
    achievementRate,
    refundThreshold,
    targetGoalCount: goalResult.totalTargetAll,
    actualGoalCount: goalResult.actualTotalAll,

    bankName: existingRefund?.bankName || (group.bankName ? group.bankName : payment?.depositorName ? '입금 시 등록계좌' : '미등록'),
    bankAccount: existingRefund?.bankAccount || group.accountNumber || group.bankAccount || '운영진 문의',
    bankOwner: existingRefund?.bankOwner || group.accountHolder || group.bankOwner || payment?.depositorName || participant.participantName,

    eligibilityStatus,
    refundStatus: initialRefundStatus,
    contentReviewStatus,

    reviewedPostsCount,
    validPostsCount,
    invalidPostsCount,
    postItems: simulatedPostItems,

    adminDecision: existingRefund?.adminDecision || 'pending',
    adminDecisionReason: existingRefund?.adminDecisionReason || null,
    memo: existingRefund?.memo || null,

    approvedBy: existingRefund?.approvedBy || null,
    approvedAt: existingRefund?.approvedAt || null,
    completedBy: existingRefund?.completedBy || null,
    completedAt: existingRefund?.completedAt || null,

    createdAt: existingRefund?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Batch generates refund snapshot records for participants in a group.
 */
export function calculateBatchRefundSnapshots(
  participants: Participant[],
  group: ChallengeGroup,
  allGroups: ChallengeGroup[],
  payments: ChallengePayment[],
  existingRefunds: ChallengeRefund[]
): ChallengeRefund[] {
  // Filter participants belonging to this group
  const groupParticipants = participants.filter((p) => {
    const pGroups = p.groupNames && p.groupNames.length > 0
      ? p.groupNames
      : p.groupName ? p.groupName.split(',').map((s) => s.trim()) : [];
    return pGroups.includes(group.name);
  });

  return groupParticipants.map((participant) => {
    // Find matching payment if available
    const payment = payments.find(
      (pm) => pm.challengeId === group.id && (pm.participantId === participant.id || pm.depositorName === participant.participantName)
    );
    // Find existing refund record if available
    const existing = existingRefunds.find(
      (r) => r.challengeId === group.id && r.participantId === participant.id
    );

    return calculateParticipantRefundSnapshot(participant, group, allGroups, payment, existing);
  });
}

/**
 * Export refund list to UTF-8 CSV file for off-site bank transfer execution.
 */
export function exportRefundsToCsv(refunds: ChallengeRefund[], challengeName?: string) {
  const headers = [
    '챌린지 그룹명',
    '참가자 이름',
    '참가비(원)',
    '환급 대상액(원)',
    '목표 달성률(%)',
    '환급 기준(%)',
    '자동 판정 자격',
    '콘텐츠 검토 상태',
    '최종 환급 상태',
    '은행명',
    '계좌번호',
    '예금주',
    '승인일시',
    '환급완료일시',
    '메모 및 비고',
  ];

  const getEligibilityLabel = (status: string) => {
    if (status === 'eligible') return '환급 가능';
    if (status === 'review_required') return '검토 필요';
    return '기준 미달';
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'eligible': return '환급 대상';
      case 'approved': return '환급 승인 (송금 대기)';
      case 'completed': return '환급 완료';
      case 'rejected': return '환급 거절';
      case 'pending_review': return '검토 대기';
      default: return '미대상';
    }
  };

  const rows = refunds.map((r) => [
    `"${(r.challengeName || '').replace(/"/g, '""')}"`,
    `"${(r.participantName || '').replace(/"/g, '""')}"`,
    r.targetAmount || 0,
    r.eligibleAmount || 0,
    `${r.achievementRate}%`,
    `${r.refundThreshold}%`,
    getEligibilityLabel(r.eligibilityStatus),
    r.contentReviewStatus === 'suspicious' ? '이상 패턴 감지' : '정상',
    getStatusLabel(r.refundStatus),
    `"${(r.bankName || '미지정').replace(/"/g, '""')}"`,
    `"${(r.bankAccount || '미지정').replace(/"/g, '""')}"`,
    `"${(r.bankOwner || r.participantName || '').replace(/"/g, '""')}"`,
    r.approvedAt ? new Date(r.approvedAt).toLocaleString('ko-KR') : '-',
    r.completedAt ? new Date(r.completedAt).toLocaleString('ko-KR') : '-',
    `"${(r.memo || r.adminDecisionReason || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `챌린지_환급대상_목록_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

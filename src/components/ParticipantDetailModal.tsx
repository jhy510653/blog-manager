import React, { useState } from 'react';
import { Participant, ChallengeGroup } from '../types';
import { calculateParticipantGoal, ALL_MISSION_DAYS } from '../utils/goalCalculator';
import {
  X,
  BookOpen,
  Twitter,
  ExternalLink,
  Calendar,
  FileText,
  TrendingUp,
  MessageSquare,
  StickyNote,
  Activity,
  Edit3,
  Trash2,
  Save,
  Target,
  CheckCircle2,
} from 'lucide-react';

interface ParticipantDetailModalProps {
  participant: Participant | null;
  onClose: () => void;
  isAdminLoggedIn?: boolean;
  onDeleteParticipant?: (participantId: string) => void;
  onUpdateParticipant?: (updatedParticipant: Participant) => void;
  groups?: ChallengeGroup[];
}

export const ParticipantDetailModal: React.FC<ParticipantDetailModalProps> = ({
  participant,
  onClose,
  isAdminLoggedIn = false,
  onDeleteParticipant,
  onUpdateParticipant,
  groups = [],
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Participant | null>(null);
  const [selectedGroupNames, setSelectedGroupNames] = useState<string[]>([]);

  if (!participant) return null;

  const currentData = editForm || participant;
  const hasBlog = currentData.platformType === 'blog' || currentData.platformType === 'both';
  const hasTwitter = currentData.platformType === 'twitter' || currentData.platformType === 'both';

  const participantGroups = participant.groupNames && participant.groupNames.length > 0
    ? participant.groupNames
    : participant.groupName
    ? participant.groupName.split(',').map((s) => s.trim())
    : [];

  const handleStartEditing = () => {
    setEditForm({ ...participant });
    setSelectedGroupNames(participantGroups.length > 0 ? participantGroups : [groups[0]?.name || participant.groupName]);
    setIsEditing(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;

    if (!editForm.participantName.trim()) {
      alert('참가자 이름을 입력해주세요.');
      return;
    }

    const formattedTwitter = editForm.twitterId?.trim()
      ? editForm.twitterId.trim().startsWith('@')
        ? editForm.twitterId.trim()
        : `@${editForm.twitterId.trim()}`
      : null;

    const finalGroups = selectedGroupNames.length > 0 ? selectedGroupNames : [editForm.groupName || groups[0]?.name || '참가 챌린지'];

    const updated: Participant = {
      ...editForm,
      participantName: editForm.participantName.trim(),
      groupName: finalGroups.join(', '),
      groupNames: finalGroups,
      blogId: editForm.platformType === 'twitter' ? null : editForm.blogId?.trim() || null,
      twitterId: editForm.platformType === 'blog' ? null : formattedTwitter,
    };

    if (onUpdateParticipant) {
      onUpdateParticipant(updated);
    }
    setIsEditing(false);
    setEditForm(null);
  };

  const handleDelete = () => {
    if (onDeleteParticipant) {
      onDeleteParticipant(participant.id);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#3D281D]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FFFDF9] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-[#EAE2D8] animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#4A3228] via-[#5A3E31] to-[#3D281D] p-5 sm:p-6 text-[#FFFDF9] relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold text-[#EAE0D3] mb-1.5">
            {participantGroups.map((gName, idx) => (
              <span key={idx} className="px-2.5 py-0.5 rounded-full bg-[#FAF6F0]/20 border border-[#D7C4B7]/30">
                🎯 {gName}
              </span>
            ))}
            <span className="text-white/40">•</span>
            <span className="text-[#D7C4B7]">참가일: {participant.startDate}</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>{participant.participantName}</span>
            {participant.platformType === 'both' ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                블로그 + 트위터 모두 등록
              </span>
            ) : participant.platformType === 'blog' ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                블로그만 등록
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300">
                트위터만 등록
              </span>
            )}
          </h2>
        </div>

        {/* Modal Body */}
        {isEditing && editForm ? (
          <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b pb-2">
              <Edit3 className="w-4 h-4 text-indigo-600" />
              <span>참가자 정보 수정</span>
            </h3>

            <div>
              <label className="font-bold text-slate-700 block mb-1">참가자 이름 *</label>
              <input
                type="text"
                value={editForm.participantName}
                onChange={(e) => setEditForm({ ...editForm, participantName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                참가 챌린지 그룹 (다중 참가 선택 가능) *
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto p-2.5 bg-slate-50 border border-slate-300 rounded-lg">
                {groups.length > 0 ? (
                  groups.map((g) => {
                    const isChecked = selectedGroupNames.includes(g.name);
                    return (
                      <label key={g.id} className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-slate-100 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGroupNames([...selectedGroupNames, g.name]);
                            } else {
                              if (selectedGroupNames.length > 1) {
                                setSelectedGroupNames(selectedGroupNames.filter((n) => n !== g.name));
                              } else {
                                alert('최소 1개 이상의 챌린지 그룹을 선택해야 합니다.');
                              }
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="font-bold text-slate-800">{g.name}</span>
                        <span className="text-[10px] text-slate-500">
                          ({g.category === 'blog' ? '블로그' : g.category === 'twitter' ? '트위터' : '통합'})
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <div className="text-slate-500 font-medium text-xs">{editForm.groupName}</div>
                )}
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">플랫폼 유형 *</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, platformType: 'both' })}
                  className={`py-1.5 px-2 rounded-lg font-bold border cursor-pointer ${
                    editForm.platformType === 'both'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  ✨ 둘 다
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, platformType: 'blog' })}
                  className={`py-1.5 px-2 rounded-lg font-bold border cursor-pointer ${
                    editForm.platformType === 'blog'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  🟢 블로그만
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, platformType: 'twitter' })}
                  className={`py-1.5 px-2 rounded-lg font-bold border cursor-pointer ${
                    editForm.platformType === 'twitter'
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  🐦 트위터만
                </button>
              </div>
            </div>

            {(editForm.platformType === 'blog' || editForm.platformType === 'both') && (
              <div>
                <label className="font-bold text-slate-700 block mb-1">네이버 블로그 ID</label>
                <input
                  type="text"
                  value={editForm.blogId || ''}
                  onChange={(e) => setEditForm({ ...editForm, blogId: e.target.value })}
                  placeholder="예: naver_id"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            )}

            {(editForm.platformType === 'twitter' || editForm.platformType === 'both') && (
              <div>
                <label className="font-bold text-slate-700 block mb-1">트위터 ID (@핸들)</label>
                <input
                  type="text"
                  value={editForm.twitterId || ''}
                  onChange={(e) => setEditForm({ ...editForm, twitterId: e.target.value })}
                  placeholder="예: @twitter_handle"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            )}

            {/* 수치 직접 입력/수정 섹션 */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
              <span className="font-bold text-amber-900 block">활동 수치 조정 (필요 시 수정)</span>
              <div className="grid grid-cols-2 gap-2">
                {(editForm.platformType === 'blog' || editForm.platformType === 'both') && (
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-0.5">블로그 포스팅 수</label>
                    <input
                      type="number"
                      value={editForm.dailyPostCount || 0}
                      onChange={(e) => setEditForm({ ...editForm, dailyPostCount: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                    />
                  </div>
                )}
                {(editForm.platformType === 'twitter' || editForm.platformType === 'both') && (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-600 font-bold block mb-0.5">트윗 작성 수</label>
                      <input
                        type="number"
                        value={editForm.tweetCount || 0}
                        onChange={(e) => setEditForm({ ...editForm, tweetCount: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 font-bold block mb-0.5">트윗 답글(Reply) 수</label>
                      <input
                        type="number"
                        value={editForm.replyCount || 0}
                        onChange={(e) => setEditForm({ ...editForm, replyCount: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">특이사항 / 메모</label>
              <input
                type="text"
                value={editForm.notes || ''}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="참가자 관련 메모..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditForm(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>수정 저장</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-6">

            {/* Goal Progress Section */}
            {(() => {
              const matchedGroup = groups.find((g) => g.name === participant.groupName);
              const goalInfo = calculateParticipantGoal(participant, matchedGroup, groups);
              return (
                <div className="bg-[#FFFDF9] border border-[#F3E9E0] p-4 rounded-2xl shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#6F4E37] uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-[#8B5E3C]" />
                      <span>목표 달성 세부 현황</span>
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <span className="px-2 py-0.5 rounded-full bg-[#F3E9E0] text-[#6F4E37] border border-[#E8DACD]">
                        {goalInfo.goalUnit === 'daily' ? '일 단위' : '주 단위'}
                      </span>
                      <span className="text-[#8B5E3C]">
                        미션 요일: {goalInfo.missionDays.map(d => ALL_MISSION_DAYS.find(m => m.code === d)?.label).join('/')}
                      </span>
                    </div>
                  </div>

                  {/* Overall Progress Bar */}
                  <div className="space-y-1.5 bg-[#FFFAF5] p-3 rounded-xl border border-[#F3E9E0]">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-[#3A2A1F]">통합 목표 달성률</span>
                      <span className="text-[#6F4E37] font-extrabold text-sm">
                        {goalInfo.overallRate}% ({goalInfo.actualTotalAll}/{goalInfo.totalTargetAll}개)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-[#F3E9E0] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#D97724] to-[#8B5E3C] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, goalInfo.overallRate)}%` }}
                      />
                    </div>
                  </div>

                  {/* Specific Targets Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                    {(participant.platformType === 'twitter' || participant.platformType === 'both') && (
                      <>
                        <div className="p-2.5 bg-sky-50/70 border border-sky-200/80 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-sky-800 uppercase block">트윗 게시글</span>
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm font-extrabold text-sky-950">{goalInfo.actualTweets}개</span>
                            <span className="text-[11px] font-bold text-sky-700">목표: {goalInfo.targetTweets}개</span>
                          </div>
                        </div>

                        <div className="p-2.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-indigo-800 uppercase block">트윗 답글(Reply)</span>
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm font-extrabold text-indigo-950">{goalInfo.actualReplies}개</span>
                            <span className="text-[11px] font-bold text-indigo-700">목표: {goalInfo.targetReplies}개</span>
                          </div>
                        </div>
                      </>
                    )}

                    {(participant.platformType === 'blog' || participant.platformType === 'both') && (
                      <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">블로그 포스팅</span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-extrabold text-emerald-950">{goalInfo.actualBlogPosts}개</span>
                          <span className="text-[11px] font-bold text-emerald-700">목표: {goalInfo.targetBlogPosts}개</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            
            {/* Registered Accounts Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                연동 계정 정보
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Blog Account Card */}
                <div
                  className={`p-3.5 rounded-xl border ${
                    hasBlog
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-emerald-600" />
                      네이버 블로그
                    </span>
                    {hasBlog ? (
                      <a
                        href={`https://blog.naver.com/${participant.blogId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-700 hover:underline inline-flex items-center gap-1 font-semibold"
                      >
                        <span>바로가기</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 font-bold">미등록 (-)</span>
                    )}
                  </div>
                  <p className="text-sm font-mono font-bold text-slate-800">
                    {hasBlog && participant.blogId ? `@${participant.blogId}` : '-'}
                  </p>
                  {hasBlog && (
                    <div className="mt-2 text-xs text-emerald-900 flex items-center justify-between pt-2 border-t border-emerald-200/60">
                      <span>일별 포스팅: <strong>{participant.dailyPostCount}개</strong></span>
                    </div>
                  )}
                </div>

                {/* Twitter Account Card */}
                <div
                  className={`p-3.5 rounded-xl border ${
                    hasTwitter
                      ? 'bg-sky-50/50 border-sky-200'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-sky-800 flex items-center gap-1.5">
                      <Twitter className="w-4 h-4 text-sky-500" />
                      트위터 계정
                    </span>
                    {hasTwitter ? (
                      <a
                        href={`https://x.com/${participant.twitterId?.replace('@', '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-sky-700 hover:underline inline-flex items-center gap-1 font-semibold"
                      >
                        <span>바로가기</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 font-bold">미등록 (-)</span>
                    )}
                  </div>
                  <p className="text-sm font-mono font-bold text-slate-800">
                    {hasTwitter && participant.twitterId ? participant.twitterId : '-'}
                  </p>
                  {hasTwitter && (
                    <div className="mt-2 text-xs text-sky-900 flex items-center justify-between pt-2 border-t border-sky-200/60">
                      <span>게시글: <strong>{participant.tweetCount}개</strong></span>
                      <span>답글: <strong>{participant.replyCount}개</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes / Special Info */}
            {participant.notes && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start space-x-2">
                <StickyNote className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">특이사항 & 진행 메모:</strong>
                  <p className="mt-0.5 text-slate-700 font-medium">{participant.notes}</p>
                </div>
              </div>
            )}

            {/* Daily History Activity Timeline */}
            {participant.history && participant.history.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  <span>최근 일별 활동 타임라인</span>
                </h3>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                  {participant.history.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50/50 flex items-center justify-between">
                      <span className="font-mono text-slate-600 font-bold">{item.date}</span>
                      <div className="flex items-center space-x-3 text-slate-700 font-medium">
                        {hasBlog && (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            글 {item.blogPosts}개
                          </span>
                        )}
                        {hasTwitter && (
                          <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                            트윗 {item.tweets}개 · 답글 {item.replies}개
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {!isEditing && (
              <button
                onClick={handleStartEditing}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>참가자 정보 수정</span>
              </button>
            )}
            {isAdminLoggedIn && (
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>참가자 삭제</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};

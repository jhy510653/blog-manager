import React, { useState } from 'react';
import {
  ListOrdered,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  CheckCircle2,
  Check,
  Copy,
  Edit3,
  RefreshCw,
  Tag,
  AlertCircle
} from 'lucide-react';
import { OutlineSection } from '../../types';
import { cleanAndNormalizeTitle } from '../../utils/titleUtils';

export interface OutlineEditorProps {
  selectedTitle?: string;
  sections: OutlineSection[];
  onChangeSections?: (sections: OutlineSection[]) => void;
  onUpdateSections?: (sections: OutlineSection[]) => void;
  isGeneratingOutline?: boolean;
  isGenerating?: boolean;
  onGenerateOutline?: () => void;
  onRegenerate?: () => void;
  onConfirmOutline?: () => void;
  onConfirm?: () => void;
  isConfirmed?: boolean;
  onShowToast?: (msg: string) => void;
}

export const OutlineEditor: React.FC<OutlineEditorProps> = ({
  selectedTitle = '',
  sections = [],
  onChangeSections,
  onUpdateSections,
  isGeneratingOutline = false,
  isGenerating = false,
  onGenerateOutline,
  onRegenerate,
  onConfirmOutline,
  onConfirm,
  isConfirmed = false,
  onShowToast
}) => {
  const [copied, setCopied] = useState(false);

  const activeIsGenerating = isGeneratingOutline || isGenerating;
  const activeGenerate = onGenerateOutline || onRegenerate;
  const activeConfirm = onConfirmOutline || onConfirm;

  const triggerUpdateSections = (updated: OutlineSection[]) => {
    if (onChangeSections) onChangeSections(updated);
    if (onUpdateSections) onUpdateSections(updated);
  };

  const handleUpdateHeading = (idx: number, newHeading: string) => {
    const updated = sections.map((sec, i) =>
      i === idx ? { ...sec, heading: newHeading } : sec
    );
    triggerUpdateSections(updated);
  };

  const handleUpdateCoreContent = (idx: number, newCore: string) => {
    const updated = sections.map((sec, i) =>
      i === idx ? { ...sec, coreContent: newCore } : sec
    );
    triggerUpdateSections(updated);
  };

  const handleUpdateKeywords = (idx: number, kwString: string) => {
    const kwArray = kwString
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    const updated = sections.map((sec, i) =>
      i === idx ? { ...sec, keyKeywords: kwArray } : sec
    );
    triggerUpdateSections(updated);
  };

  const handleMoveUp = (idx: number) => {
    if (idx <= 0) return;
    const updated = [...sections];
    const temp = updated[idx - 1];
    updated[idx - 1] = updated[idx];
    updated[idx] = temp;
    triggerUpdateSections(updated);
  };

  const handleMoveDown = (idx: number) => {
    if (idx >= sections.length - 1) return;
    const updated = [...sections];
    const temp = updated[idx + 1];
    updated[idx + 1] = updated[idx];
    updated[idx] = temp;
    triggerUpdateSections(updated);
  };

  const handleDelete = (idx: number) => {
    if (sections.length <= 1) {
      if (onShowToast) onShowToast('⚠️ 최소 1개 이상의 소제목이 필요합니다.');
      return;
    }
    const updated = sections.filter((_, i) => i !== idx);
    triggerUpdateSections(updated);
  };

  const handleAddSection = () => {
    const newId = `h2_${Date.now()}`;
    const newSection: OutlineSection = {
      id: newId,
      heading: `새 소제목 ${sections.length + 1}`,
      coreContent: '',
      keyKeywords: []
    };
    triggerUpdateSections([...sections, newSection]);
  };

  const handleCopyOutline = () => {
    const text = sections
      .map((sec, i) => `${i + 1}. ${cleanAndNormalizeTitle(sec.heading)}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    if (onShowToast) onShowToast('📋 소제목 목차가 클립보드에 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
      {/* Header Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-extrabold text-xs border border-blue-100">
            <ListOrdered className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
              <span>H2 소제목 구성 및 편집</span>
              <span className="text-xs text-blue-600 font-bold font-mono">({sections.length}개)</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              선택된 제목에 부합하는 소제목을 확인하고 순서 조정, 수정, 추가/삭제할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sections.length > 0 && (
            <button
              type="button"
              onClick={handleCopyOutline}
              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              title="목차 텍스트 복사"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? '복사됨' : '목차 복사'}</span>
            </button>
          )}

          {activeGenerate && (
            <button
              type="button"
              onClick={activeGenerate}
              disabled={activeIsGenerating || !selectedTitle}
              className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="현재 선택된 제목에 맞춰 소제목을 AI로 다시 생성합니다"
            >
              {activeIsGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>소제목 생성 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>소제목 AI 다시 생성</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Selected Title Reference Banner */}
      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100/80 flex items-start gap-2.5 text-xs">
        <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-extrabold text-[10px] shrink-0 mt-0.5">
          선택된 제목
        </span>
        <p className="font-extrabold text-slate-900 leading-snug break-keep flex-1">
          {selectedTitle || '선택된 제목이 없습니다. 이전 단계에서 제목을 선택해주세요.'}
        </p>
      </div>

      {/* Outline Sections List */}
      {sections.length > 0 ? (
        <div className="space-y-2.5">
          {sections.map((section, idx) => (
            <div
              key={section.id || idx}
              className="group bg-slate-50/70 border border-slate-200/90 hover:border-blue-300 rounded-xl p-3 space-y-2 transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs font-mono">
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={section.heading}
                    onChange={(e) => handleUpdateHeading(idx, e.target.value)}
                    placeholder={`H2 소제목 ${idx + 1} 입력`}
                    className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none transition-colors"
                  />
                </div>

                {/* Section Action Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(idx)}
                    disabled={idx === 0}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="위로 이동"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(idx)}
                    disabled={idx === sections.length - 1}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="아래로 이동"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Optional Section Content Notes / Keywords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5 text-[11px]">
                <div className="space-y-0.5">
                  <input
                    type="text"
                    value={section.coreContent || ''}
                    onChange={(e) => handleUpdateCoreContent(idx, e.target.value)}
                    placeholder="다룰 핵심 설명/내용 메모 (선택)"
                    className="w-full bg-white border border-slate-200/80 focus:border-blue-400 rounded-md px-2.5 py-1 text-[11px] text-slate-700 focus:outline-none"
                  />
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 bg-white border border-slate-200/80 focus-within:border-blue-400 rounded-md px-2 py-0.5">
                    <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={Array.isArray(section.keyKeywords) ? section.keyKeywords.join(', ') : ''}
                      onChange={(e) => handleUpdateKeywords(idx, e.target.value)}
                      placeholder="포함할 키워드 (쉼표 구분)"
                      className="w-full bg-transparent text-[11px] text-slate-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Add Section Button */}
          <button
            type="button"
            onClick={handleAddSection}
            className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 text-slate-600 hover:text-blue-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>새 H2 소제목 추가</span>
          </button>
        </div>
      ) : (
        <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl space-y-2">
          <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">아직 생성된 H2 소제목이 없습니다.</p>
          {activeGenerate && (
            <button
              type="button"
              onClick={activeGenerate}
              disabled={activeIsGenerating || !selectedTitle}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>선택된 제목 기반 H2 소제목 생성하기</span>
            </button>
          )}
        </div>
      )}

      {/* Confirmation & Completion Footer */}
      {sections.length > 0 && activeConfirm && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            {isConfirmed ? (
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>소제목 구성 확정 완료</span>
              </span>
            ) : (
              <span className="text-slate-500 text-[11px]">
                소제목 편집이 완료되면 '소제목 구성 확정'을 눌러주세요.
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={activeConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
              isConfirmed
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-900 hover:bg-black text-white'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isConfirmed ? '소제목 다시 확정하기' : '소제목 구성 확정'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { ChallengeResource } from '../types';
import { ExternalLink, Download, BookOpen } from 'lucide-react';
import { formatAnnouncementHtml } from '../utils/htmlUtils';

interface ResourceDetailPageProps {
  resource: ChallengeResource;
  onBack: () => void;
}

export const ResourceDetailPage: React.FC<ResourceDetailPageProps> = ({
  resource,
  onBack,
}) => {
  return (
    <div className="animate-in fade-in duration-150 max-w-4xl mx-auto space-y-6">
      <button
        onClick={onBack}
        className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1 cursor-pointer"
      >
        <span>← 자료실로 돌아가기</span>
      </button>

      <div className="bg-white rounded-3xl shadow-2xs border border-slate-200/90 w-full overflow-hidden flex flex-col">
        {/* Header Thumbnail */}
        <div className="relative w-full h-56 bg-slate-900 flex items-center justify-center overflow-hidden">
          {resource.thumbnailUrl ? (
            <img
              src={resource.thumbnailUrl}
              alt={resource.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="p-6 text-center space-y-2 text-white">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto border border-white/20">
                <BookOpen className="w-7 h-7 text-amber-300" />
              </div>
              <p className="text-sm font-bold text-amber-200">{resource.category || '챌린지 전용 자료'}</p>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 sm:p-10 space-y-6 flex-1">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-xl text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
                {resource.category || '일반 자료'}
              </span>
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700">
                {resource.targetGroup === 'all' ? '전체 회원' : (resource.targetGroup || '지정 챌린지')}
              </span>
              {resource.weekNumber && (
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700">
                  {resource.weekNumber}주차 가이드
                </span>
              )}
              <span className="text-xs text-slate-400 ml-auto font-medium">{resource.createdAt}</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
              {resource.title}
            </h3>
          </div>

          {/* Description */}
          {resource.description && (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 text-sm text-slate-700 leading-relaxed">
              {resource.description}
            </div>
          )}

          {/* Content / Guide Body */}
          {resource.content && (
            <div
              className="text-sm sm:text-base text-slate-800 leading-relaxed space-y-4 prose prose-slate max-w-none break-words [&>p]:mb-3 [&>div]:mb-2 [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>img]:rounded-xl [&>img]:max-w-full [&>img]:my-3 [&>img]:shadow-sm [&>a]:text-indigo-600 [&>a]:font-bold [&>a]:underline [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:p-2 [&_td]:border [&_td]:p-2"
              dangerouslySetInnerHTML={{ __html: formatAnnouncementHtml(resource.content) }}
            />
          )}

          {/* Action Buttons */}
          {(resource.linkUrl || resource.fileUrl) && (
            <div className="pt-8 border-t border-slate-100 flex flex-wrap items-center gap-3">
              {resource.linkUrl && (
                <a
                  href={resource.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-sm font-black transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <ExternalLink className="w-5 h-5 text-amber-700" />
                  <span>링크 바로가기</span>
                </a>
              )}

              {resource.fileUrl && (
                <a
                  href={resource.fileUrl}
                  download
                  className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Download className="w-5 h-5 text-amber-300" />
                  <span>첨부파일 다운로드</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

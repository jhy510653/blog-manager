import React from 'react';
import { Announcement } from '../types';
import { X, Pin, ExternalLink, Megaphone, Calendar, User } from 'lucide-react';
import { formatAnnouncementHtml, extractThumbnailFromHtml } from '../utils/htmlUtils';

interface AnnouncementDetailViewProps {
  announcement: Announcement;
  onBack: () => void;
}

export const AnnouncementDetailView: React.FC<AnnouncementDetailViewProps> = ({
  announcement,
  onBack,
}) => {
  if (!announcement) return null;

  const thumbnail = extractThumbnailFromHtml(announcement.content, announcement.thumbnailUrl);
  const formattedHtml = formatAnnouncementHtml(announcement.content || '');

  return (
    <div className="animate-in fade-in duration-150 max-w-4xl mx-auto space-y-6">
      <button
        onClick={onBack}
        className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1 cursor-pointer"
      >
        <span>← 목록으로 돌아가기</span>
      </button>

      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs w-full p-6 sm:p-10 space-y-6 flex flex-col overflow-hidden">
        {/* Header Section */}
        <div className="space-y-4 border-b border-slate-100 pb-6 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Megaphone className="w-5 h-5" />
            </span>
            {announcement.isImportant && (
              <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-600 text-white flex items-center gap-1">
                <Pin className="w-3.5 h-3.5 fill-current" />
                <span>필독 공지</span>
              </span>
            )}
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug pt-2">
            {announcement.title}
          </h3>

          <div className="flex items-center gap-4 text-xs text-slate-500 font-bold">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{announcement.createdAt}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{announcement.authorName || '운영자'}</span>
            </span>
          </div>
        </div>

        {/* Content Body - Render Rich HTML properly */}
        <div className="flex-1">
          {thumbnail && (
            <div className="mb-6 rounded-2xl overflow-hidden max-h-80 bg-slate-900 flex items-center justify-center border border-slate-100 shadow-xs">
              <img
                src={thumbnail}
                alt={announcement.title}
                className="w-full h-full object-cover max-h-80"
              />
            </div>
          )}
          <div
            id="announcement-modal-html-content"
            className="text-sm sm:text-base text-slate-800 leading-relaxed space-y-4 prose prose-slate max-w-none break-words [&>p]:mb-3 [&>div]:mb-2 [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>img]:rounded-xl [&>img]:max-w-full [&>img]:my-3 [&>img]:shadow-sm [&>a]:text-indigo-600 [&>a]:font-bold [&>a]:underline [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:p-2 [&_td]:border [&_td]:p-2"
            dangerouslySetInnerHTML={{ __html: formattedHtml }}
          />
        </div>

        {/* External Link Action Button if present */}
        {announcement.externalLinkUrl && (
          <div className="pt-6 border-t border-slate-100 shrink-0">
            <a
              id="announcement-external-link-btn"
              href={announcement.externalLinkUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-black transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer border border-indigo-200/60"
            >
              <span>{announcement.externalLinkLabel || '외부 링크 열기'}</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

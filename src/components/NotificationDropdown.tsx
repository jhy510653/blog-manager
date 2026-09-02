import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  CreditCard,
  TrendingUp,
  DollarSign,
  Award,
  Megaphone,
  Sparkles,
  MessageSquare,
  MessageCircle,
  HelpCircle,
  X,
  Clock,
} from 'lucide-react';
import { AppNotification, NotificationType } from '../types';
import { MainTabType } from './Header';

interface NotificationDropdownProps {
  notifications: AppNotification[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (notificationId: string) => void;
  onClearAllNotifications: () => void;
  onSelectMainTab: (tab: MainTabType) => void;
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAllNotifications,
  onSelectMainTab,
  isOpen,
  onClose,
  onToggle,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'payment_pending':
      case 'payment_approved':
      case 'payment_rejected':
        return <CreditCard className="w-4 h-4 text-blue-600" />;
      case 'refund_eligible':
        return <Award className="w-4 h-4 text-emerald-600" />;
      case 'refund_approved':
      case 'refund_completed':
      case 'refund_pending':
        return <DollarSign className="w-4 h-4 text-emerald-600" />;
      case 'revenue_submitted':
      case 'revenue_approved':
      case 'revenue_rejected':
        return <TrendingUp className="w-4 h-4 text-amber-600" />;
      case 'announcement':
        return <Megaphone className="w-4 h-4 text-indigo-600" />;
      case 'qna_new':
        return <HelpCircle className="w-4 h-4 text-cyan-600" />;
      case 'qna_answered':
        return <MessageSquare className="w-4 h-4 text-violet-600" />;
      case 'mission_alert':
        return <Award className="w-4 h-4 text-violet-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-blue-600" />;
    }
  };

  const getIconBg = (type: NotificationType) => {
    switch (type) {
      case 'payment_pending':
      case 'payment_approved':
      case 'payment_rejected':
        return 'bg-blue-50 border-blue-100';
      case 'refund_eligible':
        return 'bg-emerald-100 border-emerald-300 text-emerald-800';
      case 'refund_approved':
      case 'refund_completed':
      case 'refund_pending':
        return 'bg-emerald-50 border-emerald-100';
      case 'revenue_submitted':
      case 'revenue_approved':
      case 'revenue_rejected':
        return 'bg-amber-50 border-amber-100';
      case 'announcement':
        return 'bg-indigo-50 border-indigo-100';
      case 'qna_new':
        return 'bg-cyan-50 border-cyan-100';
      case 'qna_answered':
        return 'bg-violet-50 border-violet-100';
      case 'mission_alert':
        return 'bg-violet-50 border-violet-100';
      default:
        return 'bg-slate-50 border-slate-100';
    }
  };

  const handleItemClick = (notification: AppNotification) => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    if (notification.linkTab) {
      onSelectMainTab(notification.linkTab as MainTabType);
      onClose();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
          isOpen
            ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100 border-gray-100'
        }`}
        title="알림 목록"
        aria-label="알림"
      >
        <Bell className="w-5 h-5 stroke-[2.2px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Layer */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-[320px] sm:w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-white border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-extrabold text-slate-900">알림</span>
              {unreadCount > 0 ? (
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  새 알림 {unreadCount}개
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-400">모두 확인됨</span>
              )}
            </div>

            <div className="flex items-center space-x-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  className="text-[11px] font-bold text-slate-600 hover:text-blue-600 px-2 py-1 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  title="모두 읽음으로 표시"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>모두 읽음</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAllNotifications}
                  className="text-[11px] font-medium text-slate-400 hover:text-rose-600 px-2 py-1 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="전체 알림 지우기"
                >
                  지우기
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-gray-50 text-slate-300 flex items-center justify-center mx-auto">
                  <Bell className="w-6 h-6 stroke-[1.5px]" />
                </div>
                <p className="text-xs font-bold text-slate-600">새로운 알림이 없습니다.</p>
                <p className="text-[11px] text-slate-400 leading-tight">
                  참가비 입금 승인, Q&A 답변, 공지사항, 수익 인증 결과 등이 이곳에 표시됩니다.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3.5 transition-all cursor-pointer flex items-start space-x-3 group relative ${
                    n.isRead ? 'bg-white hover:bg-gray-50/80 opacity-80' : 'bg-blue-50/25 hover:bg-blue-50/50'
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${getIconBg(
                      n.type
                    )}`}
                  >
                    {getNotificationIcon(n.type)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 pr-6 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4
                        className={`text-xs truncate ${
                          n.isRead ? 'font-bold text-slate-800' : 'font-extrabold text-slate-900'
                        }`}
                      >
                        {n.title}
                      </h4>
                      {!n.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 ml-1"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug break-words">
                      {n.message}
                    </p>
                    {n.actionUrl && (
                      <div className="pt-1.5 pb-0.5">
                        <a
                          href={n.actionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!n.isRead) {
                              onMarkAsRead(n.id);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-black rounded-lg shadow-xs transition-all cursor-pointer"
                        >
                          <span>{n.actionLabel || '환급 신청하기'}</span>
                          <ExternalLink className="w-3 h-3 text-white" />
                        </a>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 pt-0.5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-slate-300" />
                        {n.createdAt}
                      </span>
                      {n.linkTab && (
                        <span className="text-[10px] text-blue-600 font-bold flex items-center gap-0.5">
                          <span>바로가기</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Delete */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNotification(n.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all absolute right-2 top-3"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2.5 bg-gray-50/80 border-t border-gray-100 text-center">
              <span className="text-[11px] text-slate-500 font-medium">
                입금 확인, Q&A 답변, 공지사항, 수익 인증 심사 결과가 실시간으로 안내됩니다.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

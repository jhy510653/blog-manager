import React, { useState } from 'react';
import { ChallengeGroup } from '../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, CheckCircle2, Flag, Flame } from 'lucide-react';

interface ChallengeCalendarProps {
  group: ChallengeGroup;
}

export const ChallengeCalendar: React.FC<ChallengeCalendarProps> = ({ group }) => {
  // Parse startDate and endDate
  const startDate = new Date(group.startDate);
  const endDate = new Date(group.endDate);

  // Today Date (or standard system date 2026-07-25)
  const today = new Date('2026-07-25'); // Using fixed current app baseline date or Date.now()
  today.setHours(0, 0, 0, 0);

  // Initial Calendar View Month state (Default to start date or today's month)
  const [currentViewDate, setCurrentViewDate] = useState<Date>(() => {
    return new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  });

  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth(); // 0-indexed

  // Calculate days in month
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0: Sun, 1: Mon...
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentViewDate(new Date(year, month + 1, 1));
  };

  // Check if a specific YYYY-MM-DD is within the challenge period
  const isDateInRange = (date: Date) => {
    const time = date.getTime();
    const startTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const endTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
    return time >= startTime && time <= endTime;
  };

  const isStartDay = (date: Date) => {
    return (
      date.getFullYear() === startDate.getFullYear() &&
      date.getMonth() === startDate.getMonth() &&
      date.getDate() === startDate.getDate()
    );
  };

  const isEndDay = (date: Date) => {
    return (
      date.getFullYear() === endDate.getFullYear() &&
      date.getMonth() === endDate.getMonth() &&
      date.getDate() === endDate.getDate()
    );
  };

  const isToday = (date: Date) => {
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // D-Day and Progress Bar calculations
  const startMs = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
  const endMs = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
  const todayMs = today.getTime();

  const totalDurationDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);
  let elapsedDays = Math.round((todayMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
  if (todayMs < startMs) elapsedDays = 0;
  if (todayMs > endMs) elapsedDays = totalDurationDays;

  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDurationDays) * 100)));

  // Days left/passed calculation text
  let dDayText = '';
  let dDayBadgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-300';

  if (todayMs < startMs) {
    const daysUntilStart = Math.ceil((startMs - todayMs) / (1000 * 60 * 60 * 24));
    dDayText = `시작 D-${daysUntilStart}`;
    dDayBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
  } else if (todayMs > endMs) {
    dDayText = '챌린지 종료';
    dDayBadgeClass = 'bg-slate-200 text-slate-700 border-slate-300';
  } else {
    const daysLeft = Math.ceil((endMs - todayMs) / (1000 * 60 * 60 * 24));
    dDayText = `진행 D+${elapsedDays} (종료 D-${daysLeft})`;
    dDayBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  }

  // Days of week header
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  // Generate calendar cells grid
  const calendarGrid = [];
  // Empty leading slots
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarGrid.push(null);
  }
  // Days of month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarGrid.push(new Date(year, month, day));
  }

  return (
    <div className="bg-white rounded-2xl border border-[#EAE7E1] p-3.5 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-2.5">
      {/* Calendar Header with D-Day Badge & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] sm:text-[11px] font-bold text-[#4A3525] bg-[#F5F3EF] px-2.5 py-0.5 rounded-full border border-[#EAE7E1] flex items-center gap-1">
              <CalendarIcon className="w-3 h-3 text-[#4A3525]" />
              <span>챌린지 일정 시각화</span>
            </span>
            <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border ${dDayBadgeClass}`}>
              {dDayText}
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-stone-900 tracking-tight">
            {group.name} 기간 캘린더
          </h3>
        </div>

        {/* Month Selector Buttons */}
        <div className="flex items-center space-x-1.5 bg-[#F5F3EF] p-1 rounded-xl border border-[#EAE7E1] self-start sm:self-auto">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-lg hover:bg-white text-stone-700 hover:text-stone-900 transition-all cursor-pointer"
            title="이전 달"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-extrabold text-stone-800 px-1.5 font-mono">
            {year}년 {month + 1}월
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-lg hover:bg-white text-stone-700 hover:text-stone-900 transition-all cursor-pointer"
            title="다음 달"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Timeline Bar */}
      <div className="bg-[#F5F3EF]/60 rounded-xl p-2 sm:p-2.5 border border-[#EAE7E1] space-y-1">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-stone-800 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-600" />
            <span>챌린지 진행율</span>
            <strong className="text-[#4A3525] font-extrabold">
              {elapsedDays}일째 / 총 {totalDurationDays}일 ({progressPercent}%)
            </strong>
          </span>
          <span className="text-stone-500 font-mono text-[11px]">
            {group.startDate} ~ {group.endDate}
          </span>
        </div>

        <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-[#4A3525] rounded-full transition-all duration-700"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Month Calendar Grid */}
      <div className="space-y-1">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-[11px] font-bold text-stone-400 py-0.5">
          {weekDays.map((wd, i) => (
            <span key={wd} className={i === 0 ? 'text-rose-500' : i === 6 ? 'text-sky-600' : ''}>
              {wd}
            </span>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarGrid.map((dateCell, idx) => {
            if (!dateCell) {
              return <div key={`empty-${idx}`} className="h-7 sm:h-8 rounded-lg bg-stone-50/50" />;
            }

            const inRange = isDateInRange(dateCell);
            const start = isStartDay(dateCell);
            const end = isEndDay(dateCell);
            const todayCell = isToday(dateCell);
            const dayNum = dateCell.getDate();
            const dayOfWeek = dateCell.getDay();

            // Background / Text Styling
            let cellBgClass = 'bg-stone-50/70 text-stone-800 hover:bg-stone-100 border border-stone-200/50';
            if (inRange) {
              cellBgClass = 'bg-[#F5F3EF] text-stone-900 border border-[#EAE7E1] font-bold';
            }

            if (start) {
              cellBgClass = 'bg-[#4A3525] text-white font-extrabold shadow-2xs';
            } else if (end) {
              cellBgClass = 'bg-stone-700 text-white font-extrabold shadow-2xs';
            }

            return (
              <div
                key={dateCell.toISOString()}
                className={`h-7 sm:h-8 rounded-lg p-0.5 flex items-center justify-between transition-all relative ${cellBgClass} ${
                  todayCell ? 'ring-2 ring-amber-600 ring-offset-1 z-10 font-bold' : ''
                }`}
              >
                {/* Date Number */}
                <span
                  className={`text-[11px] sm:text-xs pl-1 font-semibold ${
                    start || end
                      ? 'text-white'
                      : dayOfWeek === 0
                      ? 'text-rose-600'
                      : dayOfWeek === 6
                      ? 'text-sky-600'
                      : ''
                  }`}
                >
                  {dayNum}
                </span>

                {/* Cute Miniature Badges */}
                {start && (
                  <span className="text-[8px] bg-amber-500 text-amber-950 px-1 py-0.2 rounded font-black mr-0.5">
                    시작
                  </span>
                )}
                {end && (
                  <span className="text-[8px] bg-stone-900 text-stone-100 px-1 py-0.2 rounded font-black mr-0.5">
                    종료
                  </span>
                )}
                {todayCell && !start && !end && (
                  <span className="text-[8px] bg-amber-600 text-white px-1 py-0.2 rounded font-black mr-0.5">
                    오늘
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


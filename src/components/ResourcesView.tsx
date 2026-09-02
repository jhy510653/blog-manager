import React, { useState, useMemo, useEffect } from 'react';
import {
  ChallengeResource,
  ChallengeGroup,
  Participant,
  NaverUser,
  ResourceType,
  ResourceVisibility,
  ResourceCategoryItem,
} from '../types';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  ExternalLink,
  Download,
  Lock,
  Search,
  X,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileCode,
  FileSpreadsheet,
  Video,
  Image as ImageIcon,
  Archive,
  Layers,
  Settings,
  ArrowUpDown,
  Maximize2,
  Eye,
  Tag,
  Upload,
  Clock,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import { formatAnnouncementHtml } from '../utils/htmlUtils';

interface ResourcesViewProps {
  resources: ChallengeResource[];
  groups: ChallengeGroup[];
  participants: Participant[];
  currentUser: NaverUser | null;
  isAdminLoggedIn: boolean;
  onAddResource: (resource: ChallengeResource) => void;
  onDeleteResource: (id: string) => void;
  onUpdateResource: (resource: ChallengeResource) => void;
  onNavigate?: (path: string) => void;
}

const DEFAULT_RESOURCE_CATEGORIES: ResourceCategoryItem[] = [
  { id: 'cat_all', name: '전체', orderIndex: 0, isDefault: true },
  { id: 'cat_ftc', name: '공정위 가이드', orderIndex: 1 },
  { id: 'cat_keyword', name: '키워드 리서치', orderIndex: 2 },
  { id: 'cat_curriculum', name: '커리큘럼 자료', orderIndex: 3 },
  { id: 'cat_template', name: '수익화 템플릿', orderIndex: 4 },
  { id: 'cat_cpa', name: 'CPA/체험단 가이드', orderIndex: 5 },
];

export const ResourcesView: React.FC<ResourcesViewProps> = ({
  resources = [],
  groups = [],
  participants = [],
  currentUser,
  isAdminLoggedIn,
  onAddResource,
  onDeleteResource,
  onUpdateResource,
  onNavigate,
}) => {
  // Category State with localStorage persistence
  const [categories, setCategories] = useState<ResourceCategoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('challenge_resource_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_RESOURCE_CATEGORIES;
  });

  const [activeCategory, setActiveCategory] = useState<string>('전체');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');

  // Preview Modal

  // Category Management Modal (Admin)
  const [isCategoryManageModalOpen, setIsCategoryManageModalOpen] = useState(false);
  const [categoryListEdit, setCategoryListEdit] = useState<ResourceCategoryItem[]>([]);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState('');

  // Add/Edit Resource Form Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; title: string } | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('커리큘럼 자료');
  const [resourceType, setResourceType] = useState<ResourceType>('pdf');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<ResourceVisibility>('all');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [isRequired, setIsRequired] = useState(false);
  const [isPublished, setIsPublished] = useState(true);

  // Save categories to localStorage
  const saveCategories = (newList: ResourceCategoryItem[]) => {
    setCategories(newList);
    try {
      localStorage.setItem('challenge_resource_categories', JSON.stringify(newList));
    } catch (e) {
      console.error('Failed to save resource categories:', e);
    }
  };

  // Determine user's enrolled challenge group names
  const userEnrolledGroups = useMemo(() => {
    if (!currentUser) return [];
    const enrolled = new Set<string>();
    (participants || []).forEach((p) => {
      const matchBlog = Boolean(p.blogId && currentUser.naverId && p.blogId.toLowerCase() === currentUser.naverId.toLowerCase());
      const matchName = Boolean(p.participantName && currentUser.name && p.participantName.toLowerCase() === currentUser.name.toLowerCase());
      const matchTwitter = Boolean(currentUser.twitterId && p.twitterId && p.twitterId.toLowerCase() === currentUser.twitterId.toLowerCase());

      if (matchBlog || matchName || matchTwitter) {
        if (p.groupNames && p.groupNames.length > 0) {
          p.groupNames.forEach((g) => enrolled.add(g));
        } else if (p.groupName) {
          p.groupName.split(',').forEach((g) => enrolled.add(g.trim()));
        }
      }
    });
    return Array.from(enrolled);
  }, [currentUser, participants]);

  // Check if resource is accessible by current user
  const canAccessResource = (resource: ChallengeResource): boolean => {
    if (isAdminLoggedIn) return true;
    if (resource.isPublished === false) return false;
    if (resource.visibility === 'all' || resource.targetGroup === 'all') return true;

    const resourceTargetNames = resource.targetGroupNames || (resource.targetGroup && resource.targetGroup !== 'all' ? [resource.targetGroup] : []);
    if (resourceTargetNames.length === 0) return true;
    return resourceTargetNames.some((name) => userEnrolledGroups.includes(name));
  };

  // Filtered resources based on Category, Group, Search
  const filteredResources = useMemo(() => {
    return (resources || []).filter((r) => {
      // Access check for normal users
      if (!isAdminLoggedIn && r.isPublished === false) return false;

      // Category filter
      if (activeCategory !== '전체') {
        const itemCategory = r.category || '커리큘럼 자료';
        if (itemCategory !== activeCategory) return false;
      }

      // Group filter
      if (selectedGroupFilter !== 'all') {
        const itemTarget = r.targetGroup || 'all';
        const itemTargetNames = r.targetGroupNames || [];
        const matches = itemTarget === 'all' || itemTarget === selectedGroupFilter || itemTargetNames.includes(selectedGroupFilter);
        if (!matches) return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesDesc = (r.description || '').toLowerCase().includes(q);
        const matchesCategory = (r.category || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCategory) return false;
      }

      return true;
    }).sort((a, b) => {
      // Required items first, then date descending
      if (a.isRequired && !b.isRequired) return -1;
      if (!a.isRequired && b.isRequired) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [resources, activeCategory, selectedGroupFilter, searchTerm, isAdminLoggedIn]);

  // Handle Form Open
  const handleOpenAddForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setCategory(categories.find((c) => c.name !== '전체')?.name || '커리큘럼 자료');
    setResourceType('pdf');
    setThumbnailUrl('');
    setFileUrl('');
    setFileName('');
    setFileSize('');
    setLinkUrl('');
    setContent('');
    setVisibility('all');
    setSelectedGroupIds(groups.map((g) => g.id));
    setWeekNumber(1);
    setIsRequired(false);
    setIsPublished(true);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (r: ChallengeResource, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingId(r.id);
    setTitle(r.title);
    setDescription(r.description || '');
    setCategory(r.category || '커리큘럼 자료');
    setResourceType(r.resourceType || 'pdf');
    setThumbnailUrl(r.thumbnailUrl || '');
    setFileUrl(r.fileUrl || '');
    setFileName(r.fileName || '');
    setFileSize(r.fileSize || '');
    setLinkUrl(r.linkUrl || '');
    setContent(r.content || '');
    setVisibility(r.visibility || (r.targetGroup === 'all' ? 'all' : 'specific_challenges'));
    
    let matchedIds = r.targetGroupIds || [];
    if (matchedIds.length === 0 && r.targetGroupNames && r.targetGroupNames.length > 0) {
      matchedIds = groups.filter((g) => r.targetGroupNames?.includes(g.name)).map((g) => g.id);
    }
    setSelectedGroupIds(matchedIds.length > 0 ? matchedIds : groups.map((g) => g.id));
    setWeekNumber(r.weekNumber || 1);
    setIsRequired(Boolean(r.isRequired));
    setIsPublished(r.isPublished !== undefined ? r.isPublished : true);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const selectedGroupNames = groups.filter((g) => selectedGroupIds.includes(g.id)).map((g) => g.name);
    const today = new Date().toISOString().split('T')[0];

    const newResource: ChallengeResource = {
      id: editingId || `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      resourceType,
      thumbnailUrl: thumbnailUrl.trim() || undefined,
      fileUrl: fileUrl.trim() || undefined,
      fileName: fileName.trim() || undefined,
      fileSize: fileSize.trim() || undefined,
      linkUrl: linkUrl.trim() || undefined,
      content: content.trim() || undefined,
      visibility,
      targetGroup: visibility === 'all' ? 'all' : (selectedGroupNames[0] || 'all'),
      targetGroupIds: visibility === 'all' ? undefined : selectedGroupIds,
      targetGroupNames: visibility === 'all' ? undefined : selectedGroupNames,
      weekNumber,
      isRequired,
      isPublished,
      createdAt: today,
    };

    if (editingId) {
      onUpdateResource(newResource);
    } else {
      onAddResource(newResource);
    }

    setIsFormOpen(false);
  };

  // Helper for File Format Badge & Color
  const getFormatBadge = (type?: ResourceType) => {
    switch (type) {
      case 'pdf':
        return { label: 'PDF', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: FileText };
      case 'excel':
        return { label: 'EXCEL', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: FileSpreadsheet };
      case 'word':
        return { label: 'WORD', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: FileCode };
      case 'video':
        return { label: 'VIDEO', bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: Video };
      case 'image':
        return { label: 'IMAGE', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: ImageIcon };
      case 'zip':
        return { label: 'ZIP', bg: 'bg-slate-100 text-slate-700 border-slate-300', icon: Archive };
      case 'link':
      default:
        return { label: 'LINK', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: ExternalLink };
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      
      {/* Top Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-black shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                자료실
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                공정위 문구 가이드, 고수익 키워드 리서치 모음, 챌린지 실전 템플릿을 한눈에 확인하고 다운로드하세요.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdminLoggedIn && (
            <>
              <button
                type="button"
                onClick={() => {
                  setCategoryListEdit([...categories]);
                  setIsCategoryManageModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5"
                title="카테고리 탭 편집 및 관리"
              >
                <Settings className="w-3.5 h-3.5 text-slate-600" />
                <span>카테고리 관리</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddForm}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>자료 등록</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Category Filter Tabs Bar (Horizontal Scrollable) */}
      <div className="flex items-center justify-between gap-3 bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5 no-scrollbar scroll-smooth">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.name;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.name)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{cat.name}</span>
                {cat.name === '전체' && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {resources.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search and Challenge Group Filter Dropdowns */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={selectedGroupFilter}
            onChange={(e) => setSelectedGroupFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer hidden md:block"
          >
            <option value="all">전체 대상</option>
            {groups.map((g) => (
              <option key={g.id} value={g.name}>
                {g.name}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="자료명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none w-36 sm:w-48"
            />
          </div>
        </div>
      </div>

      {/* Gallery Grid (PC 4 cols, Tablet 2 cols, Mobile 1 col) */}
      {filteredResources.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <p className="text-sm font-extrabold text-slate-700">해당 조건의 등록된 자료가 없습니다.</p>
          <p className="text-xs text-slate-400">다른 카테고리를 선택하거나 검색어를 변경해 보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {filteredResources.map((r) => {
            const hasAccess = canAccessResource(r);
            const badge = getFormatBadge(r.resourceType);
            const BadgeIcon = badge.icon;

            return (
              <div
                key={r.id}
                onClick={() => {
                  if (hasAccess) {
                    if (onNavigate) {
                      onNavigate(`/resources/${r.id}`);
                    } else {
                      console.warn("No onNavigate provided");
                    }
                  }
                }}
                className={`group bg-white rounded-3xl border flex flex-col overflow-hidden transition-all duration-200 ${
                  hasAccess
                    ? 'border-slate-200/90 shadow-2xs hover:shadow-xl hover:border-amber-400/80 hover:-translate-y-1 cursor-pointer'
                    : 'border-slate-200/50 opacity-70 bg-slate-50/50 cursor-not-allowed'
                }`}
              >
                {/* Top Thumbnail Image / Banner */}
                <div className="relative w-full h-40 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center overflow-hidden">
                  {r.thumbnailUrl ? (
                    <img
                      src={r.thumbnailUrl}
                      alt={r.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center space-y-2 text-white/90">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
                        <BadgeIcon className="w-6 h-6 text-amber-300" />
                      </div>
                      <span className="text-[11px] font-black tracking-wider text-amber-200/90 uppercase">
                        {r.category || '자료실'}
                      </span>
                    </div>
                  )}

                  {/* Format Badge overlay on top-left */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border backdrop-blur-md shadow-xs flex items-center gap-1 ${badge.bg}`}>
                      <BadgeIcon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>
                    {r.isRequired && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-600 text-white shadow-xs">
                        필독
                      </span>
                    )}
                  </div>

                  {/* Week / Group Badge on top-right */}
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    {r.weekNumber && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-xs border border-white/10">
                        {r.weekNumber}주차
                      </span>
                    )}
                    {!hasAccess && (
                      <span className="p-1 rounded-lg bg-rose-900/90 text-white">
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    {/* Category & Date */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-extrabold truncate max-w-[120px]">
                        {r.category || '자료'}
                      </span>
                      <span>{r.createdAt}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm sm:text-base font-black text-slate-900 line-clamp-2 tracking-tight group-hover:text-amber-700 transition-colors">
                      {r.title}
                    </h3>

                    {/* Description */}
                    {r.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {r.description}
                      </p>
                    )}
                  </div>

                  {/* Card Bottom: Direct Action Buttons (Open Link / Download) */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {hasAccess ? (
                      <div className="flex items-center gap-1.5 w-full">
                        {r.linkUrl && (
                          <a
                            href={r.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-2xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
                            <span>링크 열기</span>
                          </a>
                        )}

                        {r.fileUrl && (
                          <a
                            href={r.fileUrl}
                            download={r.fileName || r.title}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-2xs"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-300" />
                            <span>다운로드</span>
                          </a>
                        )}

                        {!r.linkUrl && !r.fileUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onNavigate) {
                                onNavigate(`/resources/${r.id}`);
                              } else {
                                console.warn("No onNavigate provided");
                              }
                            }}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>상세 보기</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-rose-600 font-bold">
                        <Lock className="w-3.5 h-3.5" />
                        <span>챌린지 참가자 전용</span>
                      </div>
                    )}

                    {/* Admin Action Buttons */}
                    {isAdminLoggedIn && (
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditForm(r, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          title="수정"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmTarget({ id: r.id, title: r.title })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Admin Category Management Modal */}
      {isCategoryManageModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-slate-900">자료실 카테고리 필터 관리</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryManageModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              상단 탭에 노출될 자료 카테고리를 추가, 수정, 삭제할 수 있습니다. 저장 즉시 화면에 반영됩니다.
            </p>

            {/* Add New Category Field */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="새 카테고리 이름 입력..."
                value={newCategoryNameInput}
                onChange={(e) => setNewCategoryNameInput(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCategoryNameInput.trim()) {
                    e.preventDefault();
                    const trimmed = newCategoryNameInput.trim();
                    if (!categoryListEdit.some((c) => c.name === trimmed)) {
                      setCategoryListEdit([
                        ...categoryListEdit,
                        { id: `cat_${Date.now()}`, name: trimmed, orderIndex: categoryListEdit.length },
                      ]);
                      setNewCategoryNameInput('');
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = newCategoryNameInput.trim();
                  if (trimmed && !categoryListEdit.some((c) => c.name === trimmed)) {
                    setCategoryListEdit([
                      ...categoryListEdit,
                      { id: `cat_${Date.now()}`, name: trimmed, orderIndex: categoryListEdit.length },
                    ]);
                    setNewCategoryNameInput('');
                  }
                }}
                disabled={!newCategoryNameInput.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>추가</span>
              </button>
            </div>

            {/* Category List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {categoryListEdit.map((cat, idx) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50"
                >
                  <span className="text-xs font-bold text-slate-800">{cat.name}</span>
                  <div className="flex items-center gap-1">
                    {cat.name !== '전체' && (
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryListEdit(categoryListEdit.filter((c) => c.id !== cat.id));
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCategoryManageModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  saveCategories(categoryListEdit);
                  setIsCategoryManageModalOpen(false);
                }}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-xs"
              >
                저장 및 적용
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Resource Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl p-6 sm:p-8 space-y-5 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  {editingId ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingId ? '자료 수정' : '새 자료 등록'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    참가자들에게 제공할 가이드, 키워드 모음, 템플릿 정보를 입력하세요.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  자료 제목 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: [1주차] 공정위 문구 필수 가이드 & 클린코드"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Category & Resource Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">카테고리</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-none"
                  >
                    {categories.filter((c) => c.name !== '전체').map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">파일 형식 배지</label>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value as ResourceType)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-none"
                  >
                    <option value="pdf">PDF 문서</option>
                    <option value="excel">EXCEL 스프레드시트</option>
                    <option value="word">WORD 문서</option>
                    <option value="video">VIDEO 동영상</option>
                    <option value="image">IMAGE 이미지</option>
                    <option value="zip">ZIP 압축파일</option>
                    <option value="link">LINK 외부링크</option>
                  </select>
                </div>
              </div>

              {/* Thumbnail URL */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">대표 썸네일 이미지 URL (선택)</label>
                <input
                  type="url"
                  placeholder="https://example.com/thumbnail.png (PDF 1페이지 또는 대표 사진)"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Links: Direct File Download & External Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">다운로드 파일 링크 (fileUrl)</label>
                  <input
                    type="url"
                    placeholder="https://... (클릭 시 즉시 다운로드)"
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">웹 바로가기 링크 (linkUrl)</label>
                  <input
                    type="url"
                    placeholder="https://... (노션/구글닥스/외부페이지)"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">자료 요약 설명</label>
                <textarea
                  rows={2}
                  placeholder="자료에 대한 간략한 안내 및 활용법을 작성하세요."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-y"
                />
              </div>

              {/* Week Number & Required Check */}
              <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">주차 배지:</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={weekNumber}
                    onChange={(e) => setWeekNumber(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-center font-bold"
                  />
                  <span className="text-xs text-slate-500">주차</span>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-bold text-rose-700">필독 자료로 지정</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-700">즉시 공개</span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer"
                >
                  {editingId ? '수정 저장' : '등록 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-slate-900">자료 삭제 확인</h4>
              <p className="text-xs text-slate-600">
                정말 <span className="font-bold text-rose-600">"{deleteConfirmTarget.title}"</span> 자료를 삭제하시겠습니까?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteResource(deleteConfirmTarget.id);
                  setDeleteConfirmTarget(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Upload,
  Globe,
  X,
  Check,
  Code2,
  Eye,
  Sparkles,
} from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  storageBucket?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = '공지사항 내용을 자유롭게 작성하세요...',
  minHeight = '320px',
  storageBucket = 'challenge_proofs',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [sourceValue, setSourceValue] = useState(value);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageAltInput, setImageAltInput] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTextInput, setLinkTextInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync internal editor content with external prop when appropriate
  useEffect(() => {
    if (editorRef.current && !isSourceMode) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    setSourceValue(value);
  }, [value, isSourceMode]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html);
      setSourceValue(html);
    }
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    handleInput();
  };

  const handleFormatBlock = (tag: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand('formatBlock', false, tag);
    handleInput();
  };

  // Image insertion
  const insertImageTag = (url: string, alt: string = '') => {
    if (!url) return;
    if (editorRef.current) {
      editorRef.current.focus();
    }
    const cleanAlt = alt.replace(/"/g, '&quot;');
    const imgHtml = `<p><img src="${url}" alt="${cleanAlt}" class="rounded-2xl max-w-full my-4 shadow-xs border border-slate-200" style="max-height: 480px; object-fit: contain; display: block; margin-left: auto; margin-right: auto;" /></p><p><br/></p>`;
    document.execCommand('insertHTML', false, imgHtml);
    handleInput();
  };

  // File upload to Supabase Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `announcement_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `announcements/${fileName}`;

        const { data, error } = await supabase.storage.from(storageBucket).upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

        if (!error && data) {
          const { data: publicUrlData } = supabase.storage.from(storageBucket).getPublicUrl(filePath);
          if (publicUrlData && publicUrlData.publicUrl) {
            insertImageTag(publicUrlData.publicUrl, file.name);
            setIsImageModalOpen(false);
            setIsUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }
        }
      }

      // Fallback: Read as base64 data URL
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Url = event.target?.result as string;
        if (base64Url) {
          insertImageTag(base64Url, file.name);
          setIsImageModalOpen(false);
        }
        setIsUploadingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Image upload failed:', err);
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Insert Link
  const handleInsertLink = () => {
    if (!linkUrlInput.trim()) return;
    let url = linkUrlInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const text = linkTextInput.trim() || url;
    if (editorRef.current) {
      editorRef.current.focus();
    }
    const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 underline font-semibold hover:text-indigo-800">${text}</a>`;
    document.execCommand('insertHTML', false, linkHtml);
    handleInput();
    setIsLinkModalOpen(false);
    setLinkUrlInput('');
    setLinkTextInput('');
  };

  const toggleSourceMode = () => {
    if (isSourceMode) {
      onChange(sourceValue);
      setIsSourceMode(false);
    } else {
      setSourceValue(value);
      setIsSourceMode(true);
    }
  };

  return (
    <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-2xs focus-within:border-slate-400 transition-all flex flex-col">
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Editor Toolbar */}
      <div className="bg-slate-50/80 border-b border-slate-200/90 p-2 sm:p-2.5 flex flex-wrap items-center gap-1 sm:gap-1.5 select-none">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-0.5">
          <button
            type="button"
            onClick={() => execCmd('undo')}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title="실행 취소 (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => execCmd('redo')}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title="다시 실행 (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-0.5">
          <button
            type="button"
            onClick={() => handleFormatBlock('<h1>')}
            className="px-2 py-1 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 text-xs font-black transition-colors"
            title="대제목 (H1)"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => handleFormatBlock('<h2>')}
            className="px-2 py-1 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 text-xs font-black transition-colors"
            title="중제목 (H2)"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => handleFormatBlock('<h3>')}
            className="px-2 py-1 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 text-xs font-bold transition-colors"
            title="소제목 (H3)"
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => handleFormatBlock('<p>')}
            className="px-2 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 text-xs font-semibold transition-colors"
            title="본문 문단 (P)"
          >
            본문
          </button>
        </div>

        {/* Text Formats: Bold, Italic, Underline, Strike */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-0.5">
          <button
            type="button"
            onClick={() => execCmd('bold')}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title="굵게 (Bold)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => execCmd('italic')}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title="기울임 (Italic)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => execCmd('underline')}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title="밑줄 (Underline)"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => execCmd('strikeThrough')}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title="취소선"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
        </div>

        {/* Lists & Quote */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-0.5">
          <button
            type="button"
            onClick={() => execCmd('insertUnorderedList')}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title="글머리 기호 목록"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => execCmd('insertOrderedList')}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title="번호 매기기 목록"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleFormatBlock('<blockquote>')}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title="인용구 (Blockquote)"
          >
            <Quote className="w-4 h-4" />
          </button>
        </div>

        {/* Alignments */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-0.5">
          <button
            type="button"
            onClick={() => execCmd('justifyLeft')}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title="왼쪽 정렬"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => execCmd('justifyCenter')}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title="가운데 정렬"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => execCmd('justifyRight')}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title="오른쪽 정렬"
          >
            <AlignRight className="w-4 h-4" />
          </button>
        </div>

        {/* Link & Image Insertion */}
        <div className="flex items-center gap-1 border-r border-slate-200 pr-1.5 mr-0.5">
          <button
            type="button"
            onClick={() => {
              const selectedText = window.getSelection()?.toString() || '';
              setLinkTextInput(selectedText);
              setIsLinkModalOpen(true);
            }}
            className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors flex items-center gap-1"
            title="링크 삽입"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">링크</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImageModalOpen(true)}
            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors flex items-center gap-1"
            title="이미지 첨부 및 삽입"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">이미지</span>
          </button>
        </div>

        {/* HTML Source Mode Toggle */}
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={toggleSourceMode}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
              isSourceMode
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
            title="HTML 소스 코드 직접 편집"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{isSourceMode ? '에디터 보기' : 'HTML 소스'}</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      {isSourceMode ? (
        <textarea
          value={sourceValue}
          onChange={(e) => {
            setSourceValue(e.target.value);
            onChange(e.target.value);
          }}
          className="w-full p-4 font-mono text-xs text-slate-800 bg-slate-900/5 focus:outline-none resize-y"
          style={{ minHeight }}
          placeholder="<p>HTML 코드를 직접 입력하세요...</p>"
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onBlur={handleInput}
          className="w-full p-4 sm:p-6 text-sm text-slate-800 focus:outline-none overflow-y-auto leading-relaxed prose prose-slate max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
          style={{ minHeight }}
          data-placeholder={placeholder}
        />
      )}

      {/* Link Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <LinkIcon className="w-4 h-4 text-indigo-600" />
                <span>링크 삽입</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">연결할 URL</label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={linkUrlInput}
                  onChange={(e) => setLinkUrlInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">표시할 텍스트 (선택)</label>
                <input
                  type="text"
                  placeholder="링크 텍스트"
                  value={linkTextInput}
                  onChange={(e) => setLinkTextInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleInsertLink}
                disabled={!linkUrlInput.trim()}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs"
              >
                링크 추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {isImageModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>이미지 첨부 및 삽입</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Option 1: File Upload */}
            <div className="p-4 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 text-center space-y-2">
              <Upload className="w-6 h-6 text-emerald-600 mx-auto" />
              <div>
                <p className="text-xs font-extrabold text-emerald-950">컴퓨터에서 이미지 파일 업로드</p>
                <p className="text-[11px] text-emerald-700/80">JPG, PNG, GIF, WebP (본문에 바로 삽입됩니다)</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                {isUploadingImage ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>업로드 중...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>파일 선택</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[11px] font-bold text-slate-400">또는 URL 직접 입력</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Option 2: Image URL */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">이미지 웹 URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">이미지 대체 텍스트 (Alt)</label>
                <input
                  type="text"
                  placeholder="이미지 설명"
                  value={imageAltInput}
                  onChange={(e) => setImageAltInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  insertImageTag(imageUrlInput.trim(), imageAltInput.trim());
                  setIsImageModalOpen(false);
                  setImageUrlInput('');
                  setImageAltInput('');
                }}
                disabled={!imageUrlInput.trim()}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs"
              >
                URL 이미지 삽입
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

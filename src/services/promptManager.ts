/**
 * [AI Toolkit 프롬프트 관리자 모듈]
 * - Supabase DB(ai_toolkit_prompts)에서 활성 프롬프트를 조회하고 관리합니다.
 * - 인메모리 캐싱(TTL 60초) 및 수정 즉시 캐시 무효화(Cache Invalidation)를 지원합니다.
 * - DB 장애, 네트워크 오류, 테이블 미생성 시 100% 안전한 기본 프롬프트(Fallback)로 동작합니다.
 * - 버전 히스토리(ai_toolkit_prompt_versions) 기록 및 이전 버전 복원을 지원합니다.
 */

import { DEFAULT_AI_TOOLKIT_PROMPTS, PromptDefinition } from './promptDefaults';
import { COMMON_STRICT_RULES, STYLE_PROMPTS, getHtmlOptionsInstruction, getStylePrompt } from './seoPrompts';

export interface PromptRecord {
  id: string;
  prompt_key: string;
  prompt_name: string;
  prompt_content: string;
  description?: string;
  category?: 'seo_plan' | 'draft' | 'media' | 'analytics';
  is_active: boolean;
  version: number;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface PromptVersionRecord {
  id: string;
  prompt_id?: string;
  prompt_key: string;
  version: number;
  prompt_content: string;
  change_summary?: string;
  created_at: string;
  created_by?: string;
}

function isValidUuid(val?: string): boolean {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

// In-Memory Cache Store (TTL: 60s)
interface CacheEntry {
  record: PromptRecord;
  cachedAt: number;
}

const promptCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * 프롬프트 캐시 즉시 무효화
 */
export function invalidatePromptCache(promptKey?: string): void {
  if (promptKey) {
    promptCache.delete(promptKey);
    console.log(`[AI Toolkit] In-memory cache invalidated for key: ${promptKey}`);
  } else {
    promptCache.clear();
    console.log('[AI Toolkit] In-memory cache completely cleared');
  }
}

const PROMPT_KEY_ALIASES: Record<string, string> = {
  draft_experience: 'draft_review',
  draft_travel: 'draft_review',
  draft_cpa: 'draft_purchase',
  draft_story: 'draft_homepan',
};

/**
 * 활성 프롬프트 단건 조회 (캐시 -> DB -> Fallback)
 */
export async function getActivePrompt(
  promptKey: string,
  supabaseClient?: any
): Promise<string> {
  const resolvedKey = PROMPT_KEY_ALIASES[promptKey] || promptKey;
  const defaultDef = DEFAULT_AI_TOOLKIT_PROMPTS[resolvedKey] || DEFAULT_AI_TOOLKIT_PROMPTS[promptKey];
  const fallbackContent = defaultDef ? defaultDef.prompt_content : '';

  // 1. Check in-memory cache
  const cached = promptCache.get(promptKey) || promptCache.get(resolvedKey);
  const now = Date.now();
  if (cached && (now - cached.cachedAt < CACHE_TTL_MS)) {
    return cached.record.prompt_content || fallbackContent;
  }

  // 2. Query Supabase
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('ai_toolkit_prompts')
        .select('*')
        .eq('prompt_key', promptKey)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.warn(`[AI Toolkit] Prompt DB lookup warning for key "${promptKey}":`, error.message);
        console.warn(`[AI Toolkit] Using fallback prompt for: ${promptKey}`);
        return fallbackContent;
      }

      if (data && data.prompt_content) {
        promptCache.set(promptKey, {
          record: data,
          cachedAt: now,
        });
        return data.prompt_content;
      }
    } catch (e: any) {
      console.warn(`[AI Toolkit] Prompt DB lookup exception for key "${promptKey}":`, e?.message || e);
      console.warn(`[AI Toolkit] Using fallback prompt for: ${promptKey}`);
      return fallbackContent;
    }
  }

  // 3. Fallback
  return fallbackContent;
}

/**
 * 모든 프롬프트 목록 조회 (관리자용: DB 데이터 + 기본값 머지)
 */
export async function getAllPrompts(supabaseClient?: any): Promise<PromptRecord[]> {
  const resultList: PromptRecord[] = [];
  const defaultKeys = Object.keys(DEFAULT_AI_TOOLKIT_PROMPTS);

  let dbPromptsMap = new Map<string, any>();

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('ai_toolkit_prompts')
        .select('*')
        .order('category', { ascending: true })
        .order('prompt_key', { ascending: true });

      if (!error && Array.isArray(data)) {
        for (const item of data) {
          dbPromptsMap.set(item.prompt_key, item);
          // Also warm up cache
          promptCache.set(item.prompt_key, { record: item, cachedAt: Date.now() });
        }
      }
    } catch (e: any) {
      console.warn('[AI Toolkit] Failed to load prompts from DB:', e?.message || e);
    }
  }

  // Merge with default definitions to guarantee all 9 prompts exist in response
  for (const key of defaultKeys) {
    const def = DEFAULT_AI_TOOLKIT_PROMPTS[key];
    const dbItem = dbPromptsMap.get(key);

    if (dbItem) {
      resultList.push({
        id: dbItem.id || key,
        prompt_key: dbItem.prompt_key,
        prompt_name: dbItem.prompt_name || def.prompt_name,
        prompt_content: dbItem.prompt_content || def.prompt_content,
        description: dbItem.description || def.description,
        category: dbItem.category || def.category,
        is_active: dbItem.is_active ?? true,
        version: dbItem.version || 1,
        created_at: dbItem.created_at,
        updated_at: dbItem.updated_at,
        updated_by: dbItem.updated_by || 'admin',
      });
    } else {
      resultList.push({
        id: key,
        prompt_key: def.prompt_key,
        prompt_name: def.prompt_name,
        prompt_content: def.prompt_content,
        description: def.description,
        category: def.category,
        is_active: def.is_active,
        version: def.version,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: 'system_default',
      });
    }
  }

  return resultList;
}

/**
 * 특정 프롬프트 상세 및 버전 히스토리 조회
 */
export async function getPromptWithHistory(
  promptKey: string,
  supabaseClient?: any
): Promise<{ prompt: PromptRecord; versions: PromptVersionRecord[] }> {
  const defaultDef = DEFAULT_AI_TOOLKIT_PROMPTS[promptKey];
  let prompt: PromptRecord = {
    id: promptKey,
    prompt_key: promptKey,
    prompt_name: defaultDef?.prompt_name || promptKey,
    prompt_content: defaultDef?.prompt_content || '',
    description: defaultDef?.description || '',
    category: defaultDef?.category || 'draft',
    is_active: true,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: 'admin',
  };

  let versions: PromptVersionRecord[] = [];

  if (supabaseClient) {
    try {
      const { data: promptData } = await supabaseClient
        .from('ai_toolkit_prompts')
        .select('*')
        .eq('prompt_key', promptKey)
        .maybeSingle();

      if (promptData) {
        prompt = promptData;
      }

      const { data: versionsData } = await supabaseClient
        .from('ai_toolkit_prompt_versions')
        .select('*')
        .eq('prompt_key', promptKey)
        .order('version', { ascending: false });

      if (versionsData && Array.isArray(versionsData)) {
        versions = versionsData;
      }
    } catch (e: any) {
      console.warn(`[AI Toolkit] Error fetching prompt history for ${promptKey}:`, e);
    }
  }

  // If no versions exist in DB, provide initial v1
  if (versions.length === 0) {
    versions.push({
      id: `v1_${promptKey}`,
      prompt_key: promptKey,
      version: 1,
      prompt_content: prompt.prompt_content,
      change_summary: '최초 시스템 프롬프트 등록',
      created_at: prompt.created_at || new Date().toISOString(),
      created_by: prompt.updated_by || 'admin',
    });
  }

  return { prompt, versions };
}

/**
 * 프롬프트 수정 및 신규 버전 생성
 */
export async function savePrompt(
  promptKey: string,
  payload: {
    prompt_name?: string;
    prompt_content: string;
    description?: string;
    is_active?: boolean;
    change_summary?: string;
    updated_by?: string;
  },
  supabaseClient?: any
): Promise<{ success: boolean; prompt: PromptRecord; version: number; dbSaved?: boolean; error?: string }> {
  const defaultDef = DEFAULT_AI_TOOLKIT_PROMPTS[promptKey];
  const updatedBy = payload.updated_by || 'admin';
  const now = new Date().toISOString();

  // Invalidate cache immediately so new content takes effect right away
  invalidatePromptCache(promptKey);

  const promptName = payload.prompt_name || defaultDef?.prompt_name || promptKey;
  const category = defaultDef?.category || 'draft';
  const description = payload.description !== undefined ? payload.description : (defaultDef?.description || '');

  let nextVersion = 2;
  let savedRecord: PromptRecord = {
    id: promptKey,
    prompt_key: promptKey,
    prompt_name: promptName,
    prompt_content: payload.prompt_content,
    description,
    category,
    is_active: payload.is_active ?? true,
    version: nextVersion,
    updated_at: now,
    updated_by: updatedBy,
  };

  let dbSaved = false;
  let dbErrorMessage = '';

  if (supabaseClient) {
    try {
      // 1. Get current version if exists
      const { data: existing, error: fetchErr } = await supabaseClient
        .from('ai_toolkit_prompts')
        .select('*')
        .eq('prompt_key', promptKey)
        .maybeSingle();

      if (existing) {
        nextVersion = (Number(existing.version) || 1) + 1;
        savedRecord.version = nextVersion;
        savedRecord.id = existing.id;
      }

      // 2. Upsert in ai_toolkit_prompts
      const upsertData: Record<string, any> = {
        prompt_key: promptKey,
        prompt_name: promptName,
        prompt_content: payload.prompt_content,
        description,
        category,
        is_active: payload.is_active ?? true,
        version: nextVersion,
        updated_at: now,
        updated_by: updatedBy,
      };

      // Only pass id if existing record has a valid UUID to avoid PostgreSQL type errors
      if (existing?.id && isValidUuid(existing.id)) {
        upsertData.id = existing.id;
      }

      const { data: savedPrompt, error: upsertErr } = await supabaseClient
        .from('ai_toolkit_prompts')
        .upsert(upsertData, { onConflict: 'prompt_key' })
        .select('*')
        .maybeSingle();

      if (upsertErr) {
        console.error('[AI Toolkit] Prompt DB upsert error:', upsertErr.message);
        dbErrorMessage = upsertErr.message;
      } else if (savedPrompt) {
        savedRecord = savedPrompt;
        dbSaved = true;
      } else {
        dbSaved = true;
      }

      // 3. Insert version history record if DB write succeeded
      if (dbSaved) {
        const targetPromptId = savedPrompt?.id || existing?.id;
        const versionData: Record<string, any> = {
          prompt_key: promptKey,
          version: nextVersion,
          prompt_content: payload.prompt_content,
          change_summary: payload.change_summary || `v${nextVersion} 프롬프트 수정`,
          created_at: now,
          created_by: updatedBy,
        };
        if (targetPromptId && isValidUuid(targetPromptId)) {
          versionData.prompt_id = targetPromptId;
        }

        const { error: verErr } = await supabaseClient
          .from('ai_toolkit_prompt_versions')
          .insert(versionData);

        if (verErr) {
          console.warn('[AI Toolkit] Version record insert notice:', verErr.message);
        }
      }
    } catch (err: any) {
      console.error('[AI Toolkit] savePrompt database exception:', err?.message || err);
      dbErrorMessage = err?.message || String(err);
    }
  }

  // Update in-memory cache
  promptCache.set(promptKey, {
    record: savedRecord,
    cachedAt: Date.now(),
  });

  return {
    success: true,
    prompt: savedRecord,
    version: nextVersion,
    dbSaved,
    error: dbErrorMessage || undefined,
  };
}

/**
 * 이전 버전으로 복원
 */
export async function restorePromptVersion(
  promptKey: string,
  targetVersion: number,
  updatedBy: string = 'admin',
  supabaseClient?: any
): Promise<{ success: boolean; restoredContent: string; newVersion: number }> {
  invalidatePromptCache(promptKey);

  let targetContent = '';

  if (supabaseClient) {
    try {
      const { data: verRecord } = await supabaseClient
        .from('ai_toolkit_prompt_versions')
        .select('*')
        .eq('prompt_key', promptKey)
        .eq('version', targetVersion)
        .maybeSingle();

      if (verRecord && verRecord.prompt_content) {
        targetContent = verRecord.prompt_content;
      }
    } catch (e: any) {
      console.warn(`[AI Toolkit] Error fetching version v${targetVersion} for ${promptKey}:`, e?.message || e);
    }
  }

  // Fallback to default definition if version 1
  if (!targetContent) {
    const defaultDef = DEFAULT_AI_TOOLKIT_PROMPTS[promptKey];
    if (defaultDef && targetVersion === 1) {
      targetContent = defaultDef.prompt_content;
    } else {
      throw new Error(`Version v${targetVersion} of ${promptKey} not found`);
    }
  }

  // Save as new version
  const saveResult = await savePrompt(
    promptKey,
    {
      prompt_content: targetContent,
      change_summary: `v${targetVersion} 버전으로 복원됨`,
      updated_by: updatedBy,
    },
    supabaseClient
  );

  return {
    success: true,
    restoredContent: targetContent,
    newVersion: saveResult.version,
  };
}

/**
 * 프롬프트 템플릿 치환 헬퍼 (템플릿 변수 ${var} 또는 {{var}} 안전 교체)
 */
export function interpolatePrompt(template: string, vars: Record<string, any>): string {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    const val = v !== undefined && v !== null ? String(v) : '';
    // Replace ${key} and {{key}}
    result = result.split(`\${${k}}`).join(val);
    result = result.split(`{{${k}}}`).join(val);
  }
  return result;
}

/**
 * 본문 초안(Draft) 시스템 프롬프트 조립
 */
export async function buildDraftSystemPrompt(
  selectedStyle: string,
  promptData: {
    mainTopic: string;
    subKeywords?: string;
    targetName?: string;
    userExperience?: string;
    targetAudience?: string;
    toneStyle?: string;
    customTone?: string;
    writingStyle?: string;
    h2Style?: string;
    quoteStyle?: string;
    contentBoundary?: {
      coreIntent?: string;
      targetAudience?: string;
      mustCover?: string[];
      optionalCover?: string[];
      mustAvoid?: string[];
      geographicScope?: string;
      contentTypeCategory?: string;
    };
    selectedHtml?: {
      includeFaq?: boolean;
      includeTable?: boolean;
      includeChecklist?: boolean;
      includeImageRec?: boolean;
      includeQuote?: boolean;
    };
  },
  supabaseClient?: any
): Promise<string> {
  const styleInstruction = getStylePrompt(promptData.writingStyle || selectedStyle);
  const htmlInstruction = getHtmlOptionsInstruction(promptData.selectedHtml || {});

  // 1. Get common rules from DB or fallback
  const commonRules = await getActivePrompt('common_strict_rules', supabaseClient);

  // 2. Determine prompt key based on selected style
  let promptKey = 'draft_review';
  const styleNorm = (selectedStyle || '').toLowerCase();
  if (
    styleNorm === 'experience' ||
    styleNorm === 'experience_draft' ||
    styleNorm === 'travel' ||
    styleNorm === 'travel_draft' ||
    styleNorm === 'review' ||
    styleNorm === 'review_draft' ||
    styleNorm.includes('경험') ||
    styleNorm.includes('후기') ||
    styleNorm.includes('리뷰') ||
    styleNorm.includes('여행') ||
    styleNorm.includes('맛집')
  ) {
    promptKey = 'draft_review';
  } else if (styleNorm === 'info' || styleNorm === 'info_draft' || styleNorm.includes('정보')) {
    promptKey = 'draft_info';
  } else if (styleNorm === 'purchase' || styleNorm === 'purchase_draft' || styleNorm === 'cpa' || styleNorm === 'cpa_draft' || styleNorm.includes('구매') || styleNorm.includes('추천')) {
    promptKey = 'draft_purchase';
  } else if (styleNorm === 'comparison' || styleNorm === 'comparison_draft' || styleNorm.includes('비교')) {
    promptKey = 'draft_comparison';
  } else if (styleNorm === 'homepan' || styleNorm === 'homepan_draft' || styleNorm === 'story' || styleNorm === 'story_draft' || styleNorm.includes('홈판') || styleNorm.includes('화제') || styleNorm.includes('스토리')) {
    promptKey = 'draft_homepan';
  }

  // 3. Get base prompt template from DB or fallback
  let rawTemplate = await getActivePrompt(promptKey, supabaseClient);
  if (!rawTemplate && promptKey === 'draft_review') {
    rawTemplate = await getActivePrompt('draft_experience', supabaseClient) || await getActivePrompt('draft_travel', supabaseClient);
  }

  // 4. Construct Content Boundary Instruction
  let boundaryInstruction = '';
  if (promptData.contentBoundary) {
    const cb = promptData.contentBoundary;
    const items: string[] = [];
    if (cb.coreIntent) items.push(`- 핵심 검색 목적: ${cb.coreIntent}`);
    if (cb.targetAudience) items.push(`- 타깃 독자층: ${cb.targetAudience}`);
    if (cb.geographicScope) items.push(`- 지리적/지역 범위: ${cb.geographicScope} (이 지역 범위를 절대로 벗어나지 말 것)`);
    if (cb.mustCover && cb.mustCover.length > 0) {
      items.push(`- 필수 포함 사항 (Must Cover):\n  * ${cb.mustCover.join('\n  * ')}`);
    }
    if (cb.optionalCover && cb.optionalCover.length > 0) {
      items.push(`- 선택적 보조 사항 (Optional Cover):\n  * ${cb.optionalCover.join('\n  * ')}`);
    }
    if (cb.mustAvoid && cb.mustAvoid.length > 0) {
      items.push(`- 절대 제외/금지 사항 (Must Avoid - 엄격 준수):\n  * ${cb.mustAvoid.join('\n  * ')}`);
    }
    items.push(`- ⚠️ 위 '절대 제외/금지 사항'에 해당하는 내용(예: 해외여행 비교, 무관한 일반론 등)은 본문에 일체 포함하지 마십시오.`);
    boundaryInstruction = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n[콘텐츠 범위(Content Boundary) 및 검색의도 준수 지침]\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${items.join('\n')}\n`;
  }

  // 5. Interpolate variables into template
  const customToneSnippet = promptData.customTone 
    ? `- 사용자 고유 말투 샘플: "${promptData.customTone}" (이 어조를 최대한 반영할 것)` 
    : '';

  const templateVars = {
    mainTopic: promptData.mainTopic || '',
    subKeywords: promptData.subKeywords || '문맥에 맞게 자연스럽게 추출',
    targetName: promptData.targetName || promptData.mainTopic || '',
    userExperience: promptData.userExperience || '자연스럽고 몰입감 있는 서사 구성',
    targetAudience: promptData.targetAudience || '해당 주제에 관심 있는 네이버 검색 유저',
    toneStyle: promptData.toneStyle || '친근한 블로그체 (~했어요, ~했습니다)',
    customTone: customToneSnippet,
    commonRules: (commonRules || COMMON_STRICT_RULES) + boundaryInstruction,
    styleInstruction,
    htmlInstruction,
  };

  const finalPrompt = interpolatePrompt(rawTemplate, templateVars);
  return finalPrompt;
}

/**
 * 카드뉴스(Card News) 시스템 프롬프트 조립
 */
export async function buildCardNewsSystemPrompt(
  params: {
    cardCount: number;
    style: string;
    aiGraphicStyle: string;
    imageMode: string;
  },
  supabaseClient?: any
): Promise<string> {
  const rawTemplate = await getActivePrompt('card_news', supabaseClient);

  const templateVars = {
    cardCount: params.cardCount || 6,
    style: params.style || 'info',
    aiGraphicStyle: params.aiGraphicStyle || 'photoreal',
    imageMode: params.imageMode || 'auto',
  };

  return interpolatePrompt(rawTemplate, templateVars);
}

/**
 * 초기 부팅 시 Supabase에 기본 프롬프트 자동 등록 (테이블에 없는 경우에만)
 */
export async function autoSeedPromptsIfEmpty(supabaseClient: any): Promise<void> {
  if (!supabaseClient) return;

  try {
    const { data: existing, error } = await supabaseClient
      .from('ai_toolkit_prompts')
      .select('prompt_key, id, version, updated_by');

    if (error) {
      console.warn('[AI Toolkit] Auto-seed check notice (Table may not exist yet):', error.message);
      return;
    }

    const existingMap = new Map<string, any>((existing || []).map((x: any) => [x.prompt_key, x]));
    const now = new Date().toISOString();

    for (const [key, def] of Object.entries(DEFAULT_AI_TOOLKIT_PROMPTS)) {
      const existingRecord: any = existingMap.get(key);
      if (!existingRecord) {
        console.log(`[AI Toolkit] Seeding initial prompt for key: ${key}`);
        
        // 1. Insert prompt without hardcoded id so column DEFAULT handles TEXT or UUID
        const { data: insertedPrompt, error: insertErr } = await supabaseClient
          .from('ai_toolkit_prompts')
          .insert({
            prompt_key: key,
            prompt_name: def.prompt_name,
            prompt_content: def.prompt_content,
            description: def.description,
            category: def.category,
            is_active: true,
            version: def.version || 1,
            created_at: now,
            updated_at: now,
            updated_by: 'system_init',
          })
          .select('*')
          .maybeSingle();

        if (insertErr) {
          console.warn(`[AI Toolkit] Seed insert notice for ${key}:`, insertErr.message);
          continue;
        }

        // 2. Insert initial version
        const targetId = insertedPrompt?.id;
        const versionInsertObj: any = {
          prompt_key: key,
          version: def.version || 1,
          prompt_content: def.prompt_content,
          change_summary: '시스템 초기 기본 프롬프트 등록',
          created_at: now,
          created_by: 'system_init',
        };
        if (targetId) {
          versionInsertObj.prompt_id = targetId;
        }

        await supabaseClient.from('ai_toolkit_prompt_versions').insert(versionInsertObj);
      } else if (existingRecord.updated_by === 'system_init' && (existingRecord.version || 1) < (def.version || 1)) {
        // Upgrade system default prompt if not modified by admin
        console.log(`[AI Toolkit] Upgrading system prompt for key: ${key} to v${def.version}`);
        await supabaseClient
          .from('ai_toolkit_prompts')
          .update({
            prompt_name: def.prompt_name,
            prompt_content: def.prompt_content,
            description: def.description,
            version: def.version,
            updated_at: now,
          })
          .eq('prompt_key', key);

        await supabaseClient.from('ai_toolkit_prompt_versions').insert({
          prompt_key: key,
          version: def.version,
          prompt_content: def.prompt_content,
          change_summary: `시스템 프롬프트 v${def.version} 자동 업데이트`,
          created_at: now,
          created_by: 'system_init',
          ...(existingRecord.id ? { prompt_id: existingRecord.id } : {}),
        });

        invalidatePromptCache(key);
      }
    }
  } catch (e: any) {
    console.warn('[AI Toolkit] Auto-seed exception:', e?.message || e);
  }
}

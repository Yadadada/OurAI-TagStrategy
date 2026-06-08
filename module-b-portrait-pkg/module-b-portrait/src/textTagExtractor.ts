/**
 * 文本标签抽取器
 *
 * 调用 Dashscope（OpenAI 兼容协议）从用户文本回答中提取结构化标签。
 * 输出格式为"固定主标签 + 半开放子标签"，带 weight 和 quote。
 *
 * 使用方式：
 *   const result = await extractTextTags('q19', '已读不回最受不了');
 *   // → { fieldId: 'q19', tags: [{main:'communication_breakdown', sub:'已读不回', weight:0.95, quote:'已读不回'}] }
 */

import {
  getTagTreeForField,
  getMainIdsForField,
  Q22_INTERACTION_MODES,
  type ExtractedTag,
  type Q22TagResult,
  type TextTagResult,
  type InteractionMode,
  type TagCategory,
  type TokenUsage,
} from './tagTree.js';

function getTagModelId(): string {
  return process.env.DATING_TAG_MODEL_ID
    || process.env.QWEN_TAG_MODEL_ID
    || 'qwen-plus';
}

// ---------------------------------------------------------------------------
// Prompt 构造
// ---------------------------------------------------------------------------

function buildTagTreeBlock(categories: TagCategory[]): string {
  return categories.map((cat) =>
    `- **${cat.id}**（${cat.label}）：${cat.description}\n  预设子标签：${cat.presetSubs.join('、')}`
  ).join('\n');
}

// ---------------------------------------------------------------------------
// Few-shot 例子库（用 DATING_TAG_FEW_SHOT=1 启用）
//
// 选取标准：normal 典型 + longtail 网络用语 + boundary 多标签 + empty 空判
// 每字段 4 条，对应样本 ID 在 eval/run-eval.ts 的 FEW_SHOT_IDS 中剔除以保证评测公平。
// ---------------------------------------------------------------------------

const FEW_SHOT_Q22 = [
  {
    text: '想找个咖啡馆坐坐聊聊天',
    reasoning: '用户想去咖啡馆并聊天，"咖啡馆"对应 food_social 的预设子标签，"聊聊天"是强互动信号词。',
    output: '{"reasoning":"用户想去咖啡馆并聊天，咖啡馆对应 food_social，聊天是强互动信号。","scene_tags":[{"main":"food_social","sub":"咖啡馆","weight":0.95,"quote":"咖啡馆坐坐"}],"interaction_mode":"strong"}',
  },
  {
    text: 'citywalk',
    reasoning: 'citywalk 是网络用语，指漫无目的逛街/散步，归 stroll；文本未出现互动信号词，互动模式判 null。',
    output: '{"reasoning":"citywalk 是网络用语指漫无目的散步，归 stroll；无互动信号词，interaction_mode 判 null。","scene_tags":[{"main":"stroll","sub":"citywalk","weight":1.0,"quote":"citywalk"}],"interaction_mode":null}',
  },
  {
    text: '一起吃饭，吃完散步聊聊天',
    reasoning: '同时提到吃饭（food_social）和散步（stroll），双主标签；"聊聊天"是强互动信号。',
    output: '{"reasoning":"同时有吃饭（food_social）和散步（stroll），双标签；聊聊天=强互动。","scene_tags":[{"main":"food_social","sub":"吃饭","weight":0.6,"quote":"一起吃饭"},{"main":"stroll","sub":"散步","weight":0.4,"quote":"散步聊聊天"}],"interaction_mode":"strong"}',
  },
  {
    text: '都行',
    reasoning: '"都行"属于无意义回答，返回空数组。',
    output: '{"reasoning":"无意义回答。","scene_tags":[],"interaction_mode":null}',
  },
];

const FEW_SHOT_Q23 = [
  {
    text: '已读不回最受不了',
    reasoning: '"已读不回"是 communication_breakdown 的预设子标签，沟通断裂的典型表达。',
    output: '{"reasoning":"已读不回是 communication_breakdown 的典型表达。","tags":[{"main":"communication_breakdown","sub":"已读不回","weight":1.0,"quote":"已读不回"}]}',
  },
  {
    text: '喜欢画大饼',
    reasoning: '"画大饼"是网络用语，指口头承诺却不兑现，本质是不诚实，归 dishonesty。',
    output: '{"reasoning":"画大饼=承诺不兑现=不诚实，归 dishonesty。","tags":[{"main":"dishonesty","sub":"画大饼","weight":1.0,"quote":"画大饼"}]}',
  },
  {
    text: '忽冷忽热，吵架还冷暴力',
    reasoning: '"忽冷忽热"是情感忽视（emotional_neglect）；"吵架冷暴力"是沟通断裂（communication_breakdown），两个主标签并列。',
    output: '{"reasoning":"忽冷忽热=情感忽视；冷暴力=沟通断裂；双主标签。","tags":[{"main":"emotional_neglect","sub":"忽冷忽热","weight":0.5,"quote":"忽冷忽热"},{"main":"communication_breakdown","sub":"冷暴力","weight":0.5,"quote":"吵架还冷暴力"}]}',
  },
  {
    text: '',
    reasoning: '空文本，返回空数组。',
    output: '{"reasoning":"空文本。","tags":[]}',
  },
];

const FEW_SHOT_Q24 = [
  {
    text: '希望对方性格开朗幽默一点',
    reasoning: '"开朗"和"幽默"都是性格描述词，归 personality。',
    output: '{"reasoning":"开朗、幽默都是性格描述，归 personality。","tags":[{"main":"personality","sub":"开朗幽默","weight":1.0,"quote":"性格开朗幽默"}]}',
  },
  {
    text: '最好是infp或者isfp，不要太e',
    reasoning: 'infp/isfp 是 MBTI 人格类型，"e" 在 MBTI 语境指外向；这是用 MBTI 网络用语描述性格偏好，归 personality。',
    output: '{"reasoning":"infp/isfp 和 e 都是 MBTI 网络用语描述性格偏好，归 personality。","tags":[{"main":"personality","sub":"MBTI偏好","weight":1.0,"quote":"infp或者isfp，不要太e"}]}',
  },
  {
    text: '穿搭好看一点，正常身材，长相端正，不要抽烟喝酒',
    reasoning: '前半"穿搭/身材/长相"都是 appearance；后半"不抽烟喝酒"是 lifestyle 范畴，双主标签。',
    output: '{"reasoning":"穿搭/身材/长相=appearance；不抽烟喝酒=lifestyle；双主标签。","tags":[{"main":"appearance","sub":"穿搭身材","weight":0.6,"quote":"穿搭好看，正常身材，长相端正"},{"main":"lifestyle","sub":"不抽烟喝酒","weight":0.4,"quote":"不要抽烟喝酒"}]}',
  },
  {
    text: '都行',
    reasoning: '无意义回答，返回空数组。',
    output: '{"reasoning":"无意义回答。","tags":[]}',
  },
];

function fewShotEnabled(): boolean {
  return process.env.DATING_TAG_FEW_SHOT === '1';
}

function cotEnabled(): boolean {
  return process.env.DATING_TAG_COT === '1';
}

function buildFewShotBlock(examples: { text: string; reasoning: string; output: string }[]): string {
  if (!fewShotEnabled()) return '';
  const lines = ['', '## 示例（仿照下列例子的输出格式与标签归类）'];
  for (const ex of examples) {
    lines.push(`输入：${ex.text || '（空字符串）'}`);
    lines.push(`输出：${ex.output}`);
    lines.push('');
  }
  return lines.join('\n');
}

function buildCotBlock(): string {
  if (!cotEnabled()) return '';
  return [
    '',
    '## 推理要求（重要）',
    '在输出 JSON 中包含 reasoning 字段（一句话，30 字内）：',
    '1. 如果文本含网络用语/隐喻（中央空调、PUA、画大饼、爹味、infp/e、citywalk 等），先用通俗语言解释这个词在恋爱语境的含义',
    '2. 然后说明该含义为什么对应所选主标签',
    '示例：reasoning="中央空调=对多人都暖、没专一，本质是不忠诚，归 dishonesty"',
  ].join('\n');
}

function buildQ22Prompt(text: string): string {
  const treeBlock = buildTagTreeBlock(getTagTreeForField('intro_prompt'));
  return [
    '你是一个标签抽取助手。根据用户对"第一次见面最希望一起做什么"的回答，提取结构化标签。',
    '',
    '## 场景主标签（必须从以下 5 个中选择）',
    treeBlock,
    '',
    '## 互动方式（可选，最多 1 个）',
    `- **strong**（强互动）：${Q22_INTERACTION_MODES.strong.description}，典型关键词：${Q22_INTERACTION_MODES.strong.keywords.join('、')}`,
    `- **weak**（弱互动）：${Q22_INTERACTION_MODES.weak.description}，典型关键词：${Q22_INTERACTION_MODES.weak.keywords.join('、')}`,
    '- 如果文本中没有明确的互动意图，interaction_mode 填 null',
    '',
    '## 输出规则',
    '1. scene_tags：1-3 个场景标签，每个必须包含 main（主标签 ID）、sub（子标签，优先用预设的，也可以新建）、weight（0-1，突出程度）、quote（原文依据，必须是用户原话的片段）',
    '2. interaction_mode："strong" 或 "weak" 或 null',
    '3. 如果用户文本为空、无意义（"没有""无""不知道"等），返回空数组',
    '4. 输出严格 JSON，不要解释',
    '',
    '## 输出格式',
    '{"scene_tags":[{"main":"主标签ID","sub":"子标签","weight":0.9,"quote":"原文片段"}],"interaction_mode":"strong"|"weak"|null}',
    buildCotBlock(),
    buildFewShotBlock(FEW_SHOT_Q22),
    `## 用户回答\n${text}`,
  ].join('\n');
}

function buildQ23Q24Prompt(fieldId: 'q19' | 'q20', text: string): string {
  const treeBlock = buildTagTreeBlock(getTagTreeForField(fieldId));
  const fieldLabel = fieldId === 'q19'
    ? '你最受不了一段关系里出现什么状态'
    : '对对方的补充要求';
  const fewShotExamples = fieldId === 'q19' ? FEW_SHOT_Q23 : FEW_SHOT_Q24;

  return [
    `你是一个标签抽取助手。根据用户对"${fieldLabel}"的回答，提取结构化标签。`,
    '',
    '## 主标签（必须从以下列表中选择）',
    treeBlock,
    '',
    '## 输出规则',
    '1. tags：1-3 个标签，每个必须包含 main（主标签 ID）、sub（子标签，优先用预设的，也可以新建）、weight（0-1，突出程度）、quote（原文依据，必须是用户原话的片段）',
    '2. 如果用户文本为空、无意义（"没有""无""不知道""都行"等），返回空数组',
    '3. weight 说明：如果文本只表达了一个意思，该标签 weight 为 0.9-1.0；多个意思时按突出程度分配',
    '4. 输出严格 JSON，不要解释',
    '',
    '## 输出格式',
    '{"tags":[{"main":"主标签ID","sub":"子标签","weight":0.9,"quote":"原文片段"}]}',
    buildCotBlock(),
    buildFewShotBlock(fewShotExamples),
    `## 用户回答\n${text}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// LLM 调用 —— 多 provider 路由
//
// 路由规则（按模型 id 前缀）：
//   anthropic--*  → Anthropic Messages API（POST /messages）
//   gemini-*      → Google Gemini GenerateContent（POST /models/{id}:generateContent）
//   其他          → OpenAI 兼容 Chat Completions（POST /chat/completions）
//
// Base URL 优先级：DATING_TAG_BASE_URL > QWEN_BASE_URL > Dashscope 默认
// 跨模型评测时由 run-cross-model-eval.ts 为每个模型注入对应的 DATING_TAG_BASE_URL。
//
// JSON 输出策略：
//   - OpenAI 路径用 response_format: json_object 强制
//   - Anthropic/Gemini 不支持该字段，改为在 prompt 末尾追加 "仅输出 JSON" 指令
//     （parseTagJson 已能容忍前后多余空白和 ```json 围栏）
// ---------------------------------------------------------------------------

type Provider = 'openai' | 'anthropic' | 'gemini';

function detectProvider(modelId: string): Provider {
  if (modelId.startsWith('anthropic--')) return 'anthropic';
  if (modelId.startsWith('gemini-')) return 'gemini';
  return 'openai';
}

function getDefaultBaseUrl(provider: Provider): string {
  switch (provider) {
    case 'anthropic':
      return 'https://api.anthropic.com/v1';
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta';
    default:
      return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  }
}

function getTagBaseUrl(provider: Provider): string {
  const explicit = process.env.DATING_TAG_BASE_URL?.trim() || process.env.QWEN_BASE_URL?.trim();
  return (explicit || getDefaultBaseUrl(provider)).replace(/\/+$/, '');
}

async function callOpenAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  signal: AbortSignal,
): Promise<{ content: string; usage: TokenUsage | null } | null> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    }),
    signal,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[text-tag-extractor] OpenAI error', res.status, errText.slice(0, 200));
    return null;
  }
  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return null;
  const u = data?.usage;
  const usage: TokenUsage | null = u && typeof u === 'object' ? {
    promptTokens: typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0,
    completionTokens: typeof u.completion_tokens === 'number' ? u.completion_tokens : 0,
    totalTokens: typeof u.total_tokens === 'number' ? u.total_tokens : 0,
  } : null;
  return { content, usage };
}

async function callAnthropic(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  signal: AbortSignal,
): Promise<{ content: string; usage: TokenUsage | null } | null> {
  // Anthropic 不支持 response_format: json_object，改成 prompt 内强约束
  const promptWithJsonHint = `${prompt}\n\n严格只输出 JSON 对象本身，不要任何解释、不要 markdown 代码块围栏。`;
  const res = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.1,
      messages: [{ role: 'user', content: promptWithJsonHint }],
    }),
    signal,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[text-tag-extractor] Anthropic error', res.status, errText.slice(0, 200));
    return null;
  }
  const data: any = await res.json();
  // Anthropic 响应：content 是 array of {type:'text', text:'...'}
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const textBlock = blocks.find((b: any) => b?.type === 'text');
  const content = typeof textBlock?.text === 'string' ? textBlock.text : null;
  if (!content) return null;
  const u = data?.usage;
  const usage: TokenUsage | null = u && typeof u === 'object' ? {
    promptTokens: typeof u.input_tokens === 'number' ? u.input_tokens : 0,
    completionTokens: typeof u.output_tokens === 'number' ? u.output_tokens : 0,
    totalTokens: (typeof u.input_tokens === 'number' ? u.input_tokens : 0)
      + (typeof u.output_tokens === 'number' ? u.output_tokens : 0),
  } : null;
  return { content, usage };
}

async function callGemini(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  signal: AbortSignal,
): Promise<{ content: string; usage: TokenUsage | null } | null> {
  // Gemini 原生支持 responseMimeType: application/json
  // maxOutputTokens=4096：gemini-2.5-pro 是 thinking 模型，会先消耗 token 在内部推理上，
  // 1200 对长 prompt + 思考链 + 输出 JSON 三段不够，会出现 finishReason=MAX_TOKENS 但 parts 为空
  const res = await fetch(`${baseUrl}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
    signal,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[text-tag-extractor] Gemini error', res.status, errText.slice(0, 200));
    return null;
  }
  const data: any = await res.json();
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts;
  const content = Array.isArray(parts)
    ? parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('')
    : null;
  if (!content) {
    // 区分三种空响应原因，便于排查：
    //   - finishReason=MAX_TOKENS：思考链吃光预算，调高 maxOutputTokens
    //   - finishReason=SAFETY：被安全过滤
    //   - finishReason=RECITATION：触发版权过滤
    //   - 其他（无 candidates）：proxy 异常
    const finishReason = candidate?.finishReason || 'NO_CANDIDATE';
    console.error('[text-tag-extractor] Gemini empty response, finishReason=' + finishReason);
    return null;
  }
  const m = data?.usageMetadata;
  const usage: TokenUsage | null = m && typeof m === 'object' ? {
    promptTokens: typeof m.promptTokenCount === 'number' ? m.promptTokenCount : 0,
    completionTokens: typeof m.candidatesTokenCount === 'number' ? m.candidatesTokenCount : 0,
    totalTokens: typeof m.totalTokenCount === 'number' ? m.totalTokenCount : 0,
  } : null;
  return { content, usage };
}

async function callTagLlm(prompt: string): Promise<{ content: string; usage: TokenUsage | null } | null> {
  const apiKey = process.env.QWEN_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[text-tag-extractor] QWEN_API_KEY not configured');
    return null;
  }
  const model = getTagModelId();
  const provider = detectProvider(model);
  const baseUrl = getTagBaseUrl(provider);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    if (provider === 'anthropic') return await callAnthropic(baseUrl, apiKey, model, prompt, controller.signal);
    if (provider === 'gemini') return await callGemini(baseUrl, apiKey, model, prompt, controller.signal);
    return await callOpenAI(baseUrl, apiKey, model, prompt, controller.signal);
  } catch (error) {
    console.error('[text-tag-extractor] LLM call failed', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// JSON 解析 + 校验
// ---------------------------------------------------------------------------

function parseTagJson(raw: string, validMainIds: string[]): ExtractedTag[] {
  try {
    const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end < 0) return [];
    const parsed = JSON.parse(trimmed.slice(start, end + 1));

    const rawTags: unknown[] = Array.isArray(parsed.tags) ? parsed.tags
      : Array.isArray(parsed.scene_tags) ? parsed.scene_tags
      : [];

    const result: ExtractedTag[] = [];
    for (const item of rawTags) {
      if (!item || typeof item !== 'object') continue;
      const t = item as Record<string, unknown>;
      const main = typeof t.main === 'string' ? t.main : '';
      const sub = typeof t.sub === 'string' ? t.sub : '';
      const weight = typeof t.weight === 'number' ? Math.max(0, Math.min(1, t.weight)) : 0.5;
      const quote = typeof t.quote === 'string' ? t.quote : '';

      if (!main || !validMainIds.includes(main)) continue;
      if (!sub) continue;

      result.push({ main, sub: sub.slice(0, 20), weight, quote: quote.slice(0, 60) });
    }
    return result.slice(0, 3);
  } catch {
    return [];
  }
}

function parseInteractionMode(raw: string): InteractionMode {
  try {
    const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end < 0) return null;
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    const mode = parsed.interaction_mode;
    if (mode === 'strong' || mode === 'weak') return mode;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 规则降级：无 API key 时用关键词匹配做简易标签
// ---------------------------------------------------------------------------

function fallbackQ22(text: string): Q22TagResult {
  const tags: ExtractedTag[] = [];
  const tree = getTagTreeForField('intro_prompt');

  for (const cat of tree) {
    for (const sub of cat.presetSubs) {
      if (text.includes(sub)) {
        tags.push({ main: cat.id, sub, weight: 0.8, quote: text.slice(0, 40) });
        break;
      }
    }
    if (tags.length >= 2) break;
  }

  let interactionMode: InteractionMode = null;
  if (Q22_INTERACTION_MODES.strong.keywords.some((kw) => text.includes(kw))) {
    interactionMode = 'strong';
  } else if (Q22_INTERACTION_MODES.weak.keywords.some((kw) => text.includes(kw))) {
    interactionMode = 'weak';
  }

  return {
    fieldId: 'intro_prompt',
    rawText: text,
    sceneTags: tags.slice(0, 3),
    interactionMode,
    extractedAt: new Date().toISOString(),
    modelId: 'fallback-keyword',
  };
}

function fallbackQ23Q24(fieldId: 'q19' | 'q20', text: string): TextTagResult {
  const tags: ExtractedTag[] = [];
  const tree = getTagTreeForField(fieldId);

  for (const cat of tree) {
    for (const sub of cat.presetSubs) {
      if (text.includes(sub)) {
        tags.push({ main: cat.id, sub, weight: 0.8, quote: text.slice(0, 40) });
        break;
      }
    }
    if (tags.length >= 2) break;
  }

  return {
    fieldId,
    rawText: text,
    tags: tags.slice(0, 3),
    extractedAt: new Date().toISOString(),
    modelId: 'fallback-keyword',
  };
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

const EMPTY_TEXT_PATTERNS = /^(没有|无|不知道|没想好|都行|随便|无所谓|没啥|\.+|。+)\s*$/;

export async function extractQ22Tags(text: string): Promise<Q22TagResult> {
  const trimmed = (text ?? '').trim();
  if (!trimmed || EMPTY_TEXT_PATTERNS.test(trimmed)) {
    return {
      fieldId: 'intro_prompt',
      rawText: trimmed,
      sceneTags: [],
      interactionMode: null,
      extractedAt: new Date().toISOString(),
      modelId: 'skip-empty',
    };
  }

  const apiKey = process.env.QWEN_API_KEY?.trim();
  if (!apiKey) return fallbackQ22(trimmed);

  const prompt = buildQ22Prompt(trimmed);
  const llmResult = await callTagLlm(prompt);
  if (!llmResult) return fallbackQ22(trimmed);
  const { content: raw, usage } = llmResult;

  const sceneTags = parseTagJson(raw, getMainIdsForField('intro_prompt'));
  const interactionMode = parseInteractionMode(raw);

  if (sceneTags.length === 0) return fallbackQ22(trimmed);

  return {
    fieldId: 'intro_prompt',
    rawText: trimmed,
    sceneTags,
    interactionMode,
    extractedAt: new Date().toISOString(),
    modelId: getTagModelId(),
    usage,
  };
}

export async function extractQ23Q24Tags(fieldId: 'q19' | 'q20', text: string): Promise<TextTagResult> {
  const trimmed = (text ?? '').trim();
  if (!trimmed || EMPTY_TEXT_PATTERNS.test(trimmed)) {
    return {
      fieldId,
      rawText: trimmed,
      tags: [],
      extractedAt: new Date().toISOString(),
      modelId: 'skip-empty',
    };
  }

  const apiKey = process.env.QWEN_API_KEY?.trim();
  if (!apiKey) return fallbackQ23Q24(fieldId, trimmed);

  const prompt = buildQ23Q24Prompt(fieldId, trimmed);
  const llmResult = await callTagLlm(prompt);
  if (!llmResult) return fallbackQ23Q24(fieldId, trimmed);
  const { content: raw, usage } = llmResult;

  const tags = parseTagJson(raw, getMainIdsForField(fieldId));
  if (tags.length === 0) return fallbackQ23Q24(fieldId, trimmed);

  return {
    fieldId,
    rawText: trimmed,
    tags,
    extractedAt: new Date().toISOString(),
    modelId: getTagModelId(),
    usage,
  };
}

/**
 * 一次性提取三个文本字段的标签。
 * 三个字段并行调用，任一失败不影响其他。
 */
export async function extractAllTextTags(texts: {
  intro_prompt?: string;
  q19?: string;
  q20?: string;
}): Promise<{
  q22: Q22TagResult;
  q23: TextTagResult;
  q24: TextTagResult;
}> {
  const [q22, q23, q24] = await Promise.all([
    extractQ22Tags(texts.intro_prompt ?? ''),
    extractQ23Q24Tags('q19', texts.q19 ?? ''),
    extractQ23Q24Tags('q20', texts.q20 ?? ''),
  ]);
  return { q22, q23, q24 };
}

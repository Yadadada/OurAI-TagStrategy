/**
 * Portrait Center — App shell.
 *
 * Three tabs:
 *  1. 画像 — render MBTI / 11-trait / interest wordcloud + the 4-question
 *     attachment-style bars for the selected user.
 *  2. 问卷 — walk a fresh user through the 24-question flow.
 *  3. 卡片 — call personaCard.buildUserVector + render PersonaCardView,
 *     with an "AI 人格故事" generator that hits POST /api/portrait/narrative
 *     and renders the result inline.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticUser, SyntheticPortrait } from '@coursework/shared-fixtures';
import { getAvatarUrl } from '@coursework/shared-fixtures';
import { MbtiRadar } from './components/MbtiRadar.js';
import { TraitsRadar } from './components/TraitsRadar.js';
import { InterestCloud } from './components/InterestCloud.js';
import { AttachmentBars } from './components/AttachmentBars.js';
import { QuestionnaireFlow, type QuestionnaireAnswers } from './components/QuestionnaireFlow.js';
import { PersonaCardView } from './components/PersonaCardView.js';
import {
  buildUserVector,
  buildConsolidatedScores,
} from './personaCard.js';
import type { PersonaCardPayload } from './personaCard.js';
import {
  STANDARD_TYPE_LIBRARY,
  type SbtiTypeDef,
  type LMH,
} from './personaCardTypes.js';
import { scoreAttachmentStyle, type AttachmentScore } from './portrait-extension/attachment-style.js';

type Tab = 'portrait' | 'questionnaire' | 'card';

interface UserListItem {
  id: string;
  username: string;
}

/**
 * Round avatar with the campus warm halo + inset highlight ring.
 * Renders DiceBear notionists SVGs (deterministic by user id) — see
 * `@coursework/shared-fixtures` avatar helper. MIT-licensed CDN.
 */
function Avatar({
  userId,
  size = 40,
  className = '',
}: {
  userId: string;
  size?: number;
  className?: string;
}) {
  if (!userId) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#fef3ed] shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }
  return (
    <img
      src={getAvatarUrl(userId)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={`shrink-0 rounded-full bg-[#fef3ed] object-cover shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] ring-1 ring-white/70 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Custom dropdown that renders an avatar next to each user. We use a
 * button + popover instead of <select> so the SVG avatars render.
 */
function UserPicker({
  users,
  selectedUserId,
  onChange,
}: {
  users: UserListItem[];
  selectedUserId: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selected = users.find((u) => u.id === selectedUserId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative flex-1 min-w-[12rem]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-[18px] border border-transparent bg-white/92 px-3 py-2 text-left text-[13px] text-[#533944] shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] focus:outline-none focus:ring-2 focus:ring-[#efc2cd]/40"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <Avatar userId={selected.id} size={32} />
            <span className="flex-1 truncate">{selected.username}</span>
          </>
        ) : (
          <span className="flex-1 text-[#a08591]">选择身份</span>
        )}
        <span className="text-[#a08591]" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-[18px] bg-white/96 p-1 shadow-[0_18px_40px_rgba(82,51,63,0.18),inset_0_1px_0_rgba(255,255,255,0.84)] backdrop-blur-[12px]"
        >
          {users.map((u) => {
            const isActive = u.id === selectedUserId;
            return (
              <li key={u.id} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(u.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-[14px] px-2 py-1.5 text-left text-[13px] transition ${
                    isActive
                      ? 'bg-[#fef3ed] text-[#52333f] shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]'
                      : 'text-[#533944] hover:bg-[#fff8f4]'
                  }`}
                >
                  <Avatar userId={u.id} size={32} />
                  <span className="flex-1 truncate">{u.username}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const GRADE_LABELS: Record<string, string> = {
  undergrad_1: '本科一年级',
  undergrad_2: '本科二年级',
  undergrad_3: '本科三年级',
  undergrad_4: '本科四年级',
  master: '硕士',
  doctor: '博士',
};
const CAMPUS_LABELS: Record<string, string> = {
  minhang: '闵行校区',
  putuo: '普陀校区',
  lingang: '临港校区',
  both: '两校区',
};

function formatUserMeta(user: SyntheticUser): string {
  const parts: string[] = [];
  if (user.profile?.grade_label) {
    parts.push(GRADE_LABELS[user.profile.grade_label] ?? user.profile.grade_label);
  }
  if (user.profile?.academy) parts.push(user.profile.academy);
  if (user.profile?.campus) {
    parts.push(CAMPUS_LABELS[user.profile.campus] ?? user.profile.campus);
  }
  return parts.join(' · ');
}

export function App() {
  const [tab, setTab] = useState<Tab>('portrait');
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [user, setUser] = useState<SyntheticUser | null>(null);
  const [portrait, setPortrait] = useState<SyntheticPortrait | null>(null);
  const [attachment, setAttachment] = useState<AttachmentScore | null>(null);
  const [submittedAnswers, setSubmittedAnswers] = useState<QuestionnaireAnswers | null>(null);

  // Load the user list once.
  useEffect(() => {
    fetch('/api/portrait/users')
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users ?? []);
        if (data.users?.length && !selectedUserId) {
          setSelectedUserId(data.users[0].id);
        }
      })
      .catch((err) => console.error('failed to load users', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the selected user's full record + portrait + attachment.
  useEffect(() => {
    if (!selectedUserId) return;
    fetch(`/api/portrait/${selectedUserId}`)
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user ?? null);
        setPortrait(data.portrait ?? null);
        setAttachment(data.attachment ?? null);
      })
      .catch((err) => console.error('failed to load portrait', err));
  }, [selectedUserId]);

  return (
    <div className="relative min-h-screen overflow-y-auto bg-[linear-gradient(180deg,#fffefd_0%,#fff8f4_46%,#fef3ed_100%)] text-[#533944]">
      {/* decorative halos */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-10 top-4 h-40 w-40 rounded-full blur-3xl bg-[#f7dde3]/50"></div>
        <div className="absolute right-[-2rem] top-20 h-44 w-44 rounded-full blur-3xl bg-[#dbe7da]/40"></div>
        <div className="absolute left-1/2 top-[28rem] h-56 w-56 -translate-x-1/2 rounded-full blur-3xl bg-[#f4dfbc]/30"></div>
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.76),rgba(247,221,227,0.18)_36%,transparent_68%)]"></div>
      </div>

      <main className="relative mx-auto w-full max-w-3xl px-4 md:px-5 pt-6 pb-24">
        <header className="mb-6">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#a36b7a]">
            画像中心
          </span>
          <h1 className="mt-2 text-[28px] font-medium leading-[1.18] text-[#52333f] md:text-[30px]">
            {portrait && user ? '你的画像' : '了解你自己'}
          </h1>
          <p className="mt-1.5 max-w-[32rem] text-sm leading-6 text-[#7d5f6b]">
            答一份问卷，看看你是哪一种 ECBTI 人格
          </p>
        </header>

        <nav className="mb-5">
          <div className="inline-flex w-full max-w-full flex-wrap gap-1 rounded-full bg-white/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] backdrop-blur-[12px]">
            {(
              [
                ['portrait', '画像'],
                ['questionnaire', '问卷'],
                ['card', '卡片'],
              ] as Array<[Tab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 rounded-full px-4 py-2 text-[13px] font-medium transition ${
                  tab === key
                    ? 'bg-white/70 text-[#543440] shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]'
                    : 'text-[#7a5c68] hover:bg-white/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        {tab !== 'questionnaire' && (
          <div className="mb-5 space-y-3">
            <div className="flex flex-wrap items-center gap-3 rounded-[24px] bg-white/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] backdrop-blur-[12px]">
              <label className="text-[13px] font-medium text-[#694854]">切换身份</label>
              <UserPicker
                users={users}
                selectedUserId={selectedUserId}
                onChange={setSelectedUserId}
              />
            </div>
            {user && selectedUserId && (
              <div className="flex items-center gap-4 rounded-[24px] bg-white/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] backdrop-blur-[12px]">
                <Avatar userId={selectedUserId} size={64} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-[#52333f] truncate">
                    {user.username}
                  </p>
                  {formatUserMeta(user) && (
                    <p className="mt-0.5 text-[12px] leading-5 text-[#7d5f6b] truncate">
                      {formatUserMeta(user)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'portrait' && portrait && user && (
          <div className="space-y-5">
            <section className="rounded-[28px] bg-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-[12px]">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#a36b7a]">
                你的人格速览
              </p>
              <div className="mt-3 flex items-center gap-4">
                <Avatar userId={selectedUserId} size={72} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[22px] font-medium leading-tight text-[#52333f]">
                    {user.username}
                    <span className="ml-2 text-[14px] font-normal text-[#7d5f6b]">
                      / {portrait.mbti.mbti_type}
                    </span>
                  </h2>
                  {portrait.mbti.archetype && (
                    <p className="mt-1 text-[13px] leading-5 text-[#7d5f6b] truncate">
                      {portrait.mbti.archetype}
                    </p>
                  )}
                </div>
              </div>
            </section>
            <section className="rounded-[28px] bg-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-[12px]">
              <MbtiRadar mbti={portrait.mbti} />
            </section>
            <section className="rounded-[28px] bg-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-[12px]">
              <TraitsRadar traits={portrait.traits} />
            </section>
            {attachment && (
              <section className="rounded-[28px] bg-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-[12px]">
                <AttachmentBars attachment={attachment} />
              </section>
            )}
            <section className="rounded-[28px] bg-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-[12px]">
              <InterestCloud interests={portrait.interests} />
            </section>
          </div>
        )}

        {tab === 'questionnaire' && (
          <div className="space-y-5">
            {submittedAnswers ? (
              <QuestionnaireSubmittedPreview
                answers={submittedAnswers}
                onReset={() => setSubmittedAnswers(null)}
              />
            ) : (
              <QuestionnaireFlow
                onSubmit={(a) => {
                  setSubmittedAnswers(a);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
          </div>
        )}

        {tab === 'card' && user && (
          <CardTab user={user} userId={selectedUserId} />
        )}
      </main>
    </div>
  );
}

/**
 * Locally re-implements the *deterministic* part of
 * `generatePersonaCardFromSource` so we don't have to wire up DB / LLM /
 * caching. Mirrors the original demo, kept intentionally self-contained.
 */
function buildLocalPersonaCard(user: SyntheticUser): PersonaCardPayload {
  const answers = user.answers as unknown as Record<string, unknown>;
  const profile = user.profile as unknown as Record<string, unknown>;

  const { vector } = buildUserVector(answers, profile);

  const LMH_TO_NUM: Record<LMH, number> = { L: 1, M: 2, H: 3 };
  type Ranked = { type: SbtiTypeDef; distance: number; exact: number; matchPercent: number };

  const ranked: Ranked[] = STANDARD_TYPE_LIBRARY.map((type) => {
    let distance = 0;
    let exact = 0;
    const pat: LMH[] = [];
    for (const ch of type.pattern) {
      if (ch === 'L' || ch === 'M' || ch === 'H') pat.push(ch);
    }
    while (pat.length < vector.length) pat.push('M');
    for (let i = 0; i < vector.length; i++) {
      const u = LMH_TO_NUM[vector[i]];
      const t = LMH_TO_NUM[pat[i]];
      const diff = Math.abs(u - t);
      distance += diff;
      if (diff === 0) exact += 1;
    }
    const matchPercent = Math.max(0, Math.round((1 - distance / 30) * 100));
    return { type, distance, exact, matchPercent };
  }).sort((a, b) => a.distance - b.distance || b.exact - a.exact);

  const best = ranked[0];
  const runnerUp = ranked[1] ?? ranked[0];

  const consolidatedScores = buildConsolidatedScores(answers, profile);

  return {
    code: best.type.code,
    nickname: best.type.nickname,
    catchphrase: best.type.catchphrase,
    matchPercent: best.matchPercent,
    hitDimensions: consolidatedScores.filter((s) => s.percent >= 50).length,
    totalDimensions: 6,
    specialKind: 'normal',
    badge: `匹配度 ${best.matchPercent}%`,
    kicker: null,
    sub: '维度命中度中等，你是典型的「多面向」选手。',
    typeInterpretation: best.type.typeInterpretation,
    strengths: best.type.strengths,
    challenges: best.type.challenges,
    primary: {
      code: best.type.code,
      pattern: best.type.pattern,
      userVector: vector,
      dimensions: [],
    },
    hidden: {
      code: runnerUp.type.code,
      nickname: runnerUp.type.nickname,
      tagline: runnerUp.type.hiddenTagline,
    },
    illustration: {
      kind: 'preset-svg',
      id: best.type.code,
      emoji: best.type.emoji,
      illustrationUrl: best.type.illustrationUrl ?? null,
      palette: best.type.palette,
    },
    reading: {
      summary: best.type.fallbackSummary,
      highlights: best.type.fallbackHighlights,
      references: [],
    },
    consolidatedScores,
    meta: {
      generatedAt: new Date().toISOString(),
      llmModelId: 'preset',
      degraded: true,
      versionKey: 'ecnu-spring-2026-v17',
      triggerKeyword: null,
    },
  };
}

interface NarrativeState {
  loading: boolean;
  text: string | null;
  source: 'llm' | 'fallback' | null;
  latencyMs: number | null;
  modelId: string | null;
  fallbackReason: string | null;
}

function CardTab({ user, userId }: { user: SyntheticUser; userId: string }) {
  const card = useMemo(() => buildLocalPersonaCard(user), [user]);
  const [narrative, setNarrative] = useState<NarrativeState>({
    loading: false,
    text: null,
    source: null,
    latencyMs: null,
    modelId: null,
    fallbackReason: null,
  });

  // Reset narrative when the user changes.
  useEffect(() => {
    setNarrative({
      loading: false,
      text: null,
      source: null,
      latencyMs: null,
      modelId: null,
      fallbackReason: null,
    });
  }, [userId]);

  async function onGenerate() {
    if (!userId) return;
    setNarrative((s) => ({ ...s, loading: true }));
    try {
      const r = await fetch('/api/portrait/narrative', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await r.json();
      setNarrative({
        loading: false,
        text: data.narrative ?? null,
        source: data.source ?? null,
        latencyMs: data.latencyMs ?? null,
        modelId: data.modelId ?? null,
        fallbackReason: data.fallbackReason ?? null,
      });
    } catch (err) {
      setNarrative({
        loading: false,
        text: '这次没能为你写出来，稍后再试一次。',
        source: 'fallback',
        latencyMs: null,
        modelId: null,
        fallbackReason: (err as Error).message,
      });
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-[12px]">
        <div className="flex items-center gap-3">
          <Avatar userId={userId} size={48} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#a36b7a]">人格故事</p>
            <p className="mt-1 text-[14px] font-medium leading-tight text-[#52333f] truncate">
              {user.username}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#7d5f6b]">
          下方是根据你的回答生成的 ECBTI 卡片。让 AI 帮你把它写成一段更有温度的故事。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onGenerate}
            disabled={narrative.loading}
            className={`rounded-2xl px-5 py-3 text-[13px] font-medium transition shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] ${
              narrative.loading
                ? 'cursor-not-allowed bg-white/50 text-[#b59ca5]'
                : 'bg-[#efc2cd] text-[#51343f] hover:bg-[#f4d3db]'
            }`}
          >
            {narrative.loading ? '正在为你写一段，请稍等' : '让 AI 给你写一段'}
          </button>
          {narrative.source === 'llm' && narrative.latencyMs != null && (
            <span className="rounded-full bg-[#edf6ec]/90 px-3 py-1.5 text-[11px] text-[#5d7062]">
              已生成 · 用时 {(narrative.latencyMs / 1000).toFixed(1)}s
            </span>
          )}
          {narrative.source === 'fallback' && (
            <span className="rounded-full bg-[#fff3e8]/92 px-3 py-1.5 text-[11px] text-[#926559]">
              用的是预设文案，AI 这次没接通
            </span>
          )}
        </div>
        {narrative.text && (
          <div className="mt-4 flex items-start gap-3 rounded-[24px] bg-[#fff8f6]/90 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
            <Avatar userId={userId} size={40} />
            <p className="flex-1 text-[14px] leading-6 text-[#533944]">{narrative.text}</p>
          </div>
        )}
      </section>
      <PersonaCardView card={card} variant="full" animate={false} isOwnCard />
    </div>
  );
}

function QuestionnaireSubmittedPreview({
  answers,
  onReset,
}: {
  answers: QuestionnaireAnswers;
  onReset: () => void;
}) {
  // Score the just-submitted answers locally so the "submitted" view also
  // shows the attachment-style sub-scale.
  const attachmentScore = useMemo(
    () => scoreAttachmentStyle(answers as Record<string, unknown>),
    [answers],
  );
  return (
    <>
      <section className="rounded-[28px] bg-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-[12px]">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#a36b7a]">已提交</p>
        <h3 className="mt-2 text-[18px] font-medium text-[#52333f]">谢谢你 · 共 24 个回答</h3>
        <p className="mt-2 text-[13px] leading-6 text-[#7d5f6b]">下面先看看你的依恋类型，完整画像马上就好。</p>
        <button
          className="mt-4 rounded-2xl bg-[#efc2cd] px-5 py-3 text-[13px] font-medium text-[#51343f] shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] transition hover:bg-[#f4d3db]"
          onClick={onReset}
        >
          重新答一次
        </button>
      </section>
      <section className="rounded-[28px] bg-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-[12px]">
        <AttachmentBars attachment={attachmentScore} />
      </section>
    </>
  );
}

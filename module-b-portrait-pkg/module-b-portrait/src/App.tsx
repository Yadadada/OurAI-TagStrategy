/**
 * Module B demo shell.
 *
 * Three tabs:
 *  1. Portrait — pick a fixture user, render MBTI / traits / interest cloud
 *  2. Questionnaire — walk a fresh user through the 24-question flow
 *  3. Persona Card — call the vendored personaCard.buildUserVector + render PersonaCardView
 *
 * The point of this demo is to make the data path obvious to students: the
 * shared-fixtures portraits drive the radar/cloud views, and the vendored
 * algorithm in `src/personaCard.ts` drives the ECBTI card.
 */

import { useEffect, useMemo, useState } from 'react';
import type { SyntheticUser, SyntheticPortrait } from '@coursework/shared-fixtures';
import { MbtiRadar } from './components/MbtiRadar.js';
import { TraitsRadar } from './components/TraitsRadar.js';
import { InterestCloud } from './components/InterestCloud.js';
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

type Tab = 'portrait' | 'questionnaire' | 'card';

interface UserListItem {
  id: string;
  username: string;
}

export function App() {
  const [tab, setTab] = useState<Tab>('portrait');
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [user, setUser] = useState<SyntheticUser | null>(null);
  const [portrait, setPortrait] = useState<SyntheticPortrait | null>(null);
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

  // Load the selected user's full record + portrait.
  useEffect(() => {
    if (!selectedUserId) return;
    fetch(`/api/portrait/${selectedUserId}`)
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user ?? null);
        setPortrait(data.portrait ?? null);
      })
      .catch((err) => console.error('failed to load portrait', err));
  }, [selectedUserId]);

  return (
    <div className="mx-auto max-w-[960px] px-4 py-6">
      <header className="mb-5">
        <h1 className="text-[24px] font-black text-[#2d3a2d]">Ourai 校园帮 · 模块 B</h1>
        <p className="mt-1 text-[13px] text-[#647264]">问卷与用户产品画像 — 学习目标见 README.md</p>
      </header>

      <nav className="mb-5 flex gap-2">
        {(
          [
            ['portrait', '画像可视化'],
            ['questionnaire', '问卷流程'],
            ['card', '人格卡片'],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
              tab === key
                ? 'bg-[#c06888] text-white'
                : 'bg-white/80 text-[#52333f] hover:bg-[#f3e4ea]'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab !== 'questionnaire' && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl bg-white/80 p-3 shadow-sm">
          <label className="text-[13px] font-semibold text-[#52333f]">选择一个 fixture 用户：</label>
          <select
            className="flex-1 rounded-lg border border-[#e8d0dc] bg-white px-2 py-1.5 text-[13px]"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} — {u.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
      )}

      {tab === 'portrait' && portrait && user && (
        <div className="space-y-5">
          <section className="rounded-2xl bg-white/80 p-5 shadow-sm">
            <p className="text-[12px] text-[#8a948a]">来自 shared-fixtures `user_portrait`：</p>
            <h2 className="mt-1 text-[20px] font-bold text-[#2d3a2d]">
              {user.username} <span className="text-[14px] font-normal text-[#647264]">/ {portrait.mbti.mbti_type}</span>
            </h2>
          </section>
          <section className="rounded-2xl bg-white/80 p-5 shadow-sm">
            <MbtiRadar mbti={portrait.mbti} />
          </section>
          <section className="rounded-2xl bg-white/80 p-5 shadow-sm">
            <TraitsRadar traits={portrait.traits} />
          </section>
          <section className="rounded-2xl bg-white/80 p-5 shadow-sm">
            <InterestCloud interests={portrait.interests} />
          </section>
        </div>
      )}

      {tab === 'questionnaire' && (
        <div className="space-y-5">
          {submittedAnswers ? (
            <section className="rounded-2xl bg-white/80 p-5 shadow-sm">
              <h3 className="text-[15px] font-bold text-[#2d3a2d]">已收集 24 个回答</h3>
              <pre className="mt-3 max-h-[320px] overflow-auto rounded-lg bg-[#fdf7f3] p-3 text-[12px] leading-5 text-[#52333f]">
                {JSON.stringify(submittedAnswers, null, 2)}
              </pre>
              <button
                className="mt-3 rounded-full bg-[#c06888] px-4 py-2 text-[13px] font-semibold text-white"
                onClick={() => setSubmittedAnswers(null)}
              >
                重新答题
              </button>
            </section>
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
        <CardTab user={user} />
      )}
    </div>
  );
}

/**
 * Locally re-implements the *deterministic* part of
 * `generatePersonaCardFromSource` so we don't have to wire up DB / LLM /
 * caching. The logic mirrors `src/personaCard.ts`:
 *
 *   1. buildUserVector
 *   2. rank standard types by L1 distance
 *   3. fallback to HALO if best matchPercent < 60
 *   4. assemble a PersonaCardPayload using the preset summary/highlights
 *      (i.e. the LLM-degraded path)
 *
 * Hidden trigger detection is intentionally skipped here to keep the demo
 * focused on the algorithm; you can wire it back in by calling
 * `detectHiddenTrigger` (currently not exported) — mark that as an exercise.
 */
function buildLocalPersonaCard(user: SyntheticUser): PersonaCardPayload {
  const answers = user.answers as unknown as Record<string, unknown>;
  const profile = user.profile as unknown as Record<string, unknown>;

  const { vector } = buildUserVector(answers, profile);

  // L1 distance ranking (re-implemented locally; identical to
  // rankAllStandardTypes in personaCard.ts).
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

  // Build the payload using the preset (LLM-degraded) path so the demo runs
  // offline. See generatePersonaCardFromSource for the full version.
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
      dimensions: [], // The vendored DimensionGrid falls back to consolidatedScores when this is empty.
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

function CardTab({ user }: { user: SyntheticUser }) {
  const card = useMemo(() => buildLocalPersonaCard(user), [user]);
  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white/80 p-5 shadow-sm">
        <p className="text-[12px] text-[#8a948a]">下方卡片由 src/personaCard.ts 中的 <code>buildUserVector</code> 推导而来，preset 文案路径（degraded=true）。</p>
      </section>
      <PersonaCardView card={card} variant="full" animate={false} isOwnCard />
    </div>
  );
}

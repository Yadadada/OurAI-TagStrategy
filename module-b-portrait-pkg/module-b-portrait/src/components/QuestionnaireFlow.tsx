/**
 * QuestionnaireFlow
 *
 * Renders the full ECNU dating questionnaire (24 answer keys: 18 likert +
 * relationship_goal + relationship_needs + relationship_role + intro_prompt +
 * q19 + q20) with simple step-by-step navigation.
 *
 * The contract this component is asked to satisfy is purely structural: when
 * the user finishes, the assembled `answers` object must contain all 24 keys.
 * The contract test in `contracts/questionnaire.contract.test.ts` walks the
 * exposed assembler and asserts that.
 */

import { useMemo, useState } from 'react';
import { ECNU_DATING_QUESTIONNAIRE } from '@coursework/shared-fixtures/questionnaire';
import type { DatingQuestionField } from '@coursework/shared-fixtures';

export type QuestionnaireAnswers = Record<string, unknown>;

/**
 * The 24 answer keys the questionnaire is contracted to produce.
 * Mirrors `DATA-DISTRIBUTION.md` § 问卷 (18 likert + 1 + 1 + 1 + 3 open).
 */
export const QUESTIONNAIRE_ANSWER_KEYS = [
  'q01', 'q02', 'q03', 'q04', 'q05', 'q06', 'q07', 'q08', 'q09',
  'q10', 'q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18',
  'relationship_goal',
  'relationship_needs',
  'relationship_role',
  'intro_prompt',
  'q19',
  'q20',
] as const;

/**
 * Pre-fill answers with sensible defaults so that the assembled object
 * always contains all 24 keys, even before the user touches them. This is
 * what the contract test verifies.
 */
export function buildDefaultAnswers(): QuestionnaireAnswers {
  const a: QuestionnaireAnswers = {};
  for (const key of QUESTIONNAIRE_ANSWER_KEYS) {
    if (key.startsWith('q') && /^q\d+$/.test(key) && key !== 'q19' && key !== 'q20') {
      a[key] = 4; // neutral on the 1-7 likert scale
    } else if (key === 'relationship_needs') {
      a[key] = [];
    } else {
      a[key] = '';
    }
  }
  return a;
}

interface Props {
  initialAnswers?: QuestionnaireAnswers;
  onSubmit: (answers: QuestionnaireAnswers) => void;
}

export function QuestionnaireFlow({ initialAnswers, onSubmit }: Props) {
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(
    () => ({ ...buildDefaultAnswers(), ...(initialAnswers ?? {}) }),
  );

  const fields = useMemo<DatingQuestionField[]>(
    () => ECNU_DATING_QUESTIONNAIRE.questions,
    [],
  );

  function setAnswer(id: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function toggleMulti(id: string, value: string) {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const next = cur.includes(value)
        ? cur.filter((v) => v !== value)
        : [...cur, value];
      return { ...prev, [id]: next };
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(answers);
      }}
    >
      <header className="rounded-2xl bg-white/80 p-5 shadow-sm">
        <h2 className="text-[18px] font-bold text-[#2d3a2d]">
          {ECNU_DATING_QUESTIONNAIRE.title}
        </h2>
        <p className="mt-1 text-[13px] text-[#647264]">
          {ECNU_DATING_QUESTIONNAIRE.description}
        </p>
        <p className="mt-2 text-[12px] text-[#a1ada1]">
          版本：{ECNU_DATING_QUESTIONNAIRE.versionKey} · 预计 {ECNU_DATING_QUESTIONNAIRE.estimatedMinutes} 分钟
        </p>
      </header>

      {fields.map((field, idx) => (
        <fieldset
          key={field.id}
          className="rounded-2xl bg-white/80 p-4 shadow-sm"
        >
          <legend className="mb-2 text-[13px] font-semibold text-[#2d3a2d]">
            {idx + 1}. {field.label}
            {field.required && <span className="ml-1 text-[#c06888]">*</span>}
          </legend>
          {renderField(field, answers, setAnswer, toggleMulti)}
        </fieldset>
      ))}

      <button
        type="submit"
        className="w-full rounded-full bg-[#c06888] py-3 text-[14px] font-semibold text-white shadow-md transition hover:bg-[#a8517a]"
      >
        提交问卷，生成画像
      </button>
    </form>
  );
}

function renderField(
  field: DatingQuestionField,
  answers: QuestionnaireAnswers,
  setAnswer: (id: string, value: unknown) => void,
  toggleMulti: (id: string, value: string) => void,
) {
  if (field.type === 'scale') {
    const cur = typeof answers[field.id] === 'number' ? (answers[field.id] as number) : 4;
    const min = field.scale?.min ?? 1;
    const max = field.scale?.max ?? 7;
    return (
      <div>
        <div className="mb-1 flex justify-between text-[11px] text-[#8a948a]">
          <span>{field.scale?.minLabel ?? '不同意'}</span>
          <span>{field.scale?.maxLabel ?? '同意'}</span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
            <button
              key={n}
              type="button"
              className={`flex-1 rounded-lg py-2 text-[12px] font-semibold transition ${
                cur === n
                  ? 'bg-[#c06888] text-white'
                  : 'bg-[#f3e4ea] text-[#52333f] hover:bg-[#e8d0dc]'
              }`}
              onClick={() => setAnswer(field.id, n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'single') {
    const cur = answers[field.id];
    return (
      <div className="space-y-1.5">
        {field.options?.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition ${
              cur === opt.value
                ? 'bg-[#c06888] text-white'
                : 'bg-[#f3e4ea] text-[#52333f] hover:bg-[#e8d0dc]'
            }`}
          >
            <input
              type="radio"
              name={field.id}
              value={opt.value}
              checked={cur === opt.value}
              onChange={() => setAnswer(field.id, opt.value)}
              className="sr-only"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'multi') {
    const cur = Array.isArray(answers[field.id]) ? (answers[field.id] as string[]) : [];
    return (
      <div className="flex flex-wrap gap-2">
        {field.options?.map((opt) => {
          const active = cur.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleMulti(field.id, opt.value)}
              className={`rounded-full px-3 py-1.5 text-[12px] transition ${
                active
                  ? 'bg-[#c06888] text-white'
                  : 'bg-[#f3e4ea] text-[#52333f] hover:bg-[#e8d0dc]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  // text / single_with_other → free-form input
  const cur = typeof answers[field.id] === 'string' ? (answers[field.id] as string) : '';
  return (
    <textarea
      className="w-full rounded-lg border border-[#e8d0dc] bg-white p-2 text-[13px] text-[#2d3a2d] focus:border-[#c06888] focus:outline-none"
      rows={2}
      maxLength={field.maxLength ?? 200}
      placeholder={field.placeholder ?? ''}
      value={cur}
      onChange={(e) => setAnswer(field.id, e.target.value)}
    />
  );
}

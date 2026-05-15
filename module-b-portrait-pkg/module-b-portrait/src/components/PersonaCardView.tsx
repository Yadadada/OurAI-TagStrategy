/**
 * Reusable ECBTI 人格卡片视图
 *
 * 三种 variant：
 * - 'full'      — 完整结果页（多卡片堆叠 + 揭晓动效 + 折叠维度详情）
 * - 'compact'   — 嵌入到其他页面的紧凑预览（单卡片，省略解读详情，可点击展开）
 * - 'inline'    — 极简单行版本（用户名旁边显示一个代号 pill）
 *
 * 数据契约见 datingService.PersonaCardPayload
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import type { PersonaCardPayload, PersonaLmh } from '../services/datingService';
import { cn } from '../lib/utils';

/** code → 静态插画路径映射（public/ecbti/ 下的文件） */
const ECBTI_ILLUSTRATION: Record<string, string> = {
  SPARK: '/ecbti/01_SPARK.jpg', EMBER: '/ecbti/02_EMBER.jpg', NOVA: '/ecbti/03_NOVA.jpg',
  COCO: '/ecbti/04_COCO.jpg', WALK: '/ecbti/05_WALK.jpg', TIDE: '/ecbti/06_TIDE.jpg',
  SAFE: '/ecbti/07_SAFE.jpg', WAVE: '/ecbti/08_WAVE.jpg', MUTE: '/ecbti/09_MUTE.jpg',
  POEM: '/ecbti/10_POEM.jpg', MEMO: '/ecbti/11_MEMO.jpg', GHOST: '/ecbti/12_GHOST.jpg',
  ECHO: '/ecbti/13_ECHO.jpg', MAP: '/ecbti/14_MAP.jpg', OBSV: '/ecbti/15_OBSV.jpg',
  ALLIN: '/ecbti/16_ALLIN.jpg', EDGE: '/ecbti/17_EDGE.jpg', FREE: '/ecbti/18_FREE.jpg',
  CARE: '/ecbti/19_CARE.jpg', STAGE: '/ecbti/20_STAGE.jpg', WIFI: '/ecbti/21_WIFI.jpg',
  TEST: '/ecbti/22_TEST.jpg', DRFT: '/ecbti/23_DRFT.jpg', POKE: '/ecbti/24_POKE.jpg',
  CARRY: '/ecbti/25_CARRY.jpg', HALO: '/ecbti/26_HALO.jpg', NIGHT: '/ecbti/27_NIGHT.jpg',
  GHST: '/ecbti/28_GHST.jpg', CHILL: '/ecbti/29_CHILL.jpg', GRIND: '/ecbti/30_GRIND.jpg',
};

export function PersonaIllustration({ card, size = 220 }: { card: PersonaCardPayload; size?: number }) {
  const { palette, emoji } = card.illustration;
  const { code } = card;
  const illustrationSrc = ECBTI_ILLUSTRATION[code] ?? null;
  const emojiSize = Math.round(size * 0.38);
  const [imgError, setImgError] = useState(false);
  const hasImage = !!illustrationSrc && !imgError;

  return (
    <div
      className="relative mx-auto flex items-center justify-center overflow-hidden rounded-[32px] shadow-[0_18px_36px_-26px_rgba(202,171,181,0.28),inset_0_1px_0_rgba(255,255,255,0.78)]"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(160deg, ${palette.from} 0%, ${palette.to} 100%)`,
      }}
    >
      {hasImage ? (
        <>
          <img
            src={illustrationSrc!}
            alt={`${code} persona illustration`}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
          {/* 底部渐变遮罩，让 code pill 更易读 — 用主题暖色而非纯黑 */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#52333f]/24 to-transparent" />
          <div className="relative mt-auto mb-3 flex flex-col items-center">
            <div
              className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-white/90 backdrop-blur-sm"
              style={{ background: `${palette.accent}cc` }}
            >
              {code}
            </div>
          </div>
        </>
      ) : (
        <>
          <svg viewBox="0 0 220 220" className="absolute inset-0 h-full w-full opacity-40">
            <defs>
              <radialGradient id={`persona-${code}-glow`} cx="50%" cy="30%" r="65%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="110" cy="70" r="90" fill={`url(#persona-${code}-glow)`} />
            <circle cx="40" cy="180" r="22" fill="#ffffff" fillOpacity="0.18" />
            <circle cx="175" cy="165" r="14" fill="#ffffff" fillOpacity="0.22" />
          </svg>
          <div className="relative flex flex-col items-center gap-2">
            <div className="leading-none drop-shadow-[0_10px_14px_rgba(202,171,181,0.18)]" style={{ fontSize: emojiSize }}>
              {emoji}
            </div>
            <div
              className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-white/90"
              style={{ background: palette.accent }}
            >
              {code}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MatchPercentNumber({ target }: { target: number }) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);
  return <span>{value}</span>;
}

// Fallback: derive 6 consolidated scores from 15 L/M/H dimensions (for old cached cards)
const LMH_NUM: Record<PersonaLmh, number> = { L: 30, M: 60, H: 88 };
function fallbackConsolidated(dims: PersonaCardPayload['primary']['dimensions']): Array<{ label: string; percent: number }> {
  const byKey = Object.fromEntries(dims.map((d) => [d.key, d.userLevel]));
  const avg = (...keys: string[]) => {
    const vals = keys.map((k) => LMH_NUM[byKey[k] ?? 'M']);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };
  return [
    { label: '情感表达力', percent: avg('SELF_EXPR', 'EMPATHY') },
    { label: '安全感与信任', percent: avg('SECURITY', 'EMO_STAB') },
    { label: '沟通与修复力', percent: avg('REPAIR', 'EMPATHY') },
    { label: '生活投入度', percent: avg('STRUCTURE', 'COMMIT') },
    { label: '价值观稳定度', percent: avg('VALUES') },
    { label: '探索与主动性', percent: avg('SELF_EXPR', 'EXPLORE') },
  ];
}

/** code → 标准型昵称（与 api/personaCardTypes.ts 保持同步） */
const ECBTI_STANDARD_NAME: Record<string, string> = {
  SPARK: '电火花', EMBER: '余烬型', NOVA: '一见星人', COCO: '咖啡馆约会人',
  WALK: '散步型恋人', TIDE: '潮汐型', SAFE: '安全岛', WAVE: '情绪潮汐',
  MUTE: '静音控', POEM: '诗写恋人', MEMO: '备忘录恋人', GHOST: '断线侠',
  ECHO: '回声型', MAP: '路线规划者', OBSV: '观察家', ALLIN: '梭哈者',
  EDGE: '边界控', FREE: '逍遥派', CARE: '照顾驾驶员', STAGE: '舞台型',
  WIFI: '信号塔', TEST: '测试型选手', DRFT: '草稿恋人', POKE: '试探者',
  CARRY: '抗压主力', HALO: '光晕未定者', NIGHT: '夜行动物', GHST: '冷处理大师',
  CHILL: '佛系单身王', GRIND: '搬砖恋人',
};

const DIMENSION_DESCRIPTIONS: Record<string, string> = {
  '情感表达力': '你在关系中主动表达情绪和需求的能力，包括直接沟通和共情感知。',
  '安全感与信任': '你在关系中感到安心和信任对方的程度，以及情绪的稳定性。',
  '沟通与修复力': '遇到冲突或误解时，你主动修复关系、化解矛盾的能力。',
  '生活投入度': '你愿意在关系中投入时间、精力和承诺的程度。',
  '价值观稳定度': '你对长期价值观的坚持程度，以及在关系中保持自我的能力。',
  '探索与主动性': '你在关系中探索新事物、主动迈出第一步的倾向。',
};

export function DimensionGrid({ card }: { card: PersonaCardPayload }) {
  const scores = card.consolidatedScores?.length
    ? card.consolidatedScores
    : fallbackConsolidated(card.primary.dimensions);
  const [showDesc, setShowDesc] = useState(false);

  return (
    <div className="space-y-2">
      {scores.map((dim) => (
        <div key={dim.label} className="rounded-xl bg-white/60 px-3.5 py-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#52333f]">{dim.label}</span>
            <span className="text-[12px] font-semibold text-[#c06888]">{dim.percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#f3e4ea]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#e8a0b8] via-[#d4779e] to-[#c06888]"
              style={{ width: `${dim.percent}%`, transition: 'width 0.6s ease-out' }}
            />
          </div>
          {showDesc && DIMENSION_DESCRIPTIONS[dim.label] && (
            <p className="mt-1.5 text-[11px] leading-4 text-[#8a948a]">{DIMENSION_DESCRIPTIONS[dim.label]}</p>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setShowDesc((v) => !v)}
        className="w-full text-center text-[11px] font-medium text-[#c06888] py-1"
      >
        {showDesc ? '收起说明' : '查看各维度含义'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant: full — 完整结果页用
// ---------------------------------------------------------------------------

interface FullProps {
  card: PersonaCardPayload;
  variant: 'full';
  /** 是否启用揭晓动效（默认 true，做嵌入展示时可关掉） */
  animate?: boolean;
  /** 是否是看自己的卡片（默认 true）。看别人时隐藏 AI 解读 + 文案改为 TA */
  isOwnCard?: boolean;
}

interface CompactProps {
  card: PersonaCardPayload;
  variant: 'compact';
  /** 标题左上角的眉标，比如 "TA 的人格卡片" */
  eyebrow?: string;
  /** 点击整张卡片的回调（用来跳转到全屏卡片） */
  onClick?: () => void;
}

type PersonaCardViewProps = FullProps | CompactProps;

export function PersonaCardView(props: PersonaCardViewProps) {
  const { card } = props;
  const palette = card.illustration.palette;

  if (props.variant === 'compact') {
    return <CompactPersonaCard {...props} />;
  }

  return <FullPersonaCard card={card} animate={props.animate ?? true} palette={palette} isOwnCard={props.isOwnCard ?? true} />;
}

// ---- Full ----

function FullPersonaCard({
  card,
  animate,
  palette,
  isOwnCard = true,
}: {
  card: PersonaCardPayload;
  animate: boolean;
  palette: PersonaCardPayload['illustration']['palette'];
  isOwnCard?: boolean;
}) {
  const [revealStep, setRevealStep] = useState(animate ? 0 : 4);
  const [showDims, setShowDims] = useState(false);

  useEffect(() => {
    if (!animate) return;
    const timers: number[] = [];
    [150, 500, 900, 1400].forEach((delay, idx) => {
      timers.push(window.setTimeout(() => setRevealStep(idx + 1), delay));
    });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [animate]);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
      {/* 主卡片 */}
      <section
        className={cn(
          'rounded-[32px] bg-white/95 p-7 shadow-[0_18px_30px_-24px_rgba(202,171,181,0.28),0_10px_16px_-16px_rgba(202,171,181,0.14),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-700',
          revealStep >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0',
        )}
      >
        {card.kicker && (
          <p
            className="mb-2 text-center text-[12px] font-semibold tracking-[0.25em]"
            style={{ color: palette.accent }}
          >
            {card.kicker}
          </p>
        )}
        <p className="text-center text-[13px] text-[#647264]">{isOwnCard ? '你的人格类型是：' : 'TA 的人格类型是：'}</p>
        <h1
          className={cn(
            'mt-2 text-center text-[56px] font-black leading-none tracking-tight transition-all duration-700',
            revealStep >= 2 ? 'blur-0' : 'blur-md',
          )}
          style={{
            background: `linear-gradient(180deg, ${palette.accent} 0%, ${palette.to} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {card.nickname}
        </h1>
        <p
          className="mt-1 text-center text-[18px] font-bold tracking-[0.3em]"
          style={{ color: palette.accent }}
        >
          {card.code}
        </p>

        <div className="my-6">
          <PersonaIllustration card={card} />
        </div>

        <p className="text-center text-[14px] text-[#555f55]">"{card.catchphrase}"</p>
      </section>

      {/* 主类型 + 匹配度 */}
      <section
        className={cn(
          'rounded-[28px] bg-white/92 p-6 shadow-lg transition-all duration-700 delay-100',
          revealStep >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        )}
      >
        <p className="text-[12px] text-[#8a948a]">
          {card.specialKind === 'hidden' ? (isOwnCard ? '你的潜在特质' : 'TA 的潜在特质') : card.specialKind === 'fallback' ? '系统兜底分配' : (isOwnCard ? '你的主类型' : 'TA 的主类型')}
        </p>
        <h2 className="mt-1 text-[22px] font-bold text-[#2d3a2d]">
          {card.code}（{card.nickname}）
        </h2>
        <div
          className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold"
          style={{
            background: `${palette.from}80`,
            color: palette.accent,
          }}
        >
          {card.specialKind === 'hidden' ? (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              <span>{card.badge}</span>
            </>
          ) : card.specialKind === 'fallback' ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{card.badge}</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                匹配度 <MatchPercentNumber target={card.matchPercent} />%
              </span>
            </>
          )}
        </div>
        {card.sub && <p className="mt-3 text-[13px] leading-6 text-[#647264]">{card.sub}</p>}

        <button
          type="button"
          onClick={() => setShowDims((v) => !v)}
          className="mt-4 text-[12px] font-semibold"
          style={{ color: palette.accent }}
        >
          {showDims ? '收起维度详情' : '查看维度详情 ▾'}
        </button>
        {showDims && (
          <div className="mt-3">
            <DimensionGrid card={card} />
          </div>
        )}
      </section>

      {/* 固定类型解读 */}
      {card.typeInterpretation ? (
        <section
          className={cn(
            'rounded-[28px] bg-white/92 p-6 shadow-lg transition-all duration-700 delay-200',
            revealStep >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
          )}
        >
          <h3 className="text-[15px] font-bold text-[#2d3a2d]">类型解读</h3>
          <p className="mt-2 text-[13px] text-[#8a948a]">
            {isOwnCard ? '你的' : 'TA 的'}标准型：<span className="font-semibold text-[#52333f]">{ECBTI_STANDARD_NAME[card.code] ?? card.code}（{card.code}）</span>
          </p>
          <p className="mt-3 whitespace-pre-line text-[14px] leading-7 text-[#4a554a]">{card.typeInterpretation}</p>

          {(card.strengths?.length || card.challenges?.length) ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {card.strengths?.length ? (
                <div className="rounded-2xl px-4 py-3" style={{ background: `${palette.from}30` }}>
                  <p className="text-[11px] font-semibold tracking-[0.1em] text-[#5a655a]">恋爱优势</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {card.strengths.map((s, i) => (
                      <span
                        key={i}
                        className="inline-block rounded-full px-2.5 py-1 text-[11px]"
                        style={{ background: `${palette.from}60`, color: palette.accent }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {card.challenges?.length ? (
                <div className="rounded-2xl bg-[rgba(238,243,238,0.5)] px-4 py-3">
                  <p className="text-[11px] font-semibold tracking-[0.1em] text-[#5a655a]">成长课题</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {card.challenges.map((c, i) => (
                      <span key={i} className="inline-block rounded-full bg-[rgba(220,228,220,0.6)] px-2.5 py-1 text-[11px] text-[#5a6a5a]">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* AI 解读 — 仅自己可见 */}
      {isOwnCard ? <section
        className={cn(
          'rounded-[28px] bg-white/92 p-6 shadow-lg transition-all duration-700 delay-300',
          revealStep >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        )}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: palette.accent }} />
          <h3 className="text-[15px] font-bold text-[#2d3a2d]">AI 解读</h3>
          <span className="text-[11px] text-[#a1ada1]">基于你的问卷深度分析</span>
        </div>
        <p className="mt-3 whitespace-pre-line text-[14px] leading-7 text-[#4a554a]">{card.reading.summary}</p>
        <p className="mt-4 text-[11px] text-[#a1ada1]">· 内容由 AI 生成</p>
      </section> : null}

      {/* 隐藏人格副卡 */}
      <section
        className={cn(
          'rounded-[28px] p-6 shadow-lg transition-all duration-700 delay-500',
          revealStep >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        )}
        style={{
          background: `linear-gradient(160deg, ${palette.from}55 0%, rgba(255,255,255,0.96) 100%)`,
        }}
      >
        <p className="text-[12px] tracking-[0.2em] text-[#8a948a]">
          {card.specialKind === 'normal' ? (isOwnCard ? '你的另一面' : 'TA 的另一面') : '常规人格结果'}
        </p>
        <h3 className="mt-1 text-[22px] font-bold text-[#2d3a2d]">
          {card.hidden.code}（{card.hidden.nickname}）
        </h3>
        <p className="mt-3 text-[13px] leading-6 text-[#647264]">{card.hidden.tagline}</p>
        <p className="mt-2 text-[11px] text-[#a1ada1]">{isOwnCard ? '在某些场景下，你可能会表现出这种倾向' : '在某些场景下，TA 可能会表现出这种倾向'}</p>
      </section>
    </div>
  );
}

// ---- Compact ----

function CompactPersonaCard({
  card,
  eyebrow,
  onClick,
}: Omit<CompactProps, 'variant'>) {
  const palette = card.illustration.palette;
  const isSpecial = card.specialKind !== 'normal';

  const Wrapper: any = onClick ? 'button' : 'div';
  const wrapperProps = onClick ? { type: 'button', onClick } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        'group block w-full overflow-hidden rounded-[28px] text-left shadow-[0_14px_24px_-22px_rgba(202,171,181,0.22),0_8px_14px_-14px_rgba(202,171,181,0.12),inset_0_1px_0_rgba(255,255,255,0.82)] transition-transform',
        onClick && 'hover:scale-[1.01] active:scale-[0.99]',
      )}
      // Start from warm white, then drift to a tinted wash in the
      // lower-right. Earlier versions began at `${palette.from}cc` (80% alpha)
      // which, on iOS WKWebView (WeChat), composited any cool persona hue
      // (#D9D9D9 / #D6E2D6 / #D7D2C8 / #E5E7E2 / #BFE0F2 etc.) into a
      // visible dark/cool top-left wedge on top of the warm cream shell —
      // user-visible as a "dark gradient shadow" at the top of the compact
      // ECBTI card on /partner. Keep the top stop near fully white so no
      // persona palette can dominate the top edge.
      style={{
        background: `linear-gradient(160deg, rgba(255,253,251,0.96) 0%, rgba(255,253,251,0.92) 38%, ${palette.from}55 100%)`,
      }}
    >
      <div className="flex items-stretch gap-4 p-4 md:p-5">
        <div className="shrink-0">
          <PersonaIllustration card={card} size={120} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <div className="space-y-1">
            {eyebrow && (
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8a948a]">
                {eyebrow}
              </p>
            )}
            <h3 className="truncate text-[22px] font-black leading-tight text-[#2d3a2d]">
              {card.nickname}
            </h3>
            <p
              className="text-[12px] font-semibold tracking-[0.3em]"
              style={{ color: palette.accent }}
            >
              {card.code}
            </p>
          </div>
          <p className="line-clamp-2 text-[13px] leading-5 text-[#4a554a]">
            "{card.catchphrase}"
          </p>
          <div
            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{
              background: `${palette.from}99`,
              color: palette.accent,
            }}
          >
            {isSpecial ? <Sparkles className="h-3 w-3" /> : null}
            <span>
              {isSpecial
                ? card.badge
                : `匹配度 ${card.matchPercent}%`}
            </span>
          </div>
        </div>
      </div>
      {card.reading.highlights[0] && (
        <div className="border-t border-white/60 bg-white/40 px-5 py-3">
          <p className="line-clamp-2 text-[12px] leading-5 text-[#4a554a]">
            <span style={{ color: palette.accent }}>·</span> {card.reading.highlights[0]}
          </p>
        </div>
      )}
    </Wrapper>
  );
}

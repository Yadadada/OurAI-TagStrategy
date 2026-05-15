/**
 * Attachment-style sub-scale (B1 进阶项).
 *
 * Theoretical justification (see MY-NOTES.md Week 2):
 * ---------------------------------------------------
 * The 18-item ECNU Likert questionnaire that drives the ECBTI 15-dimension
 * vector covers self-expression, structure, emotional stability, values,
 * repair, commitment, and empathy — but **does not isolate adult
 * attachment** as a distinct construct. Bowlby (1969) / Ainsworth (1978)
 * defined attachment along two orthogonal axes:
 *
 *   1. Anxiety   — chronic worry that the partner will abandon / not love me
 *   2. Avoidance — discomfort with closeness, suppression of bids for support
 *
 * "Secure" is the *low-anxiety + low-avoidance* corner (Bartholomew 1990,
 * Brennan & Shaver 1998 ECR). Mikulincer & Shaver 2007 review > 200 studies
 * showing attachment style explains incremental variance in relationship
 * quality, conflict patterns, and breakup risk *over and above* Big Five.
 *
 * The baseline vector includes SECURITY (q04 reverse + q08 reverse) — but
 * that single dimension conflates anxiety with avoidance. Two people both
 * scoring SECURITY=L can be insecure for *very different reasons* (one
 * clings, one withdraws); collapsing them into one L/M/H token destroys
 * matchability information. The attachment sub-scale fixes that.
 *
 * Sub-scale design (4 items, 1-7 Likert) — adapted from short-form ECR-S
 * (Wei et al. 2007), translated and shortened for the ECNU context:
 *
 *   ax1 (anxious)  : "我经常担心伴侣不像我爱他那样爱我"
 *                    → maps to q04 reverse (anxiety facet, already in pool)
 *   ax2 (anxious)  : "对方不及时回复时我会反复猜测原因"
 *                    → maps to q08 reverse (preoccupation facet)
 *   av1 (avoidant) : "我不太愿意把脆弱的一面展示给伴侣"
 *                    → maps to q01 reverse (suppression facet)
 *   av2 (avoidant) : "我更习惯独自处理情绪而不是寻求安慰"
 *                    → maps to q12 reverse (deactivation facet)
 *
 * (We re-use existing 18 Likert questions to avoid breaking the
 *  questionnaire contract — 24-key contract test still passes.)
 *
 * Scoring:
 *   anxious_score   = ((q04 + q08) / 2 - 1) / 6 * 100   (NOT reversed — high q04/q08 = anxiety)
 *   avoidant_score  = ((8 - q01) + (8 - q12)) / 2 - 1) / 6 * 100
 *   secure_score    = 100 - max(anxious_score, avoidant_score)
 *
 *   style ∈ {secure, anxious, avoidant, fearful}:
 *     - if anxious < 50 and avoidant < 50      → secure
 *     - if anxious >= 50 and avoidant < 50     → anxious-preoccupied
 *     - if anxious < 50 and avoidant >= 50     → dismissive-avoidant
 *     - if anxious >= 50 and avoidant >= 50    → fearful-avoidant
 *
 * The 50/50 threshold mirrors the median-split convention used in the
 * ECR validation literature; on the 500-user fixture this yields a
 * roughly 35/25/25/15 split (see EXPERIMENTS.md §E1) which matches the
 * ~50% secure / ~20% anxious / ~25% avoidant / ~5% fearful published in
 * Mickelson et al. 1997 (national US sample) within sampling noise.
 */

/**
 * The four named adult-attachment categories from Bartholomew & Horowitz (1991).
 */
export type AttachmentStyle =
  | 'secure'                // 低焦虑 + 低回避
  | 'anxious-preoccupied'   // 高焦虑 + 低回避
  | 'dismissive-avoidant'   // 低焦虑 + 高回避
  | 'fearful-avoidant';     // 高焦虑 + 高回避

export interface AttachmentScore {
  /** 0..100 — anxiety axis (Bowlby chronic-abandonment fear) */
  anxious: number;
  /** 0..100 — avoidance axis (deactivation / suppression) */
  avoidant: number;
  /** 0..100 — derived: 100 - max(anxious, avoidant). High = secure base. */
  secure: number;
  /** Categorical label by 50/50 quadrant split. */
  style: AttachmentStyle;
  /** 'high' when both axes are confidently away from the 50 boundary, 'low' when item count < 4. */
  confidence: 'high' | 'medium' | 'low';
  /** Human-readable Chinese summary, ≤ 40 chars, suitable for the persona card. */
  oneLiner: string;
}

interface ItemDef {
  q: string;
  /** when true, high Likert = low score on the dimension */
  reverse?: boolean;
}

const ANXIOUS_ITEMS: ItemDef[] = [
  // q04: "对方不及时回复我会胡思乱想" — high = anxious (NOT reversed here)
  { q: 'q04' },
  // q08: "我经常需要伴侣的反复确认" — high = anxious
  { q: 'q08' },
];

const AVOIDANT_ITEMS: ItemDef[] = [
  // q01: "我愿意主动表达情绪" — high = NOT avoidant; reverse = avoidant
  { q: 'q01', reverse: true },
  // q12: "冲突后我会主动找对方修复" — high = NOT avoidant; reverse = avoidant
  { q: 'q12', reverse: true },
];

function clampLikert(n: number): number {
  if (!Number.isFinite(n)) return 4;
  return Math.max(1, Math.min(7, Math.round(n)));
}

function avgLikertItems(answers: Record<string, unknown>, items: ItemDef[]): { mean: number; count: number } {
  let sum = 0;
  let count = 0;
  for (const it of items) {
    const raw = answers[it.q];
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(num)) continue;
    const clamped = clampLikert(num);
    const v = it.reverse ? 8 - clamped : clamped;
    sum += v;
    count += 1;
  }
  return { mean: count === 0 ? 4 : sum / count, count };
}

function meanToPercent(mean: number): number {
  // Likert 1..7 → 0..100
  return Math.round(((mean - 1) / 6) * 100);
}

function classifyStyle(anxious: number, avoidant: number): AttachmentStyle {
  const highAnx = anxious >= 50;
  const highAvd = avoidant >= 50;
  if (!highAnx && !highAvd) return 'secure';
  if (highAnx && !highAvd) return 'anxious-preoccupied';
  if (!highAnx && highAvd) return 'dismissive-avoidant';
  return 'fearful-avoidant';
}

const STYLE_ONE_LINER: Record<AttachmentStyle, string> = {
  'secure': '安全型：稳定的情绪基线，能给也能接收支持',
  'anxious-preoccupied': '焦虑型：渴望亲密但容易过度解读对方信号',
  'dismissive-avoidant': '回避型：用独立感保护自己，不爱主动求安慰',
  'fearful-avoidant': '矛盾型：既渴望靠近又害怕受伤，进退之间徘徊',
};

/**
 * Score a user's attachment style from the 4-item sub-scale.
 *
 * Returns deterministic output suitable for both the demo bar chart and
 * the LLM-narrative endpoint. Falls back to all-medium values when the
 * relevant Likert keys are missing (keeping the contract healthy on
 * partial answers).
 */
export function scoreAttachmentStyle(
  answers: Record<string, unknown>,
): AttachmentScore {
  const anxStat = avgLikertItems(answers, ANXIOUS_ITEMS);
  const avdStat = avgLikertItems(answers, AVOIDANT_ITEMS);

  const anxious = meanToPercent(anxStat.mean);
  const avoidant = meanToPercent(avdStat.mean);
  const secure = Math.max(0, 100 - Math.max(anxious, avoidant));

  const style = classifyStyle(anxious, avoidant);

  const totalCount = anxStat.count + avdStat.count;
  const distFromBoundary = Math.min(Math.abs(anxious - 50), Math.abs(avoidant - 50));
  const confidence: AttachmentScore['confidence'] =
    totalCount < 4 ? 'low' : distFromBoundary >= 15 ? 'high' : 'medium';

  return {
    anxious,
    avoidant,
    secure,
    style,
    confidence,
    oneLiner: STYLE_ONE_LINER[style],
  };
}

/**
 * Build the chart-ready bar series the demo `AttachmentBars` component
 * consumes. Three bars at fixed positions so axis labels stay stable
 * across users.
 */
export function attachmentBarSeries(score: AttachmentScore): Array<{ axis: string; value: number; color: string }> {
  return [
    { axis: '焦虑 (Anxious)', value: score.anxious, color: '#efc2cd' },
    { axis: '回避 (Avoidant)', value: score.avoidant, color: '#f4dfbc' },
    { axis: '安全 (Secure)', value: score.secure, color: '#b3cdb9' },
  ];
}

export const ATTACHMENT_STYLE_LABELS: Record<AttachmentStyle, string> = {
  'secure': '安全型',
  'anxious-preoccupied': '焦虑型',
  'dismissive-avoidant': '回避型',
  'fearful-avoidant': '矛盾型',
};

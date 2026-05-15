import { FEEDBACK_TYPES } from './distributions.js';
import { clipInt, gauss, makeRng, pickWeighted, pseudoId, randInt } from './random.js';
import type { Gender, SyntheticMatch, SyntheticPortrait, SyntheticUser } from './types.js';

// =====================================================================
// "Ground truth" scorer — the hidden target the students try to learn.
// Deliberately different from the upstream baseline:
//  - emphasizes communication/repair (q12, q14) more than the baseline
//  - rewards hobby + personality overlap multiplicatively, not additively
//  - adds a small dose of academy affinity
//  - nonlinear penalty for big age/grade gap
// Add small Gaussian noise to simulate "users are not perfectly consistent".
// =====================================================================

function jaccard(a: readonly string[], b: readonly string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 0;
  let intersect = 0;
  for (const x of sa) if (sb.has(x)) intersect += 1;
  const union = sa.size + sb.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

function gradeIndex(g: string): number {
  const order = ['undergrad_1', 'undergrad_2', 'undergrad_3', 'undergrad_4', 'master', 'doctor'];
  const i = order.indexOf(g);
  return i < 0 ? 2 : i;
}

function isEligible(a: SyntheticUser, b: SyntheticUser): boolean {
  if (a.id === b.id) return false;
  const aGender = (a.profile.gender_identity || 'non_binary') as Gender;
  const bGender = (b.profile.gender_identity || 'non_binary') as Gender;
  if (a.profile.desired_genders.length === 0 || b.profile.desired_genders.length === 0) return false;
  if (!a.profile.desired_genders.includes(bGender)) return false;
  if (!b.profile.desired_genders.includes(aGender)) return false;
  return true;
}

function groundTruthScore(
  a: SyntheticUser,
  b: SyntheticUser,
  pa: SyntheticPortrait,
  pb: SyntheticPortrait,
  rng: () => number,
): number {
  // Communication & repair similarity (1-7 scale → 0-1)
  const commSim = 1 - Math.abs(a.answers.q12 - b.answers.q12) / 6;
  const repairSim = 1 - Math.abs(a.answers.q14 - b.answers.q14) / 6;

  // Goal alignment
  const goalMatch = a.profile.relationship_goal === b.profile.relationship_goal ? 1 : 0.5;

  // Hobby × personality (multiplicative, captures "we click")
  const hobbyJ = jaccard(a.profile.hobbies, b.profile.hobbies);
  const personalityJ = jaccard(a.profile.personality_tags, b.profile.personality_tags);
  const click = Math.sqrt(hobbyJ * personalityJ + 0.05);

  // Academy affinity
  const sameAcademy = a.profile.academy === b.profile.academy ? 1 : 0;

  // Campus convenience
  const sameCampus = a.profile.campus === b.profile.campus
    ? 1
    : a.profile.campus === 'both' || b.profile.campus === 'both'
    ? 0.7
    : 0.3;

  // Trait emotional-stability complementarity (one anxious + one calm works ok)
  const stabilityGap = Math.abs(pa.traits.emotional_stability - pb.traits.emotional_stability) / 100;
  const stability = 1 - 0.6 * stabilityGap;

  // Nonlinear grade gap penalty
  const gradeGap = Math.abs(gradeIndex(a.profile.grade_label) - gradeIndex(b.profile.grade_label));
  const gradePenalty = gradeGap >= 3 ? 0.15 : gradeGap === 2 ? 0.05 : 0;

  // Hard rule: smoking incompatibility
  let smokingPenalty = 0;
  if (
    (a.profile.smoking_preference === 'reject' && b.profile.smoking_preference === 'accept') ||
    (b.profile.smoking_preference === 'reject' && a.profile.smoking_preference === 'accept')
  ) {
    smokingPenalty = 0.3;
  }

  const raw =
    commSim * 0.18 +
    repairSim * 0.12 +
    goalMatch * 0.18 +
    click * 0.20 +
    sameAcademy * 0.05 +
    sameCampus * 0.12 +
    stability * 0.15 -
    gradePenalty -
    smokingPenalty;

  const noisy = raw + gauss(rng, 0, 0.05);
  return clipInt(Math.max(0, Math.min(1, noisy)) * 100, 0, 100);
}

// Cheap baseline scorer (pure cosine of small numeric vector + jaccard).
// Lives in fixtures so we don't depend on module-A's matchingService.
function baselineScore(
  a: SyntheticUser,
  b: SyntheticUser,
  pa: SyntheticPortrait,
  pb: SyntheticPortrait,
): { score: number; breakdown: Record<string, number> } {
  const va = [pa.traits.extroversion, pa.traits.openness, pa.traits.agreeableness, pa.traits.emotional_stability, pa.traits.eq_score];
  const vb = [pb.traits.extroversion, pb.traits.openness, pb.traits.agreeableness, pb.traits.emotional_stability, pb.traits.eq_score];
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < va.length; i++) {
    dot += va[i]! * vb[i]!;
    na += va[i]! * va[i]!;
    nb += vb[i]! * vb[i]!;
  }
  const cosine = na > 0 && nb > 0 ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  const hobbyJ = jaccard(a.profile.hobbies, b.profile.hobbies);
  const goalMatch = a.profile.relationship_goal === b.profile.relationship_goal ? 1 : 0.5;
  const score = clipInt((cosine * 0.5 + hobbyJ * 0.3 + goalMatch * 0.2) * 100, 0, 100);
  return {
    score,
    breakdown: { cosine, hobby_jaccard: hobbyJ, goal_match: goalMatch },
  };
}

function feedbackFromGroundTruth(score: number, rng: () => number): SyntheticMatch['feedback_type'] {
  // Higher ground-truth score → higher chance of liked / chatted / met.
  // Lower score → passed / dismissed / blocked.
  if (score >= 75) return pickWeighted(rng, [
    { value: 'liked' as const, weight: 50 },
    { value: 'chatted' as const, weight: 25 },
    { value: 'met' as const, weight: 10 },
    { value: 'passed' as const, weight: 10 },
    { value: 'dismissed' as const, weight: 5 },
  ] as any);
  if (score >= 60) return pickWeighted(rng, [
    { value: 'liked' as const, weight: 30 },
    { value: 'chatted' as const, weight: 15 },
    { value: 'passed' as const, weight: 35 },
    { value: 'dismissed' as const, weight: 18 },
    { value: 'met' as const, weight: 2 },
  ] as any);
  if (score >= 40) return pickWeighted(rng, [
    { value: 'liked' as const, weight: 12 },
    { value: 'passed' as const, weight: 45 },
    { value: 'dismissed' as const, weight: 35 },
    { value: 'blocked' as const, weight: 3 },
    { value: 'chatted' as const, weight: 5 },
  ] as any);
  return pickWeighted(rng, [
    { value: 'passed' as const, weight: 35 },
    { value: 'dismissed' as const, weight: 50 },
    { value: 'blocked' as const, weight: 15 },
  ] as any);
}

export function generateMatches(
  users: SyntheticUser[],
  portraits: SyntheticPortrait[],
  count: number,
  seed: number,
): SyntheticMatch[] {
  const rng = makeRng(seed);
  const portraitByUser = new Map(portraits.map((p) => [p.user_id, p]));
  const out: SyntheticMatch[] = [];
  const seenPair = new Set<string>();

  // Try up to 10x count attempts before giving up
  let attempts = 0;
  const maxAttempts = count * 10;

  while (out.length < count && attempts < maxAttempts) {
    attempts++;
    const i = randInt(rng, 0, users.length - 1);
    const j = randInt(rng, 0, users.length - 1);
    if (i === j) continue;
    const a = users[i]!;
    const b = users[j]!;
    if (!isEligible(a, b)) continue;

    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    if (seenPair.has(key)) continue;
    seenPair.add(key);

    const pa = portraitByUser.get(a.id);
    const pb = portraitByUser.get(b.id);
    if (!pa || !pb) continue;

    const baseline = baselineScore(a, b, pa, pb);
    const truth = groundTruthScore(a, b, pa, pb, rng);
    const feedback = feedbackFromGroundTruth(truth, rng);

    const reveal_at = new Date(
      new Date('2026-04-15T00:00:00Z').getTime() + randInt(rng, 0, 21 * 24 * 3600 * 1000),
    ).toISOString();

    out.push({
      id: pseudoId('match', out.length),
      user_a_id: a.id,
      user_b_id: b.id,
      baseline_score: baseline.score,
      baseline_breakdown: baseline.breakdown,
      ground_truth_score: truth,
      feedback_type: feedback,
      reveal_at,
      match_type: rng() < 0.85 ? 'instant' : 'weekly_batch',
      status: rng() < 0.62 ? 'revealed' : 'pending',
    });
  }

  return out;
}

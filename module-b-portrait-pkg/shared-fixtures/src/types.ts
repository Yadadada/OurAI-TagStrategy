// Public types for synthetic fixtures. Mirror the upstream schema.

export type Gender = 'female' | 'male' | 'non_binary';
export type Campus = 'minhang' | 'putuo' | 'lingang' | 'both' | '';
export type GradeLabel =
  | 'undergrad_1'
  | 'undergrad_2'
  | 'undergrad_3'
  | 'undergrad_4'
  | 'master'
  | 'doctor'
  | '';

export interface DatingProfile {
  campus: Campus;
  grade_label: GradeLabel;
  academy: string;
  gender_identity: Gender | '';
  desired_genders: Gender[];
  smoking_preference: 'reject' | 'prefer_no' | 'accept' | '';
  long_distance_preference: 'reject' | 'depends' | 'accept' | '';
  routine: 'normal' | 'night_owl' | 'irregular' | 'early_bird';
  hobbies: string[];
  personality_tags: string[];
  relationship_goal: 'serious' | 'slow_burn' | 'friend_first';
  relationship_role: 'caregiver' | 'receiver' | 'equal' | 'flexible';
  relationship_needs: string[];
  intro_prompt?: string;
}

export type LikertAnswer = number; // 1-7

export interface QuestionnaireAnswers {
  q01: LikertAnswer; q02: LikertAnswer; q03: LikertAnswer; q04: LikertAnswer;
  q05: LikertAnswer; q06: LikertAnswer; q07: LikertAnswer; q08: LikertAnswer;
  q09: LikertAnswer; q10: LikertAnswer; q11: LikertAnswer; q12: LikertAnswer;
  q13: LikertAnswer; q14: LikertAnswer; q15: LikertAnswer; q16: LikertAnswer;
  q17: LikertAnswer; q18: LikertAnswer;
  q19?: string;
  q20?: string;
  intro_prompt?: string;
  relationship_goal: DatingProfile['relationship_goal'];
  relationship_role: DatingProfile['relationship_role'];
  relationship_needs: string[];
}

export interface SyntheticUser {
  id: string;
  username: string;
  school_key: 'ecnu';
  profile: DatingProfile;
  answers: QuestionnaireAnswers;
  metadata: {
    created_at: string;
    last_active_at: string;
    seed_index: number;
  };
}

export interface PortraitMbti {
  mbti_type: string;
  mbti_ei: number; // 0-100
  mbti_sn: number;
  mbti_tf: number;
  mbti_jp: number;
  mbti_confidence: 'low' | 'medium' | 'high';
  archetype: string;
  one_liner: string;
}

export interface PortraitTraits {
  extroversion: number;
  openness: number;
  conscientiousness: number;
  agreeableness: number;
  emotional_stability: number;
  logic_score: number;
  creativity_score: number;
  eq_score: number;
  execution_score: number;
  curiosity_score: number;
  social_score: number;
}

export interface PortraitInterest {
  tag_name: string;
  category: string;
  weight: number; // 0-100
  mention_count: number;
}

export interface SyntheticPortrait {
  user_id: string;
  mbti: PortraitMbti;
  traits: PortraitTraits;
  interests: PortraitInterest[];
}

export interface SyntheticMatch {
  id: string;
  user_a_id: string;
  user_b_id: string;
  baseline_score: number; // 0-100
  baseline_breakdown: Record<string, unknown>;
  // Ground-truth label, generated from a hidden scorer + noise.
  // Use this as the supervised target.
  ground_truth_score: number; // 0-100, NOT given to the algorithm at inference time
  feedback_type: 'liked' | 'passed' | 'dismissed' | 'chatted' | 'met' | 'blocked';
  reveal_at: string;
  match_type: 'weekly_batch' | 'instant';
  status: 'pending' | 'revealed';
}

export interface FixtureMeta {
  generated_at: string;
  seed: number;
  user_count: number;
  match_count: number;
  holdout_user_count: number;
  upstream_commit: string;
  notes: string;
}

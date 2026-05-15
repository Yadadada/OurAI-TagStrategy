// Stub for api/src/domains/dating/model.ts.
//
// personaCard.ts imports `datingModel` (DB-backed onboarding session reads,
// questionnaire fetch) and `DatingError`. In coursework the source of truth
// is the shared-fixtures users + the live questionnaire export, so the
// session helpers are unused — but the symbols must exist for compilation.

import { ECNU_DATING_QUESTIONNAIRE } from '@coursework/shared-fixtures/questionnaire';

export class DatingError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = 'DATING_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface OnboardingSession {
  session_id: string;
  finalized_user_id: string | null;
  questionnaire_answers?: Record<string, unknown>;
  profile_draft?: Record<string, unknown>;
}

export const datingModel = {
  async getOnboardingSession(_id: string): Promise<OnboardingSession | null> {
    return null;
  },
  async getCurrentQuestionnaire(): Promise<{ version_key: string }> {
    return { version_key: ECNU_DATING_QUESTIONNAIRE.versionKey };
  },
};

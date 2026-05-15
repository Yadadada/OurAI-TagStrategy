export type DatingFieldType = 'single' | 'single_with_other' | 'multi' | 'text' | 'scale';
export interface DatingFieldOption {
    value: string;
    label: string;
}
export interface DatingQuestionField {
    id: string;
    type: DatingFieldType;
    label: string;
    required: boolean;
    placeholder?: string;
    description?: string;
    maxLength?: number;
    minSelections?: number;
    maxSelections?: number;
    options?: DatingFieldOption[];
    scale?: {
        min: number;
        max: number;
        minLabel: string;
        maxLabel: string;
    };
}
export interface DatingQuestionnaireDefinition {
    versionKey: string;
    schoolKey: string;
    title: string;
    description: string;
    estimatedMinutes: number;
    profileFields: DatingQuestionField[];
    questions: DatingQuestionField[];
    scoringProfile: Record<string, unknown>;
}
export declare const ECNU_DATING_QUESTIONNAIRE: DatingQuestionnaireDefinition;

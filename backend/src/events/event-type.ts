export const AttemptEventType = {
  QUESTION_VIEWED: 'QUESTION_VIEWED',
  CHOICE_SELECTED: 'CHOICE_SELECTED',
  MARKED: 'MARKED',
  FOCUS_LOST: 'FOCUS_LOST',
  SUBMITTED: 'SUBMITTED',
} as const;

export type AttemptEventType =
  (typeof AttemptEventType)[keyof typeof AttemptEventType];

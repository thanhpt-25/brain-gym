import { z } from 'zod';
import { AttemptEventType } from './event-type';

export const questionViewedSchema = z.object({
  questionId: z.string(),
  questionIndex: z.number().int().min(0),
  durationMs: z.number().int().min(0).optional(),
});

export const choiceSelectedSchema = z.object({
  questionId: z.string(),
  choiceId: z.string(),
  selected: z.boolean(),
});

export const markedSchema = z.object({
  questionId: z.string(),
  marked: z.boolean(),
});

export const focusLostSchema = z.object({
  durationMs: z.number().int().min(0),
});

export const submittedSchema = z.object({
  totalTimeMs: z.number().int().min(0),
  answeredCount: z.number().int().min(0),
});

export const eventPayloadSchemas: Record<string, z.ZodTypeAny> = {
  [AttemptEventType.QUESTION_VIEWED]: questionViewedSchema,
  [AttemptEventType.CHOICE_SELECTED]: choiceSelectedSchema,
  [AttemptEventType.MARKED]: markedSchema,
  [AttemptEventType.FOCUS_LOST]: focusLostSchema,
  [AttemptEventType.SUBMITTED]: submittedSchema,
};

type ParseResult =
  | { success: true; data: unknown }
  | { success: false; error: z.ZodError };

export function parseEventPayload(
  eventType: string,
  payload: unknown,
): ParseResult {
  const schema = eventPayloadSchemas[eventType];
  if (!schema) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['eventType'],
          message: `Unknown eventType: ${eventType}`,
        },
      ]),
    };
  }
  return schema.safeParse(payload) as ParseResult;
}

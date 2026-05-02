import {
  questionViewedSchema,
  choiceSelectedSchema,
  markedSchema,
  focusLostSchema,
  submittedSchema,
  eventPayloadSchemas,
  parseEventPayload,
} from './event-payload.schema';
import { AttemptEventType } from './event-type';

describe('event-payload schemas', () => {
  // ── QUESTION_VIEWED ────────────────────────────────────────────────────────

  describe('questionViewedSchema', () => {
    it('accepts a valid QUESTION_VIEWED payload', () => {
      const result = questionViewedSchema.safeParse({
        questionId: 'q-1',
        questionIndex: 0,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing questionId', () => {
      const result = questionViewedSchema.safeParse({ questionIndex: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects negative questionIndex', () => {
      const result = questionViewedSchema.safeParse({
        questionId: 'q-1',
        questionIndex: -1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer questionIndex', () => {
      const result = questionViewedSchema.safeParse({
        questionId: 'q-1',
        questionIndex: 1.5,
      });
      expect(result.success).toBe(false);
    });

    it('accepts optional durationMs when present', () => {
      const result = questionViewedSchema.safeParse({
        questionId: 'q-1',
        questionIndex: 2,
        durationMs: 4500,
      });
      expect(result.success).toBe(true);
    });
  });

  // ── CHOICE_SELECTED ────────────────────────────────────────────────────────

  describe('choiceSelectedSchema', () => {
    it('accepts a valid CHOICE_SELECTED payload', () => {
      const result = choiceSelectedSchema.safeParse({
        questionId: 'q-2',
        choiceId: 'c-1',
        selected: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing choiceId', () => {
      const result = choiceSelectedSchema.safeParse({
        questionId: 'q-2',
        selected: true,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-boolean selected', () => {
      const result = choiceSelectedSchema.safeParse({
        questionId: 'q-2',
        choiceId: 'c-1',
        selected: 'yes',
      });
      expect(result.success).toBe(false);
    });
  });

  // ── MARKED ─────────────────────────────────────────────────────────────────

  describe('markedSchema', () => {
    it('accepts a valid MARKED payload with marked=true', () => {
      const result = markedSchema.safeParse({
        questionId: 'q-3',
        marked: true,
      });
      expect(result.success).toBe(true);
    });

    it('accepts a valid MARKED payload with marked=false', () => {
      const result = markedSchema.safeParse({
        questionId: 'q-3',
        marked: false,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing marked field', () => {
      const result = markedSchema.safeParse({ questionId: 'q-3' });
      expect(result.success).toBe(false);
    });
  });

  // ── FOCUS_LOST ─────────────────────────────────────────────────────────────

  describe('focusLostSchema', () => {
    it('accepts a valid FOCUS_LOST payload', () => {
      const result = focusLostSchema.safeParse({ durationMs: 1200 });
      expect(result.success).toBe(true);
    });

    it('rejects negative durationMs', () => {
      const result = focusLostSchema.safeParse({ durationMs: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects missing durationMs', () => {
      const result = focusLostSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ── SUBMITTED ──────────────────────────────────────────────────────────────

  describe('submittedSchema', () => {
    it('accepts a valid SUBMITTED payload', () => {
      const result = submittedSchema.safeParse({
        totalTimeMs: 180000,
        answeredCount: 60,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative totalTimeMs', () => {
      const result = submittedSchema.safeParse({
        totalTimeMs: -1,
        answeredCount: 60,
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing answeredCount', () => {
      const result = submittedSchema.safeParse({ totalTimeMs: 180000 });
      expect(result.success).toBe(false);
    });
  });

  // ── eventPayloadSchemas map ────────────────────────────────────────────────

  describe('eventPayloadSchemas', () => {
    it('has an entry for all 5 event types', () => {
      const types = Object.values(AttemptEventType);
      for (const type of types) {
        expect(eventPayloadSchemas).toHaveProperty(type);
      }
    });

    it('each entry is a Zod schema with safeParse', () => {
      for (const schema of Object.values(eventPayloadSchemas)) {
        expect(typeof (schema as any).safeParse).toBe('function');
      }
    });
  });

  // ── parseEventPayload dispatcher ──────────────────────────────────────────

  describe('parseEventPayload', () => {
    it('parses a QUESTION_VIEWED payload successfully', () => {
      const result = parseEventPayload(AttemptEventType.QUESTION_VIEWED, {
        questionId: 'q-1',
        questionIndex: 0,
      });
      expect(result.success).toBe(true);
    });

    it('returns failure for unknown event type', () => {
      const result = parseEventPayload('UNKNOWN_TYPE' as any, {});
      expect(result.success).toBe(false);
    });

    it('returns failure when payload does not match schema', () => {
      const result = parseEventPayload(AttemptEventType.FOCUS_LOST, {
        durationMs: 'not-a-number',
      });
      expect(result.success).toBe(false);
    });
  });
});

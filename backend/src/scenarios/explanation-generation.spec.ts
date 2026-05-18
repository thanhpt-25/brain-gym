import { ExplanationGenerationService } from './explanation-generation.service';

describe('ExplanationGenerationService', () => {
  let service: ExplanationGenerationService;

  beforeEach(() => {
    service = new ExplanationGenerationService();
  });

  describe('generateExplanation', () => {
    it('should generate explanation for correct answer', async () => {
      const request = {
        question: 'What is 2 + 2?',
        correctAnswer: '4',
        userAnswer: '4',
        reasoningTrace: 'User correctly identified the sum',
      };

      const result = await service.generateExplanation(request);

      expect(result).toHaveProperty('explanation');
      expect(result).toHaveProperty('keyInsights');
      expect(result).toHaveProperty('misconceptionAddress');
      expect(result.explanation).toBeTruthy();
      expect(Array.isArray(result.keyInsights)).toBe(true);
      expect(result.misconceptionAddress).toBeTruthy();
    });

    it('should generate explanation for incorrect answer', async () => {
      const request = {
        question: 'What is 2 + 2?',
        correctAnswer: '4',
        userAnswer: '5',
        reasoningTrace: 'User incorrectly calculated the sum',
      };

      const result = await service.generateExplanation(request);

      expect(result.explanation).toBeTruthy();
      expect(result.explanation).toContain('4');
      expect(result.misconceptionAddress).toBeTruthy();
    });

    it('should handle LLM timeout gracefully', async () => {
      const request = {
        question: 'What is 2 + 2?',
        correctAnswer: '4',
        userAnswer: '5',
        reasoningTrace: 'User made an error',
      };

      jest.useFakeTimers();
      const generatePromise = service.generateExplanation(request);
      jest.advanceTimersByTime(15000);
      const result = await generatePromise;
      jest.useRealTimers();

      expect(result).toBeDefined();
      expect(result.explanation).toBeTruthy();
    });

    it('should return fallback explanation on LLM error', async () => {
      const request = {
        question: 'What is 2 + 2?',
        correctAnswer: '4',
        userAnswer: '4',
        reasoningTrace: 'Correct calculation',
      };

      const result = await service.generateExplanation(request);

      expect(result.explanation).toContain('correct');
      expect(result.keyInsights.length).toBeGreaterThan(0);
    });

    it('should generate key insights array', async () => {
      const request = {
        question: 'What is the capital of France?',
        correctAnswer: 'Paris',
        userAnswer: 'Paris',
        reasoningTrace: 'Correct geographic knowledge',
      };

      const result = await service.generateExplanation(request);

      expect(Array.isArray(result.keyInsights)).toBe(true);
      expect(result.keyInsights.length).toBeGreaterThanOrEqual(1);
      result.keyInsights.forEach((insight) => {
        expect(typeof insight).toBe('string');
        expect(insight.length).toBeGreaterThan(0);
      });
    });

    it('should address misconceptions for incorrect answers', async () => {
      const request = {
        question: 'What is the capital of France?',
        correctAnswer: 'Paris',
        userAnswer: 'London',
        reasoningTrace: 'User confused France with UK',
      };

      const result = await service.generateExplanation(request);

      expect(result.misconceptionAddress).toBeTruthy();
      expect(result.misconceptionAddress.length).toBeGreaterThan(0);
    });

    it('should handle missing explanation response fields', async () => {
      const request = {
        question: 'Test question?',
        correctAnswer: 'A',
        userAnswer: 'B',
        reasoningTrace: 'Test reasoning',
      };

      const result = await service.generateExplanation(request);

      expect(result.explanation).toBeDefined();
      expect(Array.isArray(result.keyInsights)).toBe(true);
      expect(result.misconceptionAddress).toBeDefined();
    });

    it('should generate explanation under 5 seconds', async () => {
      const request = {
        question: 'What is 2 + 2?',
        correctAnswer: '4',
        userAnswer: '4',
        reasoningTrace: 'Simple arithmetic',
      };

      const startTime = Date.now();
      await service.generateExplanation(request);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
    });

    it('should not throw on invalid request', async () => {
      const request = {
        question: '',
        correctAnswer: '',
        userAnswer: '',
        reasoningTrace: '',
      };

      await expect(service.generateExplanation(request)).resolves.toBeDefined();
    });

    it('should include both correct and incorrect answer paths', async () => {
      const correctRequest = {
        question: 'Is water wet?',
        correctAnswer: 'yes',
        userAnswer: 'yes',
        reasoningTrace: 'Yes, water is wet',
      };

      const incorrectRequest = {
        question: 'Is water wet?',
        correctAnswer: 'yes',
        userAnswer: 'no',
        reasoningTrace: 'No, water is not wet',
      };

      const correctResult = await service.generateExplanation(correctRequest);
      const incorrectResult =
        await service.generateExplanation(incorrectRequest);

      expect(correctResult.explanation).toBeTruthy();
      expect(incorrectResult.explanation).toBeTruthy();
      expect(correctResult.explanation).not.toEqual(
        incorrectResult.explanation,
      );
    });
  });
});

import { Injectable, Logger } from '@nestjs/common';

interface ExplanationRequest {
  question: string;
  correctAnswer: string;
  userAnswer: string;
  reasoningTrace: string;
}

interface ExplanationResponse {
  explanation: string;
  keyInsights: string[];
  misconceptionAddress: string;
}

@Injectable()
export class ExplanationGenerationService {
  private readonly logger = new Logger(ExplanationGenerationService.name);
  private readonly LLM_TIMEOUT_MS = 15000;

  async generateExplanation(
    request: ExplanationRequest,
  ): Promise<ExplanationResponse> {
    const startTime = Date.now();

    try {
      const prompt = this.buildExplanationPrompt(request);
      const response = await this.callLlmWithTimeout(prompt);

      if (!response || typeof response !== 'object') {
        return this.getFallbackExplanation(request);
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Explanation generated in ${duration}ms for question`);

      return {
        explanation: response.explanation || '',
        keyInsights: response.keyInsights || [],
        misconceptionAddress: response.misconceptionAddress || '',
      };
    } catch (error) {
      this.logger.error(`Failed to generate explanation: ${error.message}`);
      return this.getFallbackExplanation(request);
    }
  }

  private buildExplanationPrompt(request: ExplanationRequest): string {
    return `Generate a pedagogical explanation for this scenario question.

Question: ${request.question}

Correct Answer: ${request.correctAnswer}

User's Answer: ${request.userAnswer}

Original Reasoning: ${request.reasoningTrace}

Provide a JSON response with:
- explanation: Clear explanation of why the answer is correct (max 200 words)
- keyInsights: Array of 2-3 key learning points
- misconceptionAddress: Address any misconception if the user answered incorrectly (max 100 words)

Return valid JSON only.`;
  }

  private async callLlmWithTimeout(prompt: string): Promise<any> {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Timeout after ${this.LLM_TIMEOUT_MS / 1000}s calling LLM`,
            ),
          ),
        this.LLM_TIMEOUT_MS,
      ),
    );

    try {
      return await Promise.race([this.callLlm(prompt), timeoutPromise]);
    } catch (error) {
      if (error.message.includes('Timeout')) {
        throw error;
      }
      throw error;
    }
  }

  private async callLlm(prompt: string): Promise<any> {
    // TODO: Implement actual LLM call using Claude API
    // For now, return mock response for testing
    const correctAnswerMatch = prompt.match(/Correct Answer: (.*?)\n/);
    const userAnswerMatch = prompt.match(/User's Answer: (.*?)\n/);

    const correctAnswer = correctAnswerMatch ? correctAnswerMatch[1] : '';
    const userAnswer = userAnswerMatch ? userAnswerMatch[1] : '';
    const isCorrect = userAnswer === correctAnswer;

    return {
      explanation: isCorrect
        ? `The correct answer is "${correctAnswer}". This answer is correct because it aligns with the reasoning provided in the original passage. The key concept here is understanding how the different elements interact to produce the correct outcome. By carefully analyzing each option and comparing it against the passage content, we can determine which answer best matches the information provided.`
        : `The correct answer is "${correctAnswer}", but you selected "${userAnswer}". Your answer does not align with the information provided in the passage. By carefully analyzing the relevant sections and comparing your reasoning with the passage content, you can identify why "${correctAnswer}" is the correct choice.`,
      keyInsights: [
        'Understanding the relationship between concepts',
        'Careful reading of all available information',
        'Process of elimination can help identify correct answers',
      ],
      misconceptionAddress: isCorrect
        ? 'Well done! Your understanding of this concept is solid. Continue practicing to strengthen your mastery.'
        : `The core misconception appears to be around the distinction between "${userAnswer}" and "${correctAnswer}". Take time to re-read the relevant section and focus on the specific details that distinguish the correct answer from the incorrect options.`,
    };
  }

  private getFallbackExplanation(
    request: ExplanationRequest,
  ): ExplanationResponse {
    const isCorrect = request.userAnswer === request.correctAnswer;

    return {
      explanation: isCorrect
        ? `Your answer is correct. The correct answer is: ${request.correctAnswer}`
        : `The correct answer is ${request.correctAnswer}, but you selected ${request.userAnswer}. Review the question and passage to understand why this is the correct choice.`,
      keyInsights: [
        'Re-read the relevant section of the passage',
        'Pay attention to specific details and keywords',
      ],
      misconceptionAddress: isCorrect
        ? 'Well done! Continue practicing to strengthen your understanding.'
        : 'Take time to understand why your answer was incorrect and what concept you may have misunderstood.',
    };
  }
}

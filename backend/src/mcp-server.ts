#!/usr/bin/env node
/**
 * Brain Gym MCP Server
 *
 * A Model Context Protocol server that exposes a tool for AI assistants
 * (Claude Desktop, NotebookLM, etc.) to push bulk certification-exam
 * questions into the Brain Gym platform.
 *
 * Environment variables:
 *   BRAIN_GYM_API_URL       – Base URL of the running backend (default: http://localhost:3000)
 *   BRAIN_GYM_BEARER_TOKEN  – JWT bearer token for authentication (required)
 *
 * Usage with Claude Desktop – add to claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "brain-gym": {
 *         "command": "npx",
 *         "args": ["ts-node", "src/mcp-server.ts"],
 *         "cwd": "/path/to/brain-gym/backend",
 *         "env": {
 *           "BRAIN_GYM_API_URL": "http://localhost:3000",
 *           "BRAIN_GYM_BEARER_TOKEN": "<your-jwt>"
 *         }
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ── Configuration ──────────────────────────────────────────────────────────────

const API_URL = process.env.BRAIN_GYM_API_URL || 'http://localhost:3000';
const BEARER_TOKEN = process.env.BRAIN_GYM_BEARER_TOKEN || '';

if (!BEARER_TOKEN) {
  console.error(
    '[brain-gym-mcp] ERROR: BRAIN_GYM_BEARER_TOKEN environment variable is required.\n' +
    'Set it to a valid JWT token from your Brain Gym account.',
  );
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function callIntakeApi(payload: Record<string, unknown>): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
}> {
  const url = `${API_URL}/api/v1/ai-questions/mcp/intake`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BEARER_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => res.text());
  return { ok: res.ok, status: res.status, body };
}

// ── MCP Server ─────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'brain-gym',
  version: '1.0.0',
});

// ── Tool: push_questions ───────────────────────────────────────────────────────

const ChoiceSchema = {
  label: z.string().describe('Choice label, e.g. "a", "b", "c", "d"'),
  content: z.string().describe('The text content of this choice'),
  isCorrect: z.boolean().describe('Whether this choice is the correct answer'),
};

const QuestionSchema = {
  question: z.string().describe('The question text / title'),
  choices: z.array(z.object(ChoiceSchema)).min(2).max(6).describe('Answer choices (2-6 options)'),
  explanation: z.string().optional().describe('Explanation of why the correct answer is right'),
  source_passage: z.string().optional().describe('Source passage from the study material'),
  quality_score: z.number().min(0).max(1).optional().describe(
    'Quality confidence score 0-1. >= 0.85 auto-publishes, 0.60-0.84 goes to review, < 0.60 is discarded',
  ),
};

server.tool(
  'push_questions',
  'Push one or more certification-exam practice questions into the Brain Gym question bank. ' +
  'Questions go through the quality gate: score >= 0.85 auto-publishes, 0.60-0.84 goes to review queue, < 0.60 is discarded. ' +
  'You MUST provide at least one question and a valid certificationId.',
  {
    questions: z.array(z.object(QuestionSchema)).min(1).describe('Array of questions to push'),
    certificationId: z.string().describe(
      'ID of the target certification. Known IDs: ' +
      '"aws-saa" (AWS Solutions Architect Associate), ' +
      '"az-900" (Azure Fundamentals), ' +
      '"gcp-pca" (GCP Professional Cloud Architect), ' +
      '"cka" (Certified Kubernetes Administrator), ' +
      '"pmp" (Project Management Professional)',
    ),
    domainId: z.string().optional().describe('Optional domain ID within the certification'),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional().describe('Question difficulty (default: MEDIUM)'),
    questionType: z.enum(['SINGLE', 'MULTIPLE']).optional().describe('Single or multiple correct answers (default: SINGLE)'),
  },
  async (args) => {
    try {
      const result = await callIntakeApi(args);

      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Brain Gym API returned ${result.status}:\n${JSON.stringify(result.body, null, 2)}`,
            },
          ],
          isError: true,
        };
      }

      const data = result.body as { saved: number; discarded: number; questionIds: string[] };
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `✅ Successfully processed ${args.questions.length} question(s):\n` +
              `   • Saved: ${data.saved}\n` +
              `   • Discarded (low quality): ${data.discarded}\n` +
              `   • Question IDs: ${data.questionIds?.join(', ') || 'none'}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Failed to connect to Brain Gym API at ${API_URL}: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ── Resource: list available certifications ────────────────────────────────────

server.resource(
  'certifications',
  'brain-gym://certifications',
  { description: 'List of available certifications in Brain Gym' },
  async () => ({
    contents: [
      {
        uri: 'brain-gym://certifications',
        mimeType: 'application/json',
        text: JSON.stringify([
          { id: 'aws-saa', code: 'SAA-C03', name: 'AWS Solutions Architect Associate' },
          { id: 'az-900', code: 'AZ-900', name: 'Azure Fundamentals' },
          { id: 'gcp-pca', code: 'PCA', name: 'GCP Professional Cloud Architect' },
          { id: 'cka', code: 'CKA', name: 'Certified Kubernetes Administrator' },
          { id: 'pmp', code: 'PMP', name: 'Project Management Professional' },
        ], null, 2),
      },
    ],
  }),
);

// ── Start ──────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[brain-gym-mcp] Server started on stdio transport');
}

main().catch((err) => {
  console.error('[brain-gym-mcp] Fatal error:', err);
  process.exit(1);
});

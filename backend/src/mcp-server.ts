#!/usr/bin/env node
/**
 * Brain Gym MCP Server
 *
 * A Model Context Protocol server that exposes a tool for AI assistants
 * (Claude Desktop, NotebookLM, etc.) to push bulk certification-exam
 * questions into the Brain Gym platform.
 *
 * Environment variables:
 *   BRAIN_GYM_API_URL  – Base URL of the running backend (default: http://localhost:3000)
 *   BRAIN_GYM_API_KEY  – MCP API key generated in CertGym Settings (required, starts with mcp_)
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
 *           "BRAIN_GYM_API_KEY": "<your-mcp-api-key-from-settings>"
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
const API_KEY = process.env.BRAIN_GYM_API_KEY || '';

if (!API_KEY || !API_KEY.startsWith('mcp_')) {
  console.error(
    '[brain-gym-mcp] ERROR: BRAIN_GYM_API_KEY environment variable is required.\n' +
      'Generate one in CertGym Settings → MCP API Keys. It starts with "mcp_".',
  );
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function callApi(
  path: string,
  options: RequestInit = {},
): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
}> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => res.text());
  return { ok: res.ok, status: res.status, body };
}

interface CertDomain {
  id: string;
  name: string;
}

interface CertSummary {
  id: string;
  code: string;
  name: string;
  domains: CertDomain[];
}

async function fetchCertifications(): Promise<CertSummary[]> {
  const result = await callApi('/api/v1/certifications');
  if (!result.ok || !Array.isArray(result.body)) return [];
  return (
    result.body as {
      id: string;
      code: string;
      name: string;
      domains?: CertDomain[];
    }[]
  ).map(({ id, code, name, domains }) => ({
    id,
    code,
    name,
    domains: domains ?? [],
  }));
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
  choices: z
    .array(z.object(ChoiceSchema))
    .min(2)
    .max(6)
    .describe('Answer choices (2-6 options)'),
  explanation: z
    .string()
    .optional()
    .describe('Explanation of why the correct answer is right'),
  source_passage: z
    .string()
    .optional()
    .describe('Source passage from the study material'),
  quality_score: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      'Quality confidence score 0-1. >= 0.85 auto-publishes, 0.60-0.84 goes to review, < 0.60 is discarded',
    ),
};

server.tool(
  'push_questions',
  'Push one or more certification-exam practice questions into the Brain Gym question bank. ' +
    'Questions go through the quality gate: score >= 0.85 auto-publishes, 0.60-0.84 goes to review queue, < 0.60 is discarded. ' +
    'You MUST provide at least one question and a valid certificationId.',
  {
    questions: z
      .array(z.object(QuestionSchema))
      .min(1)
      .describe('Array of questions to push'),
    certificationId: z
      .string()
      .describe(
        'UUID of the target certification. Read the brain-gym://certifications resource to get valid IDs before calling this tool.',
      ),
    domainId: z
      .string()
      .optional()
      .describe('Optional domain ID within the certification'),
    difficulty: z
      .enum(['EASY', 'MEDIUM', 'HARD'])
      .optional()
      .describe('Question difficulty (default: MEDIUM)'),
    questionType: z
      .enum(['SINGLE', 'MULTIPLE'])
      .optional()
      .describe('Single or multiple correct answers (default: SINGLE)'),
  },
  async (args) => {
    try {
      const result = await callApi('/api/v1/ai-questions/mcp/intake', {
        method: 'POST',
        body: JSON.stringify(args),
      });

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

      const data = result.body as {
        saved: number;
        discarded: number;
        questionIds: string[];
      };
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
  {
    description:
      'Live list of certifications available in Brain Gym. Read this before calling push_questions to get valid certificationId values.',
  },
  async () => {
    const certs = await fetchCertifications();
    return {
      contents: [
        {
          uri: 'brain-gym://certifications',
          mimeType: 'application/json',
          text: JSON.stringify(certs, null, 2),
        },
      ],
    };
  },
);

// ── Tool: list_certifications ──────────────────────────────────────────────────

server.tool(
  'list_certifications',
  'List all certifications available in Brain Gym. Call this first to get valid certificationId values before calling push_questions.',
  {},
  async () => {
    try {
      const certs = await fetchCertifications();
      if (certs.length === 0) {
        return {
          content: [
            { type: 'text' as const, text: 'No certifications found.' },
          ],
        };
      }
      const lines = certs.map((c) => `• ${c.code} — ${c.name}\n  id: ${c.id}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Available certifications:\n\n${lines.join('\n\n')}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Failed to fetch certifications: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ── Tool: list_domains ────────────────────────────────────────────────────────

server.tool(
  'list_domains',
  'List all domains for a specific certification. Call this after list_certifications to get valid domainId values for push_questions.',
  {
    certificationId: z
      .string()
      .describe('UUID of the certification to list domains for'),
  },
  async (args) => {
    try {
      const certs = await fetchCertifications();
      const cert = certs.find((c) => c.id === args.certificationId);
      if (!cert) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Certification "${args.certificationId}" not found. Call list_certifications to get valid IDs.`,
            },
          ],
          isError: true,
        };
      }
      if (cert.domains.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No domains defined for ${cert.code} — ${cert.name}.`,
            },
          ],
        };
      }
      const lines = cert.domains.map((d) => `• ${d.name}\n  id: ${d.id}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Domains for ${cert.code} — ${cert.name}:\n\n${lines.join('\n\n')}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Failed to fetch domains: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
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

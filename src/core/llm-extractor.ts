import Anthropic from '@anthropic-ai/sdk';
import {
  SnapshotSection,
  type Snapshot,
  type SnapshotEntry,
  type SessionMessage,
} from '../models/index.js';
import { scoreMessage } from './signals.js';
import { isBoilerplate } from '../utils/text.js';
import { LlmExtractionError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('llm-extractor');

const MAX_PREFILTERED_MESSAGES = 60;
const MAX_MESSAGE_CHARS = 1500;

const EXTRACTION_PROMPT = `You are a session knowledge extractor. Given a conversation between a human and an AI assistant, extract the most important knowledge into structured sections.

Analyze the conversation and return a JSON object with exactly these 5 sections:

1. "projectGoal" - What is the project trying to accomplish? The core objective.
2. "keyDecisions" - Important technical decisions made (e.g., "Use TypeScript with strict mode", "Chose PostgreSQL over MongoDB").
3. "constraints" - Hard constraints, requirements, or rules (e.g., "Must maintain backward compatibility", "No breaking API changes").
4. "implementationArtifacts" - Key files created/modified, commands used, or important code patterns established.
5. "openTasks" - Remaining TODOs, follow-ups, or unfinished work.

Rules:
- Each entry should be a concise, self-contained statement (1 sentence, max ~120 chars).
- Only include genuinely important knowledge worth remembering across sessions.
- Skip conversational filler, greetings, and debugging back-and-forth.
- Maximum 5 entries per section. Fewer is fine if there's less to extract.
- If a section has nothing meaningful, use an empty array.
- Return ONLY valid JSON, no markdown fences, no explanation.

Expected format:
{
  "projectGoal": ["statement1", "statement2"],
  "keyDecisions": ["statement1"],
  "constraints": ["statement1", "statement2"],
  "implementationArtifacts": ["statement1"],
  "openTasks": ["statement1"]
}`;

/** Select the most important messages by signal score, keeping first/last for context. */
export function prefilterMessages(
  messages: SessionMessage[],
  maxMessages: number = MAX_PREFILTERED_MESSAGES,
): SessionMessage[] {
  if (messages.length <= maxMessages) return messages;

  const scored = messages.map((m) => ({
    original: m,
    scored: scoreMessage(m),
  }));

  const filtered = scored.filter(
    (s) => !isBoilerplate(s.original.content) && s.original.content.trim().length > 0,
  );

  const first5 = filtered.slice(0, 5);
  const last5 = filtered.slice(-5);
  const middle = filtered.slice(5, -5).sort((a, b) => b.scored.importanceScore - a.scored.importanceScore);

  const budget = maxMessages - first5.length - last5.length;
  const topMiddle = middle.slice(0, Math.max(0, budget));

  const selected = new Set<SessionMessage>();
  for (const s of [...first5, ...topMiddle, ...last5]) {
    selected.add(s.original);
  }

  return messages.filter((m) => selected.has(m));
}

/** Format messages as labeled text, truncating long content. */
export function formatMessagesForLlm(messages: SessionMessage[]): string {
  const lines: string[] = [];

  for (const msg of messages) {
    const role = msg.role === 'human' ? 'Human' : 'Assistant';
    let content = msg.content.trim();

    if (content.length > MAX_MESSAGE_CHARS) {
      content = content.substring(0, MAX_MESSAGE_CHARS) + '\n[...truncated]';
    }

    lines.push(`${role}: ${content}`);
    lines.push('');
  }

  return lines.join('\n');
}

interface LlmRawResponse {
  projectGoal: string[];
  keyDecisions: string[];
  constraints: string[];
  implementationArtifacts: string[];
  openTasks: string[];
}

function parseResponse(text: string, messageCount: number): Snapshot {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed: LlmRawResponse;
  try {
    parsed = JSON.parse(cleaned) as LlmRawResponse;
  } catch {
    throw new LlmExtractionError(`Failed to parse LLM response as JSON: ${cleaned.substring(0, 200)}`);
  }

  const sectionKeys: (keyof LlmRawResponse)[] = [
    'projectGoal',
    'keyDecisions',
    'constraints',
    'implementationArtifacts',
    'openTasks',
  ];

  for (const key of sectionKeys) {
    if (!Array.isArray(parsed[key])) {
      parsed[key] = [];
    }
  }

  const toEntries = (items: string[]): SnapshotEntry[] =>
    items
      .filter((s) => typeof s === 'string' && s.trim().length > 0)
      .slice(0, 5)
      .map((text, i) => ({ text: text.trim(), score: 5 - i }));

  return {
    sections: {
      [SnapshotSection.ProjectGoal]: toEntries(parsed.projectGoal),
      [SnapshotSection.KeyDecisions]: toEntries(parsed.keyDecisions),
      [SnapshotSection.Constraints]: toEntries(parsed.constraints),
      [SnapshotSection.ImplementationArtifacts]: toEntries(parsed.implementationArtifacts),
      [SnapshotSection.OpenTasks]: toEntries(parsed.openTasks),
    },
    metadata: {
      messageCount,
      extractedAt: new Date().toISOString(),
      phaseDistribution: {},
    },
  };
}

export function resolveApiKey(explicitKey?: string): string | null {
  return explicitKey ?? process.env['ANTHROPIC_API_KEY'] ?? null;
}

/** Extract a structured snapshot from session messages using Claude Haiku. */
export async function llmExtractSnapshot(
  messages: SessionMessage[],
  apiKey?: string,
): Promise<Snapshot> {
  const key = resolveApiKey(apiKey);
  if (!key) {
    throw new LlmExtractionError(
      'ANTHROPIC_API_KEY environment variable is required.\n' +
        'Get your API key at https://console.anthropic.com/settings/keys\n' +
        'Then set it: export ANTHROPIC_API_KEY=sk-ant-...',
    );
  }

  const filtered = prefilterMessages(messages);
  logger.debug(`Pre-filtered ${messages.length} messages to ${filtered.length}`);

  const formattedText = formatMessagesForLlm(filtered);
  logger.debug(`Formatted text length: ${formattedText.length} chars`);

  const client = new Anthropic({ apiKey: key });

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is the session transcript to analyze:\n\n${formattedText}`,
        },
      ],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new LlmExtractionError(`API call failed: ${msg}`);
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new LlmExtractionError('No text content in API response');
  }

  logger.debug(`API response tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);

  return parseResponse(textBlock.text, messages.length);
}

import Anthropic from "@anthropic-ai/sdk";
import { tools, runTool } from "./tools";

const MODEL = "claude-haiku-5-5";

// Haiku 5.5 prices in dollars per million tokens. Update these if you change MODEL.
const INPUT_PRICE_PER_MILLION = 0.10;
const OUTPUT_PRICE_PER_MILLION = 0.50;

const SYSTEM_PROMPT = `You are patch-bot, a coding agent that fixes bugs in a code repository.

You will be given a bug report. Use your tools to explore the repository, find the cause of the bug, and fix it with the smallest change that solves the problem. All paths are relative to the repository root.

- Read the relevant code before editing it.
- Don't change code that's unrelated to the bug.
- You can't run commands or tests, so check your fix by reading the code again after editing it.
- When you're done, reply with a short summary: what caused the bug and what you changed. If you couldn't fix it, explain why.`;

/**
 * Runs the agent on a repository until it has fixed the bug (or given up).
 * @param repoPath - Full path to the repository to fix.
 * @param bugReport - The bug report, written like a person would in Slack.
 */
export async function runAgent(repoPath: string, bugReport: string) {
  // Created here, not at the top of the file: this file is imported before cli.ts loads .env
  const client = new Anthropic();

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: bugReport },
  ];

  // TODO (step 4.3, yours): turn this single call into the agent loop.
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    tools,
    messages,
  });

  console.log(JSON.stringify(response, null, 2));
  printCost(response.usage);
}

/** HELPERS */

/**
 * Helper function that calculates and prints the cost of a message based on token usage.
 * @param usage - The usage object containing input and output token counts.
 * @returns {number} - The total cost of the message based on token usage.
 */
function printCost(usage: { input_tokens: number; output_tokens: number }) {
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;

  // prices are per million tokens, so divide by 1,000,000 to get the cost of these tokens
  const inputCost = (inputTokens * INPUT_PRICE_PER_MILLION) / 1_000_000;
  const outputCost = (outputTokens * OUTPUT_PRICE_PER_MILLION) / 1_000_000;
  const totalCost = inputCost + outputCost;

  // the cost is tiny, so show 6 decimal places instead of rounding to $0.00
  console.log(`Tokens: ${inputTokens} in, ${outputTokens} out. Cost: $${totalCost.toFixed(6)}`);

  return totalCost;
}

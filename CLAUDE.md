# patch-bot

Slack bot that takes bug reports, runs a coding agent on a repo, and opens a PR.
Stack: TypeScript, Slack Bolt (Socket Mode), Octokit (GitHub App), Anthropic SDK, Docker.

## How to work with me
- I'm building this to learn. Explain what code does and why before writing it.
- For src/agents/ and src/orchestrator.ts: give hints and review my code. Don't write it unless I ask.
- Boilerplate and config are fine to write, but explain each part.
- Keep dependencies minimal. Ask before adding one.
- I haven't used much TypeScript so teach me in a way a junior dev can understand.
- Current milestone: 2 (Agent CLI).
- At the end of each milestone, give me exercises and explain-it questions; don’t solve the exercises unless I ask.

## Milestones
1. Slack echo bot
2. Agent CLI
3. GitHub App + PR
4. Wire together
5. Docker + README
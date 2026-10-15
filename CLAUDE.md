# patch-bot

Slack bot that takes bug reports, runs a coding agent on a repo, and opens a PR.
Stack: TypeScript, Slack Bolt (Socket Mode), Octokit (GitHub App), Anthropic SDK, Docker.

## How to work with me
- I'm building this to learn. Explain what code does and why before writing it.
- I write the core logic: the agent loop (src/agents/agent.ts) and src/orchestrator.ts. Give hints and review my code; don't write it unless I ask.
- Everything else (tools, Slack/GitHub plumbing, config, Docker, README): write it a whole step at a time, explain the key decisions, and ask me 1–2 "predict what this does" questions before I run it.
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
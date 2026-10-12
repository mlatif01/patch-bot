import { App } from "@slack/bolt";
import { requireEnv } from './helpers';

process.loadEnvFile();

// Ensure required environment variables are set before proceeding
requireEnv("SLACK_BOT_TOKEN");
requireEnv("SLACK_APP_TOKEN");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

app.event("app_mention", async ({ event, say }) => {
  const threadId = event.thread_ts ?? event.ts;
  const text = event.text.replace(/<@[^>]+>\s*/g, "").trim();
  await say({ text: `You said: ${text}`, thread_ts: threadId });
});

await app.start();
console.log("patch-bot is running");

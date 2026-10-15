import { App } from "@slack/bolt";
// Bolt doesn't export this type from its main entry, so we import it from the file that defines it
import type { ExtendedErrorHandlerArgs } from "@slack/bolt/dist/App";
import { requireEnv } from './helpers';

process.loadEnvFile();

const app = new App({
  token: requireEnv("SLACK_BOT_TOKEN"),
  appToken: requireEnv("SLACK_APP_TOKEN"),
  socketMode: true,
  extendedErrorHandler: true,
});

app.event("app_mention", async ({ event, say }) => {
  // grab the thread ID to reply in the same thread
  const threadId = event.thread_ts ?? event.ts;
  // Extract the text of the message, removing the mention of the bot itself.
  const text = event.text.replace(/<@[^>]+>\s*/g, "").trim();

  if (text === '') {
    await say({ text: "You didn't say anything!", thread_ts: threadId });
    return;
  }

  await say({ text: `You said: ${text}`, thread_ts: threadId });
});

app.message(async ({ message, say }) => {
  // `message` could be an edit, a deletion, a file share... Only plain messages
  // have no `subtype`, so this check narrows the type to one that has `.text`.
  if (message.subtype !== undefined) return;

  // Only echo DMs, even if we subscribe to channel messages later.
  if (message.channel_type !== "im") return;

  const text = message.text?.trim() ?? "";
  if (text === "") return;

  await say({ text: `You said: ${text}`, thread_ts: message.thread_ts });
});

// `extendedErrorHandler: true` only changes runtime behaviour, so we tell TypeScript the argument's type ourselves
app.error(async ({ error, logger, body }: ExtendedErrorHandlerArgs) => {
  // Log first, so the real error isn't lost if replying to Slack fails below
  logger.error(error);

  // is there an event in body
  if (!("event" in body)) return;

  // `body.event` is typed `any`, so TypeScript can't check it for us. Check `channel` ourselves.
  const event = body.event;
  const channel = event?.channel;
  if (!channel) return;

  // grab the thread ID to reply in the same thread
  let threadId = event.thread_ts ?? event.ts;

  // in DMs, only reply in a thread if the message was already in one (matches the DM echo)
  if (event.channel_type === "im") {
    threadId = event.thread_ts;
  }

  try {
    await app.client.chat.postMessage({ channel, text: "An error occurred.", thread_ts: threadId });
  } catch (replyError) {
    logger.error("Couldn't send the error message to Slack:", replyError);
  }
});

await app.start();
console.log("patch-bot is running");

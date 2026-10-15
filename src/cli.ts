import path from "node:path";
import { runAgent } from "./agents/agent";

process.loadEnvFile();

// Everything after `npm run agent --` ends up in process.argv, after "node" and the script path
const [repoArg, bugReport] = process.argv.slice(2);

if (!repoArg || !bugReport) {
  console.error('Usage: npm run agent -- <path-to-repo> "<bug report>"');
  process.exit(1);
}

// Turn e.g. "../buggy-repo" into a full path, based on the folder you ran the command from
await runAgent(path.resolve(repoArg), bugReport);

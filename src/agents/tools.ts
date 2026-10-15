import type { Anthropic } from "@anthropic-ai/sdk";
import path from "node:path";
import { readdir, readFile, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";

// Roughly 25K tokens. Stops one huge file from blowing up the cost of a run.
const MAX_FILE_CHARS = 100_000;

/** TOOL DEFINITIONS (what Claude sees) */

const listFilesTool: Anthropic.Tool = {
    name: "list_files",
    description:
      "List the files and folders directly inside one directory of the repository you are fixing. " +
      "Use this to explore the project's structure and find files that might be related to the bug before reading them. " +
      "Folder names end with '/'. Only one level is listed: to see inside a folder, call this tool again with that folder's path. " +
      "The .git and node_modules folders are skipped.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Directory to list, relative to the repository root. Use '.' for the root itself, or e.g. 'src' or 'src/utils' for subfolders. " +
            "Paths outside the repository are not allowed."
        }
      },
      required: ["path"]
    }
};

const readFileTool: Anthropic.Tool = {
    name: "read_file",
    description:
      "Read the full contents of a text file in the repository. " +
      "Use this to look at code before deciding on a fix, and to check a file again after editing it. " +
      `Files longer than ${MAX_FILE_CHARS} characters can't be read.`,
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File to read, relative to the repository root, e.g. 'src/cart.js'."
        }
      },
      required: ["path"]
    }
};

const editFileTool: Anthropic.Tool = {
    name: "edit_file",
    description:
      "Edit a file in the repository by replacing one exact piece of text with new text. " +
      "old_text must match the file exactly, including spaces, indentation and line breaks, and must appear exactly once in the file: " +
      "include a few surrounding lines if needed to make it unique. " +
      "Read the file first so you know its exact contents. This tool can't create or delete files.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File to edit, relative to the repository root, e.g. 'src/cart.js'."
        },
        old_text: {
          type: "string",
          description: "The exact text to replace. Must appear exactly once in the file."
        },
        new_text: {
          type: "string",
          description: "The text to put in its place."
        }
      },
      required: ["path", "old_text", "new_text"]
    }
};

// Send this whole array to Claude as `tools`
const tools: Anthropic.Tool[] = [listFilesTool, readFileTool, editFileTool];

/** RUNNING A TOOL (what your loop calls) */

/**
 * Runs the tool Claude asked for and returns its result as text.
 * Throws if the tool fails (bad path, text not found...). Your loop should catch that
 * and send the error message back to Claude so it can try again.
 */
async function runTool(repoRoot: string, name: string, input: unknown): Promise<string> {
    switch (name) {
        case "list_files":
            return listFiles(repoRoot, getStringInput(input, "path"));
        case "read_file": {
            const content = await readTextFile(repoRoot, getStringInput(input, "path"));
            // An empty string could look like the tool broke, so say so explicitly
            return content === "" ? "(empty file)" : content;
        }
        case "edit_file":
            return editFile(
                repoRoot,
                getStringInput(input, "path"),
                getStringInput(input, "old_text"),
                getStringInput(input, "new_text")
            );
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

/** TOOL IMPLEMENTATIONS */

async function listFiles(repoRoot: string, dirPath: string): Promise<string> {
    const fullPath = resolveInsideRepo(repoRoot, dirPath);

    // list the files and folders in the specified directory
    let entries: Dirent[];
    try {
        entries = await readdir(fullPath, { withFileTypes: true });
    } catch {
        // Node's own error includes the full path on this machine, so send a simpler message instead
        throw new Error(`Could not list "${dirPath}": it doesn't exist or isn't a directory.`);
    }

    const names = entries
        // Skip the .git and node_modules folders
        .filter(entry => entry.name !== ".git" && entry.name !== "node_modules")
        // Append '/' to directory names to distinguish them from files
        .map(entry => entry.isDirectory() ? `${entry.name}/` : entry.name);

    // An empty string could look like the tool broke, so say so explicitly
    if (names.length === 0) {
        return "(empty directory)";
    }

    // Join the names into a single string with each entry on a new line
    return names.join('\n');
}

async function readTextFile(repoRoot: string, filePath: string): Promise<string> {
    const fullPath = resolveInsideRepo(repoRoot, filePath);

    let content: string;
    try {
        content = await readFile(fullPath, "utf8");
    } catch {
        throw new Error(`Could not read "${filePath}": it doesn't exist or isn't a file.`);
    }

    if (content.length > MAX_FILE_CHARS) {
        throw new Error(`"${filePath}" is too large to read (${content.length} characters, limit ${MAX_FILE_CHARS}).`);
    }

    return content;
}

async function editFile(repoRoot: string, filePath: string, oldText: string, newText: string): Promise<string> {
    if (oldText === "") {
        throw new Error("old_text can't be empty.");
    }

    const content = await readTextFile(repoRoot, filePath);

    // Count matches by splitting on old_text: 1 match gives 2 pieces, 2 matches give 3, and so on
    const matches = content.split(oldText).length - 1;
    if (matches === 0) {
        throw new Error(`old_text was not found in "${filePath}". Read the file again and copy the text exactly.`);
    }
    if (matches > 1) {
        throw new Error(`old_text appears ${matches} times in "${filePath}". Include more surrounding lines so it matches exactly once.`);
    }

    // Splice the new text in by position. content.replace(oldText, newText) would treat "$" in newText
    // as a special pattern, which breaks code that contains "$", like template literals.
    const index = content.indexOf(oldText);
    const updated = content.slice(0, index) + newText + content.slice(index + oldText.length);

    await writeFile(resolveInsideRepo(repoRoot, filePath), updated, "utf8");
    return `Edited ${filePath}.`;
}

/** HELPERS */

/**
 * Turns a path from Claude into a full path, refusing anything outside the repo or inside .git.
 * (.git is blocked because files like .git/hooks/* run as programs when git commands run.)
 */
function resolveInsideRepo(repoRoot: string, relativePath: string): string {
    const fullPath = path.join(repoRoot, relativePath);

    // Checking for exactly ".." or "../" (not just "starts with ..") means a folder like "..backup" is still allowed
    const fromRoot = path.relative(repoRoot, fullPath);
    if (fromRoot === ".." || fromRoot.startsWith(`..${path.sep}`)) {
        throw new Error("Access to paths outside the repository is not allowed.");
    }
    if (fromRoot.split(path.sep)[0] === ".git") {
        throw new Error("Access to the .git folder is not allowed.");
    }

    return fullPath;
}

/** Claude's tool input arrives typed as `unknown`. Read one string field from it, or throw a clear error. */
function getStringInput(input: unknown, key: string): string {
    if (typeof input === "object" && input !== null && key in input) {
        const value = (input as Record<string, unknown>)[key];
        if (typeof value === "string") {
            return value;
        }
    }
    throw new Error(`Missing or invalid "${key}": expected a string.`);
}

export { tools, runTool };

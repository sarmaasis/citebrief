#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

function readFlag(name, fallback = null) {
  const equals = args.find((arg) => arg.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] ?? fallback;
  return fallback;
}

function hasFlag(name) {
  return args.includes(name);
}

const file = readFlag("--file", ".dev.vars");
const envName = readFlag("--env", null);
const wranglerFile = readFlag("--wrangler", "wrangler.jsonc");
const dryRun = hasFlag("--dry-run");
const allowStub = hasFlag("--allow-stub");
const includeVars = hasFlag("--include-vars");
const only = new Set(
  (readFlag("--only", "") || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean),
);

function usage() {
  console.log(`Usage:
  node scripts/push-cf-secrets.mjs [--file .dev.vars] [--env preview] [--only KEY,KEY] [--dry-run] [--allow-stub] [--include-vars]

Examples:
  node scripts/push-cf-secrets.mjs
  node scripts/push-cf-secrets.mjs --env preview
  node scripts/push-cf-secrets.mjs --only BETTER_AUTH_SECRET,DODO_PAYMENTS_WEBHOOK_KEY
`);
}

if (hasFlag("--help") || hasFlag("-h")) {
  usage();
  process.exit(0);
}

function stripInlineComment(value) {
  let quote = null;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if ((ch === `"` || ch === `'`) && value[i - 1] !== "\\") {
      quote = quote === ch ? null : quote || ch;
    }
    if (ch === "#" && !quote) {
      const prev = value[i - 1];
      if (!prev || /\s/.test(prev)) return value.slice(0, i).trim();
    }
  }
  return value.trim();
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith(`"`) && trimmed.endsWith(`"`)) ||
    (trimmed.startsWith(`'`) && trimmed.endsWith(`'`))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseDevVars(source) {
  const entries = [];
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      console.warn(`Skipping unparsable line: ${rawLine}`);
      continue;
    }
    const key = match[1];
    const value = unquote(stripInlineComment(match[2] ?? ""));
    entries.push([key, value]);
  }
  return entries;
}

function isStubValue(value) {
  return !value || value === "stub" || value.startsWith("stub-");
}

function stripJsoncComments(input) {
  let out = "";
  let quote = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        out += ch;
      }
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (!quote && ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (!quote && ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if ((ch === `"` || ch === `'`) && input[i - 1] !== "\\") {
      quote = quote === ch ? null : quote || ch;
    }
    out += ch;
  }
  return out;
}

function collectVarKeys(config, targetEnvName) {
  const keys = new Set();
  const addVars = (vars) => {
    if (!vars || typeof vars !== "object") return;
    for (const key of Object.keys(vars)) keys.add(key);
  };
  addVars(config.vars);
  if (targetEnvName && config.env?.[targetEnvName]) {
    addVars(config.env[targetEnvName].vars);
  }
  return keys;
}

let source;
try {
  source = readFileSync(file, "utf8");
} catch (error) {
  console.error(`Could not read ${file}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

let wranglerVarKeys = new Set();
try {
  const rawWrangler = readFileSync(wranglerFile, "utf8");
  const config = JSON.parse(stripJsoncComments(rawWrangler));
  wranglerVarKeys = collectVarKeys(config, envName);
} catch (error) {
  console.warn(
    `Could not inspect ${wranglerFile}; continuing without vars conflict checks: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

const allEntries = parseDevVars(source);
const entries = allEntries.filter(([key]) => only.size === 0 || only.has(key));

if (entries.length === 0) {
  console.log(`No matching keys found in ${file}.`);
  process.exit(0);
}

const target = envName ? `Cloudflare env "${envName}"` : "Cloudflare production env";
console.log(`Pushing ${entries.length} secret(s) from ${file} to ${target}.`);

let pushed = 0;
let skipped = 0;

for (const [key, value] of entries) {
  if (wranglerVarKeys.has(key) && !includeVars) {
    console.log(`- ${key}: skipped because it is already defined in ${wranglerFile} vars`);
    skipped += 1;
    continue;
  }

  if (isStubValue(value) && !allowStub) {
    console.log(`- ${key}: skipped stub/empty value`);
    skipped += 1;
    continue;
  }

  const command = ["wrangler", "secret", "put", key];
  command.push("--env", envName ?? "");

  if (dryRun) {
    console.log(`- ${key}: dry run (${["npx", ...command].join(" ")})`);
    continue;
  }

  console.log(`- ${key}: pushing`);
  const result = spawnSync("npx", command, {
    input: `${value}\n`,
    stdio: ["pipe", "inherit", "inherit"],
    shell: false,
  });

  if (result.status !== 0) {
    console.error(`Failed to push ${key}.`);
    process.exit(result.status ?? 1);
  }

  pushed += 1;
}

console.log(`Done. Pushed ${pushed}; skipped ${skipped}.`);

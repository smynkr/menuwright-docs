import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CLOUDFLARE_GLM_53_MODEL,
  GLM_PROVIDER_DEFAULTS,
  GLM_REASONING_EFFORTS,
  backendReceiptLabel,
  buildApiHeaders,
  buildApiRequestBody,
  nonGithubChildEnv,
  parseSSEPayload,
  retryAfterDelayMs,
  validateCloudflareGlm53Config,
  validateGlmReasoningEffort,
} from "../docs-agent.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const driverPath = path.resolve(testDir, "..", "docs-agent.mjs");

function command(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(" ")} exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
  return result;
}

function writeExecutable(filePath, source) {
  writeFileSync(filePath, source, "utf8");
  chmodSync(filePath, 0o755);
}

// The sandbox docs repo mirrors the axiom-docs invariants the driver relies on:
//   - CANONICAL flat sources live at <product>/*.mdx at the repo root;
//   - content/docs/ is generated output, rebuilt by _migration/tools/run-migration.mjs;
//   - docs.json is the navigation source of truth;
//   - the default branch is whatever the remote says (main in most fixtures,
//     "trunk" in the base-branch auto-detection test — the hardcoded-"main"
//     bug this suite locks down).
function setupSandbox({
  existingContent,
  backendOutput,
  product = "layer",
  defaultBranch = "main",
  seedDocsJson = true,
  seedMemoryManifest = false,
  fakeMemoryGenerate = false,
  filesApiFixture = null,
}) {
  const root = mkdtempSync(path.join(tmpdir(), "docs-agent-regression-"));
  const binDir = path.join(root, "bin");
  const sourceRepo = path.join(root, "source");
  const docsRemote = path.join(root, "docs-remote.git");
  const docsRepo = path.join(root, "docs");
  const backendOutputPath = path.join(root, "backend-output.txt");
  const ghLogPath = path.join(root, "gh.log");
  const backendEnvLogPath = path.join(root, "backend-env.log");
  const migrationEnvLogPath = path.join(root, "migration-env.log");
  const prBodyPath = path.join(root, "pr-body.md");
  const backendPath = path.join(binDir, "backend-stub.mjs");
  const ghPath = path.join(binDir, "gh");

  mkdirSync(binDir, { recursive: true });
  writeFileSync(backendOutputPath, backendOutput, "utf8");
  writeExecutable(
    backendPath,
    `#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
const credentialKeys = [
  "DOCS_AGENT_SOURCE_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "DOCS_REPO_PAT",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_KEY_0",
  "GIT_CONFIG_VALUE_0",
  "GIT_CONFIG_PARAMETERS",
];
if (process.env.DOCS_AGENT_BACKEND_ENV_LOG) {
  const env = Object.fromEntries(credentialKeys.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
  writeFileSync(
    process.env.DOCS_AGENT_BACKEND_ENV_LOG,
    JSON.stringify({ args: process.argv.slice(2), env }) + "\\n",
    { flag: "a" },
  );
}
if (process.argv.includes("--version")) process.exit(0);
process.stdin.resume();
process.stdin.on("end", () => process.stdout.write(readFileSync(process.env.DOCS_AGENT_STUB_OUTPUT_FILE, "utf8")));
`,
  );
  writeExecutable(
    ghPath,
    `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCS_AGENT_GH_LOG"
if [ "$1" = "--version" ]; then
  echo "gh version fake"
  exit 0
fi
if [ "$1" = "repo" ] && [ "$2" = "view" ]; then
  printf '{"defaultBranchRef":{"name":"%s"}}\\n' "$DOCS_AGENT_STUB_DEFAULT_BRANCH"
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "view" ]; then
  echo '{"title":"Oversized PR","body":"(body)","url":"https://example.test/pr/123","mergedAt":"2026-08-01T00:00:00Z","state":"MERGED","files":[],"number":123}'
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "diff" ]; then
  echo "could not find pull request diff: HTTP 406: Sorry, the diff exceeded the maximum number of lines (20000) (https://api.github.com/repos/example/product/pulls/123)" >&2
  echo "PullRequest.diff too_large" >&2
  exit 1
fi
if [ "$1" = "api" ]; then
  cat "$DOCS_AGENT_STUB_FILES_JSON"
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "list" ]; then
  echo "[]"
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "create" ]; then
  if [ "\${11}" = "--body-file" ] && [ -n "$DOCS_AGENT_PR_BODY_CAPTURE" ]; then
    cat "\${12}" > "$DOCS_AGENT_PR_BODY_CAPTURE"
  fi
  echo "https://example.test/docs/pull/1"
  exit 0
fi
echo "unexpected gh invocation: $*" >&2
exit 1
`,
  );

  if (fakeMemoryGenerate) {
    // A fake `npm` that stands in for `npm run memory:generate` (which needs
    // the real sot_wiki python scripts): rewrites the manifest so it becomes
    // dirty and therefore stageable.
    writeExecutable(
      path.join(binDir, "npm"),
      `#!/bin/sh
if [ "$1" = "run" ] && [ "$2" = "memory:generate" ]; then
  printf '{ "fresh": true }\n' > "$PWD/docs/wiki/_sources.json"
  printf '# fresh index\n' > "$PWD/docs/AGENT_SOT.md"
  exit 0
fi
exit 1
`,
    );
  }

  command("git", ["init", "--bare", docsRemote]);
  command("git", ["clone", docsRemote, docsRepo]);
  command("git", ["-C", docsRepo, "checkout", "-b", defaultBranch]);
  command("git", ["-C", docsRepo, "config", "user.name", "docs-agent test bot"]);
  command("git", ["-C", docsRepo, "config", "user.email", "docs-agent-test@example.test"]);

  // Canonical flat source.
  mkdirSync(path.join(docsRepo, product), { recursive: true });
  writeFileSync(path.join(docsRepo, product, "reference.mdx"), existingContent, "utf8");
  command("git", ["-C", docsRepo, "add", `${product}/reference.mdx`]);

  // Keep the node_modules sentinel out of git, as in the real repo.
  writeFileSync(path.join(docsRepo, ".gitignore"), "node_modules/\n", "utf8");
  command("git", ["-C", docsRepo, "add", ".gitignore"]);

  // Navigation source of truth — shaped like the REAL docs.json: capitalized
  // product names and pages nested under tabs[].groups[].pages (the shapes
  // the additive docs.json gate must actually handle).
  const productName = product.charAt(0).toUpperCase() + product.slice(1);
  if (seedDocsJson) {
    writeFileSync(
      path.join(docsRepo, "docs.json"),
      `${JSON.stringify({ name: "Axiom", navigation: { products: [{ product: productName, tabs: [{ tab: "Docs", groups: [{ group: "Overview", pages: [`${product}/reference`] }] }] }] } }, null, 2)}\n`,
      "utf8",
    );
    command("git", ["-C", docsRepo, "add", "docs.json"]);
  }

  // Memory-manifest sentinel: real docs repos carry docs/wiki/_sources.json
  // + docs/AGENT_SOT.md, which the "Validate canonical memory" gate checks.
  if (seedMemoryManifest) {
    mkdirSync(path.join(docsRepo, "docs", "wiki"), { recursive: true });
    writeFileSync(path.join(docsRepo, "docs", "wiki", "_sources.json"), '{}\n', "utf8");
    writeFileSync(path.join(docsRepo, "docs", "AGENT_SOT.md"), "# index\n", "utf8");
    command("git", ["-C", docsRepo, "add", "docs/wiki/_sources.json", "docs/AGENT_SOT.md"]);
  }

  // Generation stub: copies each flat product tree into content/docs/<product>,
  // standing in for _migration/tools/run-migration.mjs. Resolves the repo root
  // from its own location (two levels up from _migration/tools/).
  const migrationDir = path.join(docsRepo, "_migration", "tools");
  mkdirSync(migrationDir, { recursive: true });
  writeFileSync(
    path.join(migrationDir, "run-migration.mjs"),
    `#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const credentialKeys = [
  "DOCS_AGENT_SOURCE_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "DOCS_REPO_PAT",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_KEY_0",
  "GIT_CONFIG_VALUE_0",
  "GIT_CONFIG_PARAMETERS",
];
if (process.env.DOCS_AGENT_MIGRATION_ENV_LOG) {
  const env = Object.fromEntries(credentialKeys.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
  writeFileSync(process.env.DOCS_AGENT_MIGRATION_ENV_LOG, JSON.stringify(env), "utf8");
}
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dest = path.join(repoRoot, "content", "docs");
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const entry of readdirSync(repoRoot)) {
  const dir = path.join(repoRoot, entry);
  if (!statSync(dir).isDirectory()) continue;
  if (entry.startsWith(".") || entry === "content" || entry === "node_modules" || entry === "_migration") continue;
  if (!existsSync(dir)) continue;
  cpSync(dir, path.join(dest, entry), { recursive: true });
}
console.log(JSON.stringify({ stub: true, destination: dest }));
`,
    "utf8",
  );
  command("git", ["-C", docsRepo, "add", "_migration/tools/run-migration.mjs"]);

  // The driver requires node_modules before running the regeneration.
  mkdirSync(path.join(docsRepo, "node_modules"), { recursive: true });
  writeFileSync(path.join(docsRepo, "node_modules", ".keep"), "", "utf8");

  command("git", ["-C", docsRepo, "commit", "-m", "seed docs"]);
  command("git", ["-C", docsRepo, "push", "-u", "origin", defaultBranch]);
  command("git", ["--git-dir", docsRemote, "symbolic-ref", "HEAD", `refs/heads/${defaultBranch}`]);

  command("git", ["init", sourceRepo]);
  command("git", ["-C", sourceRepo, "config", "user.name", "docs-agent test bot"]);
  command("git", ["-C", sourceRepo, "config", "user.email", "docs-agent-test@example.test"]);
  mkdirSync(path.join(sourceRepo, "src"), { recursive: true });
  writeFileSync(path.join(sourceRepo, "src", "feature.js"), "export const feature = false;\n", "utf8");
  command("git", ["-C", sourceRepo, "add", "src/feature.js"]);
  command("git", ["-C", sourceRepo, "commit", "-m", "seed source"]);
  writeFileSync(path.join(sourceRepo, "src", "feature.js"), "export const feature = true;\n", "utf8");
  command("git", ["-C", sourceRepo, "commit", "-am", "user-facing change"]);

  // Fixture for the pulls/N/files API fallback (the gh stub `cat`s it).
  const filesApiFixturePath = path.join(root, "files-api-fixture.json");
  if (filesApiFixture) {
    writeFileSync(filesApiFixturePath, JSON.stringify(filesApiFixture), "utf8");
  }

  return {
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
    docsRemote,
    docsRepo,
    ghLogPath,
    backendEnvLogPath,
    migrationEnvLogPath,
    prBodyPath,
    sourceRepo,
    logDir: path.join(root, "logs"),
    run({ prMode = false } = {}) {
      return spawnSync(
        process.execPath,
        [
          driverPath,
          "--repo", "example/product",
          ...(prMode ? ["--pr", "123"] : ["--range", "HEAD~1..HEAD"]),
          "--docs-repo", "example/docs",
          "--docs-repo-path", docsRepo,
          "--product", product,
          "--backend", "claude",
        ],
        {
          cwd: sourceRepo,
          encoding: "utf8",
          env: {
            ...process.env,
            DOCS_AGENT_SOURCE_TOKEN: "source-token",
            GH_TOKEN: "destination-token",
            GITHUB_TOKEN: "github-token",
            DOCS_REPO_PAT: "docs-repo-pat",
            GIT_CONFIG_COUNT: "1",
            GIT_CONFIG_KEY_0: "credential.helper",
            GIT_CONFIG_VALUE_0: "store",
            GIT_CONFIG_PARAMETERS: "credential.helper=store",
            DOCS_AGENT_CLAUDE_CMD: backendPath,
            DOCS_AGENT_GH_LOG: ghLogPath,
            DOCS_AGENT_BACKEND_ENV_LOG: backendEnvLogPath,
            DOCS_AGENT_MIGRATION_ENV_LOG: migrationEnvLogPath,
            DOCS_AGENT_PR_BODY_CAPTURE: prBodyPath,
            DOCS_AGENT_LOG_DIR: path.join(root, "logs"),
            DOCS_AGENT_STUB_OUTPUT_FILE: backendOutputPath,
            DOCS_AGENT_STUB_DEFAULT_BRANCH: defaultBranch,
            DOCS_AGENT_STUB_FILES_JSON: filesApiFixturePath,
            PATH: `${binDir}:${process.env.PATH}`,
          },
        },
      );
    },
  };
}

function fileBlock(content, filePath = "layer/reference.mdx") {
  // The END marker follows the exact file bytes. It begins a fresh line only
  // when the file itself ends in a newline.
  return `===FILE: ${filePath}===\n${content}===END===\n`;
}

function ghCalls(logPath) {
  try {
    return readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function committedFiles(docsRepo) {
  return command("git", ["-C", docsRepo, "show", "--name-only", "--format=", "HEAD"])
    .stdout.trim()
    .split("\n")
    .filter(Boolean);
}

test("T1: byte-identical file blocks do not create branches, commits, or PRs", async (t) => {
  for (const existingContent of ["# Reference\n", "# Reference without final newline"]) {
    await t.test(JSON.stringify(existingContent), () => {
      const sandbox = setupSandbox({ existingContent, backendOutput: fileBlock(existingContent) });
      t.after(() => sandbox.cleanup());
      const result = sandbox.run();

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /No-op\. NOT opening a PR/);
      assert.deepEqual(
        command("git", ["--git-dir", sandbox.docsRemote, "for-each-ref", "--format=%(refname)", "refs/heads"])
          .stdout.trim()
          .split("\n"),
        ["refs/heads/main"],
      );
      assert.equal(command("git", ["-C", sandbox.docsRepo, "status", "--short"]).stdout, "");
      assert.equal(readFileSync(path.join(sandbox.docsRepo, "layer", "reference.mdx"), "utf8"), existingContent);
      assert.deepEqual(ghCalls(sandbox.ghLogPath), ["--version"]);
    });
  }
});

test("T2: changed content writes the flat source, regenerates content/docs, and commits both", (t) => {
  const changedContent = "# Reference\n\nUpdated behavior.\n";
  const sandbox = setupSandbox({ existingContent: "# Reference\n", backendOutput: fileBlock(changedContent) });
  t.after(() => sandbox.cleanup());
  const result = sandbox.run();

  assert.equal(result.status, 0, result.stderr);
  // Canonical flat source updated...
  assert.equal(readFileSync(path.join(sandbox.docsRepo, "layer", "reference.mdx"), "utf8"), changedContent);
  // ...and the generated tree was rebuilt from it by the migration step.
  assert.equal(readFileSync(path.join(sandbox.docsRepo, "content", "docs", "layer", "reference.mdx"), "utf8"), changedContent);
  assert.match(command("git", ["-C", sandbox.docsRepo, "branch", "--show-current"]).stdout, /^docs-agent\/layer-range-/);
  assert.equal(command("git", ["-C", sandbox.docsRepo, "rev-list", "--count", "origin/main..HEAD"]).stdout.trim(), "1");
  // The commit carries both the canonical edit and the regenerated output —
  // and nothing else.
  const files = committedFiles(sandbox.docsRepo);
  assert.ok(files.includes("layer/reference.mdx"), `commit missing flat source: ${files}`);
  assert.ok(files.includes("content/docs/layer/reference.mdx"), `commit missing regenerated output: ${files}`);
  const calls = ghCalls(sandbox.ghLogPath);
  assert.deepEqual(calls.map((call) => call.split(" ").slice(0, 2).join(" ")), [
    "--version",
    "repo view",
    "pr list",
    "pr create",
  ]);
  assert.match(calls.at(-1), /--base main/);
  const backendEnvRecords = readFileSync(sandbox.backendEnvLogPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert.equal(backendEnvRecords.length, 2, "version probe and backend invocation must both be observed");
  for (const record of backendEnvRecords) {
    assert.deepEqual(record.env, {}, `backend received GitHub credentials: ${JSON.stringify(record)}`);
  }
  assert.deepEqual(
    JSON.parse(readFileSync(sandbox.migrationEnvLogPath, "utf8")),
    {},
    "migration tooling must not receive GitHub credentials",
  );
  const prBody = readFileSync(sandbox.prBodyPath, "utf8");
  assert.match(
    prBody,
    /backend: \*\*claude\*\* \(command: `[^`]+ -p --output-format text`\)/,
    "generated PR body must include the resolved backend receipt",
  );
});


test("non-GitHub child environments remove all repository credentials and config injection", () => {
  const scrubbed = nonGithubChildEnv({
    PATH: "/usr/bin",
    DOCS_AGENT_SOURCE_TOKEN: "source-token",
    GH_TOKEN: "gh-token",
    GITHUB_TOKEN: "github-token",
    DOCS_REPO_PAT: "docs-pat",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "credential.helper",
    GIT_CONFIG_VALUE_0: "store",
    GIT_CONFIG_KEY_7: "credential.helper",
    GIT_CONFIG_VALUE_7: "cache",
    GIT_CONFIG_PARAMETERS: "credential.helper=store",
    GIT_CONFIG_GLOBAL: "/tmp/credentials",
  });
  assert.equal(scrubbed.PATH, "/usr/bin");
  for (const key of [
    "DOCS_AGENT_SOURCE_TOKEN",
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "DOCS_REPO_PAT",
    "GIT_CONFIG_COUNT",
    "GIT_CONFIG_KEY_0",
    "GIT_CONFIG_VALUE_0",
    "GIT_CONFIG_KEY_7",
    "GIT_CONFIG_VALUE_7",
    "GIT_CONFIG_PARAMETERS",
    "GIT_CONFIG_GLOBAL",
  ]) {
    assert.equal(scrubbed[key], undefined, `${key} must not reach a non-GitHub child`);
  }
});
test("T9: memory-manifest regeneration failure aborts the draft (fail closed)", (t) => {
  const changedContent = "# Reference\n\nUpdated again.\n";
  const sandbox = setupSandbox({
    existingContent: "# Reference\n",
    backendOutput: fileBlock(changedContent),
    seedMemoryManifest: true, // docs/wiki/_sources.json + AGENT_SOT.md present
  });
  t.after(() => sandbox.cleanup());
  const result = sandbox.run();

  // The fixture has no `npm run memory:generate` (no package.json scripts).
  // A draft whose canonical edits leave the memory manifests stale fails the
  // docs repo's memory gate on arrival, so the driver must refuse to open it:
  // non-zero exit, the failure diagnostic, and NO commit/PR.
  assert.notEqual(result.status, 0, "driver must fail closed when memory:generate fails");
  const allOutput = `${result.stdout}\n${result.stderr}`;
  assert.match(allOutput, /memory:generate failed/);
  assert.match(allOutput, /refusing to open a draft/);
  const calls = ghCalls(sandbox.ghLogPath);
  assert.ok(!calls.some((call) => call.includes("pr create")), "no PR may open when the memory gate fails");
});

test("T9b: memory-manifest regeneration success stages the fresh manifest", (t) => {
  const changedContent = "# Reference\n\nUpdated once more.\n";
  const sandbox = setupSandbox({
    existingContent: "# Reference\n",
    backendOutput: fileBlock(changedContent),
    seedMemoryManifest: true,
    fakeMemoryGenerate: true, // npm run memory:generate "succeeds"
  });
  t.after(() => sandbox.cleanup());
  const result = sandbox.run();

  assert.equal(result.status, 0, result.stderr);
  // The fresh manifest is regenerated and staged alongside the canonical edit
  // and generated output, so the draft PR passes "Validate canonical memory".
  const files = committedFiles(sandbox.docsRepo);
  assert.ok(files.includes("layer/reference.mdx"), `commit missing flat source: ${files}`);
  assert.ok(files.includes("content/docs/layer/reference.mdx"), `commit missing regenerated output: ${files}`);
  assert.ok(files.includes("docs/wiki/_sources.json"), `commit missing regenerated manifest: ${files}`);
  assert.ok(files.includes("docs/AGENT_SOT.md"), `commit missing regenerated AGENT_SOT: ${files}`);
});

test("T3: base branch is auto-detected from the docs repo, not hardcoded to main", (t) => {
  const changedContent = "# Reference\n\nUpdated on a master-style repo.\n";
  const sandbox = setupSandbox({
    existingContent: "# Reference\n",
    backendOutput: fileBlock(changedContent),
    defaultBranch: "trunk",
  });
  t.after(() => sandbox.cleanup());
  const result = sandbox.run();

  assert.equal(result.status, 0, result.stderr);
  assert.equal(command("git", ["-C", sandbox.docsRepo, "rev-list", "--count", "origin/trunk..HEAD"]).stdout.trim(), "1");
  assert.match(ghCalls(sandbox.ghLogPath).at(-1), /--base trunk/);
});

test("T4: Invest is a supported docs-agent product", (t) => {
  const changedContent = "# Invest reference\n\nUpdated paper-trading behavior.\n";
  const sandbox = setupSandbox({
    existingContent: "# Invest reference\n",
    backendOutput: fileBlock(changedContent, "invest/reference.mdx"),
    product: "invest",
  });
  t.after(() => sandbox.cleanup());
  const result = sandbox.run();

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(path.join(sandbox.docsRepo, "invest", "reference.mdx"), "utf8"),
    changedContent,
  );
  assert.match(command("git", ["-C", sandbox.docsRepo, "branch", "--show-current"]).stdout, /^docs-agent\/invest-range-/);
});

test("T5: legacy content/docs/<product> paths are remapped to the canonical flat source", (t) => {
  const changedContent = "# Reference\n\nRemapped from the generated tree.\n";
  const sandbox = setupSandbox({
    existingContent: "# Reference\n",
    backendOutput: fileBlock(changedContent, "content/docs/layer/reference.mdx"),
  });
  t.after(() => sandbox.cleanup());
  const result = sandbox.run();

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /remapping generated path/);
  assert.equal(readFileSync(path.join(sandbox.docsRepo, "layer", "reference.mdx"), "utf8"), changedContent);
  assert.equal(readFileSync(path.join(sandbox.docsRepo, "content", "docs", "layer", "reference.mdx"), "utf8"), changedContent);
});

test("T6: docs.json may be rewritten for new-page navigation, but invalid JSON fails closed", async (t) => {
  await t.test("valid docs.json rewrite is committed", () => {
    const newDocsJson = `${JSON.stringify({ name: "Axiom", navigation: { products: [{ product: "Layer", tabs: [{ tab: "Docs", groups: [{ group: "Overview", pages: ["layer/reference", "layer/new-page"] }] }] }] } }, null, 2)}\n`;
    const sandbox = setupSandbox({
      existingContent: "# Reference\n",
      backendOutput:
        fileBlock("# Reference\n\nUpdated.\n") +
        fileBlock(newDocsJson, "docs.json"),
    });
    t.after(() => sandbox.cleanup());
    const result = sandbox.run();

    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(path.join(sandbox.docsRepo, "docs.json"), "utf8"), newDocsJson);
    assert.ok(committedFiles(sandbox.docsRepo).includes("docs.json"));
  });

  await t.test("invalid docs.json fails without a PR", () => {
    const sandbox = setupSandbox({
      existingContent: "# Reference\n",
      backendOutput:
        fileBlock("# Reference\n\nUpdated.\n") +
        fileBlock("{ not valid json", "docs.json"),
    });
    t.after(() => sandbox.cleanup());
    const result = sandbox.run();

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /docs\.json that is not valid JSON/);
  });
});

test("T7: paths outside the product's canonical sources are rejected fail-closed", async (t) => {
  for (const [name, badPath] of [
    ["another product's flat source", "overwatch/reference.mdx"],
    ["generated tree of another product", "content/docs/overwatch/reference.mdx"],
    ["application code", "app/layout.tsx"],
    ["generated meta.json", "content/docs/layer/meta.json"],
    ["path traversal", "layer/../secrets.mdx"],
  ]) {
    await t.test(name, () => {
      const sandbox = setupSandbox({
        existingContent: "# Reference\n",
        backendOutput: fileBlock("# Evil\n", badPath),
      });
      t.after(() => sandbox.cleanup());
      const result = sandbox.run();

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /disallowed file path/);
      assert.deepEqual(ghCalls(sandbox.ghLogPath), ["--version"]);
    });
  }
});

test("T9: a dirty docs checkout fails closed before any commit", async (t) => {
  for (const [name, makeDirty] of [
    ["untracked leftover", (repo) => writeFileSync(path.join(repo, "stray-local-file.txt"), "junk\n", "utf8")],
    ["modified tracked page", (repo) => writeFileSync(path.join(repo, "layer", "reference.mdx"), "# half-finished manual edit\n", "utf8")],
  ]) {
    await t.test(name, () => {
      const sandbox = setupSandbox({
        existingContent: "# Reference\n",
        backendOutput: fileBlock("# Reference\n\nUpdated behavior.\n"),
      });
      t.after(() => sandbox.cleanup());
      makeDirty(sandbox.docsRepo);
      const result = sandbox.run();

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /uncommitted changes/);
      // No branch was pushed and nothing was committed.
      assert.deepEqual(
        command("git", ["--git-dir", sandbox.docsRemote, "for-each-ref", "--format=%(refname)", "refs/heads"])
          .stdout.trim()
          .split("\n"),
        ["refs/heads/main"],
      );
    });
  }
});

test("T10: a docs.json that removes navigation fails closed", (t) => {
  const destructiveDocsJson = `${JSON.stringify({ name: "Axiom", navigation: { products: [{ product: "Layer", tabs: [{ tab: "Docs", groups: [{ group: "Overview", pages: [] }] }] }] } }, null, 2)}\n`;
  const sandbox = setupSandbox({
    existingContent: "# Reference\n",
    backendOutput:
      fileBlock("# Reference\n\nUpdated.\n") +
      fileBlock(destructiveDocsJson, "docs.json"),
  });
  t.after(() => sandbox.cleanup());
  const result = sandbox.run();

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /removes .* navigation page/);
  // The flat source was never written — validation precedes all writes.
  assert.equal(readFileSync(path.join(sandbox.docsRepo, "layer", "reference.mdx"), "utf8"), "# Reference\n");
});

test("T11: oversized PR diffs fall back to per-file patches without corruption", (t) => {
  const sandbox = setupSandbox({
    existingContent: "# Reference\n",
    backendOutput: "===NO-DOC-CHANGE===\nInternal-only changes.\n",
    filesApiFixture: [
      {
        filename: "src/matrix.py",
        status: "modified",
        // `][` inside a patch must survive verbatim — the retired page-merge
        // regex rewrote it to `,` and silently corrupted the diff.
        patch: "@@ -1 +1 @@\n-value = arr[i][j]\n+value = arr[i][j] + extra[0][1]",
      },
      { filename: "assets/huge-generated-file.bin" }, // no patch → disclosed as oversized
    ],
  });
  t.after(() => sandbox.cleanup());
  const result = sandbox.run({ prMode: true });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /falling back to per-file API patches/);
  const promptFile = command("sh", ["-c", `ls ${sandbox.logDir}/*-prompt.txt`]).stdout.trim();
  const prompt = readFileSync(promptFile, "utf8");
  assert.ok(prompt.includes("arr[i][j]"), "patch content was corrupted");
  assert.ok(prompt.includes("assets/huge-generated-file.bin"), "patch-less file not disclosed to the model");
  assert.ok(prompt.includes("too large for the GitHub API"), "missing incomplete-diff section");
});

test("API headers route only configured calls through Cloudflare Gateway privately", () => {
  const base = { apiKey: "secret", gatewayId: "" };
  assert.deepEqual(buildApiHeaders(base), {
    "Content-Type": "application/json",
    "Authorization": "Bearer secret",
  });
  assert.deepEqual(buildApiHeaders({ ...base, gatewayId: "default" }), {
    "Content-Type": "application/json",
    "Authorization": "Bearer secret",
    "cf-aig-gateway-id": "default",
    "cf-aig-collect-log-payload": "false",
  });
});

test("GLM backend resolves the Cloudflare 5.3 Flash default model", () => {
  const source = `const m = await import(${JSON.stringify(driverPath)}); process.stdout.write(m.backendReceiptLabel("glm"));`;
  const childEnv = {
    ...process.env,
    DOCS_AGENT_GLM_API_BASE: "https://api.cloudflare.com/client/v4/accounts/00000000000000000000000000000000/ai/v1",
    GLM_API_KEY: "test-key",
  };
  delete childEnv.DOCS_AGENT_GLM_MODEL;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    env: childEnv,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /model: `@cf\/zai-org\/glm-5\.3-flash`/);
});

test("exact Cloudflare GLM model always enters the fail-closed account/base gate", () => {
  const backend = { model: CLOUDFLARE_GLM_53_MODEL, apiBase: "https://generic.example/v1" };
  const missingAccount = validateCloudflareGlm53Config(backend, {
    accountId: "",
    apiBase: backend.apiBase,
  });
  assert.equal(missingAccount.cloudflareMode, true);
  assert.match(missingAccount.error, /CLOUDFLARE_ACCOUNT_ID/);

  const accountId = "a".repeat(32);
  const staleBase = validateCloudflareGlm53Config(backend, {
    accountId,
    apiBase: "https://api.cloudflare.com/client/v4/accounts/stale/ai/v1",
  });
  assert.equal(staleBase.cloudflareMode, true);
  assert.match(staleBase.error, /exactly the Cloudflare account endpoint/);

  assert.deepEqual(
    validateCloudflareGlm53Config(backend, {
      accountId,
      apiBase: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
    }),
    { cloudflareMode: true, error: null },
  );
});

const TASK1_PROVIDER_BODY = Object.freeze({
  model: "@cf/zai-org/glm-5.3-flash",
  messages: [{ role: "user", content: "prompt" }],
  temperature: 0.2,
  max_tokens: 49152,
  reasoning_effort: "high",
  stream: true,
});

function normalizeProviderBody(body) {
  return {
    model: body.model,
    messages: body.messages?.map(({ role, content }) => ({ role, content })),
    temperature: body.temperature,
    max_tokens: body.max_tokens,
    reasoning_effort: body.reasoning_effort ?? null,
    stream: body.stream,
  };
}

test("normalized GLM provider body matches the Task 1 Cloudflare contract", () => {
  const backend = {
    model: GLM_PROVIDER_DEFAULTS.model,
    maxTokens: GLM_PROVIDER_DEFAULTS.maxTokens,
    reasoningEffort: GLM_PROVIDER_DEFAULTS.reasoningEffort,
  };
  assert.deepEqual(
    normalizeProviderBody(buildApiRequestBody(backend, "prompt", true)),
    TASK1_PROVIDER_BODY,
  );
  for (const reasoningEffort of GLM_REASONING_EFFORTS) {
    assert.equal(
      buildApiRequestBody({ ...backend, reasoningEffort }, "prompt", true).reasoning_effort,
      reasoningEffort,
    );
  }

  const cloudflare52 = buildApiRequestBody(
    { ...backend, model: "@cf/zai-org/glm-5.2" },
    "prompt",
    true,
  );
  assert.equal(Object.hasOwn(cloudflare52, "reasoning_effort"), false);
  const generic53 = buildApiRequestBody(backend, "prompt", false);
  assert.equal(Object.hasOwn(generic53, "reasoning_effort"), false);
});

test("GLM reasoning validation is limited to exact Cloudflare GLM-5.3-Flash", () => {
  const backend = {
    model: GLM_PROVIDER_DEFAULTS.model,
    reasoningEffort: GLM_PROVIDER_DEFAULTS.reasoningEffort,
    reasoningEffortEnv: "DOCS_AGENT_GLM_REASONING_EFFORT",
  };
  for (const value of ["", "none", "max", "xhigh", "HIGH"]) {
    assert.match(
      validateGlmReasoningEffort(backend, true, value),
      /must be low, medium, or high/,
    );
  }
  assert.equal(
    validateGlmReasoningEffort({ ...backend, model: "@cf/zai-org/glm-5.2" }, true, "bogus"),
    null,
  );
  for (const value of GLM_REASONING_EFFORTS) {
    assert.equal(validateGlmReasoningEffort(backend, true, value), null);
  }
  assert.equal(validateGlmReasoningEffort(backend, false, "bogus"), null);
});

test("Retry-After parsing uses seconds, HTTP-date, default, and a five-second cap", () => {
  const headers = (value) => new Headers(value === undefined ? {} : { "Retry-After": value });
  assert.equal(retryAfterDelayMs(headers("2"), 1_000), 2_000);
  assert.equal(retryAfterDelayMs(headers(new Date(4_000).toUTCString()), 1_000), 3_000);
  assert.equal(retryAfterDelayMs(headers(undefined), 1_000), 250);
  assert.equal(retryAfterDelayMs(headers("99"), 1_000), 5_000);
});

const TASK1_WORKFLOW_PROVIDER_FIXTURE = Object.freeze({
  source: "DOCS_AGENT_SOURCE_TOKEN: ${{ github.token }}",
  destination: "GH_TOKEN: ${{ secrets.DOCS_REPO_PAT }}",
  account: "CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}",
  secret: "GLM_API_KEY: ${{ secrets.CLOUDFLARE_WORKERS_AI_TOKEN }}",
  base: "DOCS_AGENT_GLM_API_BASE: ${{ vars.DOCS_AGENT_GLM_API_BASE }}",
  model: "DOCS_AGENT_GLM_MODEL: ${{ vars.DOCS_AGENT_GLM_MODEL }}",
  maxTokens: "DOCS_AGENT_GLM_MAX_TOKENS: ${{ vars.DOCS_AGENT_GLM_MAX_TOKENS }}",
  reasoning: "DOCS_AGENT_GLM_REASONING_EFFORT: ${{ vars.DOCS_AGENT_GLM_REASONING_EFFORT || 'high' }}",
  gateway: "DOCS_AGENT_GLM_GATEWAY_ID: ${{ vars.DOCS_AGENT_GLM_GATEWAY_ID }}",
});

function normalizeWorkflowFixtureLine(line) {
  return line.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
}

test("normalized hosted workflow provider block matches Task 1 without changing standalone names", () => {
  const template = readFileSync(path.resolve(testDir, "..", "docs-agent.yml"), "utf8");
  const normalized = normalizeWorkflowFixtureLine(template);
  for (const line of Object.values(TASK1_WORKFLOW_PROVIDER_FIXTURE)) {
    assert.ok(normalized.includes(normalizeWorkflowFixtureLine(line)), `missing workflow contract: ${line}`);
  }
  assert.match(template, /name:\s+hosted \(GLM 5\.2 — drafts doc update\)/);
  assert.match(template, /name:\s+Run docs-agent with GLM 5\.2/);
  assert.doesNotMatch(template, /secrets\.GLM_API_KEY/);
});

test("SSE payload parsing survives provider quirks and truncation signals", async (t) => {
  const evt = (obj) => `data: ${JSON.stringify(obj)}`;
  const contentEvt = (s) => evt({ choices: [{ delta: { content: s } }] });
  const reasoningEvt = (s) => evt({ choices: [{ delta: { reasoning: s } }] });
  const finishEvt = (r) => evt({ choices: [{ delta: {}, finish_reason: r }] });

  await t.test("assembles content across events, skipping comments and [DONE]", () => {
    const payload = [
      ": cost {\"usd\": 0.01}", // provider comment line, not an event
      contentEvt("Hello "),
      "", // keep-alive
      contentEvt("world"),
      "data: [DONE]",
    ].join("\n");
    assert.deepEqual(parseSSEPayload(payload), { content: "Hello world", reasoningChars: 0, finishReason: null, sawDone: true });
  });

  await t.test("counts reasoning chars and captures finish_reason=length", () => {
    const payload = [reasoningEvt("thinking..."), contentEvt("answer"), finishEvt("length")].join("\n");
    assert.deepEqual(parseSSEPayload(payload), { content: "answer", reasoningChars: 11, finishReason: "length", sawDone: false });
  });

  await t.test("counts the reasoning_content spelling too (Zhipu/DeepSeek-style)", () => {
    const payload = [
      evt({ choices: [{ delta: { reasoning_content: "hmm" } }] }),
      contentEvt("ok"),
    ].join("\n");
    assert.deepEqual(parseSSEPayload(payload), { content: "ok", reasoningChars: 3, finishReason: null, sawDone: false });
  });

  await t.test("reports a stream with neither finish_reason nor [DONE]", () => {
    const parsed = parseSSEPayload(contentEvt("partial"));
    assert.equal(parsed.finishReason, null);
    assert.equal(parsed.sawDone, false); // runBackend fails the run on this pair
  });

  await t.test("tolerates CRLF and a malformed event line", () => {
    const payload = `${contentEvt("a")}\r\ndata: {not json\r\n${contentEvt("b")}\r\n`;
    assert.equal(parseSSEPayload(payload).content, "ab");
  });

  await t.test("parses a final event with no trailing newline", () => {
    const payload = `${contentEvt("first")}\n${finishEvt("stop")}`; // no trailing \n
    const parsed = parseSSEPayload(payload);
    assert.equal(parsed.content, "first");
    assert.equal(parsed.finishReason, "stop");
  });
});

test("T8: empty and malformed backend output fail without a PR attempt", async (t) => {
  for (const [name, backendOutput, expectedError] of [
    ["empty stdout", "", /EMPTY stdout/],
    ["malformed output", "I updated nothing and forgot the required markers.", /zero parseable/],
  ]) {
    await t.test(name, () => {
      const sandbox = setupSandbox({ existingContent: "# Reference\n", backendOutput });
      t.after(() => sandbox.cleanup());
      const result = sandbox.run();

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, expectedError);
      assert.deepEqual(ghCalls(sandbox.ghLogPath), ["--version"]);
    });
  }
});

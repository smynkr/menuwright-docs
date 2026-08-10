import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { check, isCliInvocation, resolveTarget } from "./check-internal-links.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-links-"));
  fs.mkdirSync(path.join(root, "menuwright"), { recursive: true });
  fs.mkdirSync(path.join(root, "public", "images"), { recursive: true });
    fs.writeFileSync(path.join(root, "menuwright", "index.mdx"), "# Layer\n\n## Setup\n\n## Setup\n\n[guide](/menuwright/guide)\n");
  fs.writeFileSync(path.join(root, "menuwright", "guide.mdx"), "---\ntitle: Guide\nfake: \"# frontmatter-heading\"\n---\n\n# Guide [#guide-start]\n\n## `risk_tier` thresholds\n\n## C++ — C#\n\n## [API overview](/menuwright/guide)\n\n## DELETE `/api/scheduled-exports?id=<uuid>`\n\n{/*\n## commented heading\n[ignored comment link](/missing-comment)\n*/}\n\n[setup](/menuwright#setup-1) [self](#guide-start) [underscore](#risk_tier-thresholds) [punctuation](#c--c) [linked heading](#api-overview) [inline code](#delete-apischeduled-exportsiduuid) [index](./index) [reference][guide-ref]\n\n[guide-ref]: /menuwright/guide#guide-start\n\n![logo](/images/logo.svg)\n\n<div href=\"/menuwright/guide#guide-start\" src=\"/images/logo.svg\" />\n<span href={\"/menuwright/guide#guide-start\"} />\n");
  fs.writeFileSync(path.join(root, "docs.json"), JSON.stringify({ navigation: { pages: ["menuwright/index", "menuwright/guide"] }, links: [{ href: "/menuwright/guide#guide-start" }, { href: "https://example.com" }] }));
  fs.writeFileSync(path.join(root, "public", "images", "logo.svg"), "<svg/>");
  return root;
}

test("accepts normalized routes, duplicate heading slugs, fragments, nav, and assets", () => {
  const root = fixture();
  assert.deepEqual(check({ root }).failures, []);
});

test("resolves relative links from the served route instead of the source directory", () => {
  const root = fixture();
  const indexFile = path.join(root, "menuwright", "index.mdx");
  const guideFile = path.join(root, "menuwright", "guide.mdx");
  assert.equal(resolveTarget(root, indexFile, "./guide"), "/guide");
  assert.equal(resolveTarget(root, guideFile, "./index"), "/menuwright/index");
  assert.equal(resolveTarget(root, guideFile, "./index?tab=api#setup"), "/menuwright/index?tab=api#setup");

  fs.writeFileSync(indexFile, "# Layer\n\n[guide](./guide)\n");
  assert.match(check({ root }).failures.join("\n"), /unresolved route \.\/guide/);
});

test("fails deterministically when canonical sources collide on one route", () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, "menuwright", "guide"), { recursive: true });
  fs.writeFileSync(path.join(root, "menuwright", "guide", "index.mdx"), "# Nested guide\n");
  const result = check({ root });
  assert.match(
    result.failures.join("\n"),
    /duplicate canonical route \/menuwright\/guide: menuwright\/guide\.mdx, menuwright\/guide\/index\.mdx/,
  );
  assert.equal(result.routes.get("/menuwright/guide"), path.join(root, "menuwright", "guide.mdx"));
});

test("validates root fragments against the rewritten MenuWright index", () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, "menuwright", "index.mdx"), "# Guide\n\n## Welcome aboard\n\n[welcome](/#welcome-aboard) [missing](/#not-a-heading)\n");
  const result = check({ root });
  assert.equal(result.routes.get("/"), path.join(root, "menuwright", "index.mdx"));
  assert.match(result.failures.join("\n"), /unresolved fragment \/#not-a-heading/);
  assert.doesNotMatch(result.failures.join("\n"), /unresolved fragment \/#welcome-aboard/);
});

test("reports broken routes, fragments, navigation pages, and assets", () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, "menuwright", "guide.mdx"), "# Guide\n\n[missing](/menuwright/nope) [bad fragment](/menuwright#nope) ![missing](/images/nope.svg)\n");
  fs.writeFileSync(path.join(root, "docs.json"), JSON.stringify({ navigation: { pages: ["menuwright/index", "menuwright/nope"] }, links: [{ href: "/menuwright/missing-href" }] }));
  const failures = check({ root }).failures.join("\n");
  assert.match(failures, /unresolved route \/menuwright\/nope/);
  assert.match(failures, /unresolved fragment \/menuwright#nope/);
  assert.match(failures, /missing public asset \/images\/nope\.svg/);
  assert.match(failures, /docs\.json: navigation route \/menuwright\/nope/);
  assert.match(failures, /unresolved route \/menuwright\/missing-href/);
  assert.match(failures, /guide\.mdx:3/);
});

test("does not treat fenced code comments as heading anchors", () => {
  const root = fixture();
  fs.appendFileSync(path.join(root, "menuwright", "guide.mdx"), "\n```md\n# fake-anchor\n[ignored fenced link](/missing-fenced)\n<a href=\"/missing-jsx-example\">example</a>\n```\n`[ignored inline link](/missing-inline)`\n[code comment](/menuwright/guide#fake-anchor)\n");
  const failures = check({ root }).failures.join("\n");
  assert.match(failures, /unresolved fragment \/menuwright\/guide#fake-anchor/);
  assert.doesNotMatch(failures, /missing-fenced|missing-jsx-example|missing-inline|missing-comment/);
});

test("uses explicit IDs verbatim instead of inventing duplicate suffixes", () => {
  const root = fixture();
  fs.appendFileSync(path.join(root, "menuwright", "guide.mdx"), "\n## First [#fixed]\n## Second [#fixed]\n[invalid suffix](#fixed-1)\n");
  assert.match(check({ root }).failures.join("\n"), /unresolved fragment #fixed-1/);
});

test("matches Fumadocs slugs for angle brackets inside inline code", () => {
  const root = fixture();
  fs.appendFileSync(path.join(root, "menuwright", "guide.mdx"), "\n[wrong approximation](#delete-apischeduled-exportsid)\n");
  assert.match(check({ root }).failures.join("\n"), /unresolved fragment #delete-apischeduled-exportsid/);
});

test("validates static template literals and fails closed on dynamic JSX targets", () => {
  const root = fixture();
  fs.appendFileSync(
    path.join(root, "menuwright", "guide.mdx"),
    "\n<span href={`/menuwright/nope`} />\n<span href={route} />\n<img src={`/images/${assetName}.svg`} alt=\"Dynamic asset\" />\n",
  );
  const failures = check({ root }).failures.join("\n");
  assert.match(failures, /unresolved route \/menuwright\/nope/);
  assert.match(failures, /non-static JSX href cannot be validated/);
  assert.match(failures, /non-static JSX src cannot be validated/);
});

test("discovers page lists nested under new navigation containers", () => {
  const root = fixture();
  fs.writeFileSync(
    path.join(root, "docs.json"),
    JSON.stringify({
      navigation: {
        versions: [{ version: "v1", dropdowns: [{ dropdown: "Guides", pages: ["menuwright/nope"] }] }],
      },
    }),
  );

  assert.match(
    check({ root }).failures.join("\n"),
    /docs\.json: navigation route \/menuwright\/nope has no canonical MDX source/,
  );
});

test("recognizes the CLI module URL when its path contains spaces or non-ASCII characters", () => {
  const file = "/tmp/Axiom docs/éxamples/check links.mjs";
  assert.equal(isCliInvocation({ moduleUrl: pathToFileURL(file).href, argv1: file }), true);
  assert.equal(isCliInvocation({ moduleUrl: pathToFileURL(file).href, argv1: undefined }), false);
});

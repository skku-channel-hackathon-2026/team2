#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const documentsPath = join(projectRoot, "data", "knowledge", "documents.jsonl");
const statePath = process.env.CHANNEL_DOCUMENT_STATE_PATH
  ? resolve(process.env.CHANNEL_DOCUMENT_STATE_PATH)
  : join(projectRoot, "data", "knowledge", "channel-sync.json");
const apiBase = (
  process.env.CHANNEL_DOCUMENT_API_BASE || "https://document-api.channel.io"
).replace(/\/$/u, "");
const args = process.argv.slice(2);
const publish = args.includes("--publish");
const limit = readNumberArgument("--limit");

function readNumberArgument(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} 뒤에는 1 이상의 정수를 입력해야 합니다.`);
  }
  return value;
}

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${path}:${index + 1}: ${error.message}`);
      }
    });
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeName(value) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 120);
}

function markdownPreamble(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const firstSection = lines.findIndex((line) => /^##\s+/u.test(line));
  const end = firstSection === -1 ? lines.length : firstSection;
  return lines
    .slice(0, end)
    .filter((line, index) => !(index === 0 && /^#\s+/u.test(line)))
    .join("\n")
    .trim();
}

function splitAt(markdown, marker) {
  const lines = markdown.split(/\r?\n/u);
  const index = lines.findIndex((line) => line.startsWith(marker));
  if (index === -1) throw new Error(`분할 기준을 찾지 못했습니다: ${marker}`);
  return [lines.slice(0, index).join("\n"), lines.slice(index).join("\n")];
}

function partMarkdown(source, title, sectionMarkdown) {
  const preamble = markdownPreamble(source.bodyMarkdown);
  return [`# ${title}`, "", preamble, "", sectionMarkdown.trim()]
    .filter((value, index, values) => value || values[index - 1] !== "")
    .join("\n")
    .trim();
}

function splitDocument(source) {
  if (source.title === "학교 근처 맛집 및 놀거리") {
    const [, sections] = splitAt(source.bodyMarkdown, "## 1. 학교 근처 맛집");
    const [food, activities] = splitAt(sections, "## 2. 학교 근처 놀거리");
    return [
      {
        id: `${source.id}:food`,
        name: `${source.provenance.sourceId}-food`,
        title: "학교 근처 맛집",
        bodyMarkdown: partMarkdown(source, "학교 근처 맛집", food),
      },
      {
        id: `${source.id}:activities`,
        name: `${source.provenance.sourceId}-activities`,
        title: "학교 근처 놀거리",
        bodyMarkdown: partMarkdown(source, "학교 근처 놀거리", activities),
      },
    ];
  }

  if (source.title === "교내&교외 학습 공간 / 늦게까지 하는 카페") {
    const [, sections] = splitAt(
      source.bodyMarkdown,
      "## 1. 소프트웨어융합대학 학습 공간",
    );
    const [campus, outside] = splitAt(
      sections,
      "## 3. 공부하기 좋은 교외 24시간 개방 공간 (율전)",
    );
    return [
      {
        id: `${source.id}:campus`,
        name: `${source.provenance.sourceId}-campus`,
        title: "교내 학습 공간",
        bodyMarkdown: partMarkdown(source, "교내 학습 공간", campus),
      },
      {
        id: `${source.id}:outside`,
        name: `${source.provenance.sourceId}-outside`,
        title: "교외 24시간 학습 공간 및 늦게까지 하는 카페",
        bodyMarkdown: partMarkdown(
          source,
          "교외 24시간 학습 공간 및 늦게까지 하는 카페",
          outside,
        ),
      },
    ];
  }

  return [
    {
      id: source.id,
      name: source.provenance.sourceId,
      title: source.title,
      bodyMarkdown: source.bodyMarkdown,
    },
  ];
}

function stripImages(markdown) {
  return markdown
    .split(/\r?\n/u)
    .filter((line) => !line.trimStart().startsWith("!["))
    .join("\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replace(/!\[[^\]]*\]\[[^\]]*\]/gu, "")
    .replace(/<img\b[^>]*\/?\s*>/giu, "")
    .replace(/<\/?aside\b[^>]*>/giu, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeLink(value) {
  const decoded = value.replaceAll("&amp;", "&").trim();
  if (/^(?:https?:|mailto:)/iu.test(decoded)) return escapeHtml(decoded);
  return null;
}

function inlineMarkdown(value) {
  const tokens = [];
  const reserve = (html) => {
    const token = `\u0000${tokens.length}\u0000`;
    tokens.push(html);
    return token;
  };

  let text = value.replace(/`([^`]+)`/gu, (_, code) =>
    reserve(`<code>${escapeHtml(code)}</code>`),
  );
  text = text.replace(
    /\[([^\]]+)\]\(([^\s)]+(?:\s+"[^"]*")?)\)/gu,
    (_, label, target) => {
      const href = safeLink(target.replace(/\s+"[^"]*"$/u, ""));
      return href
        ? reserve(
            `<a href="${href}" rel="noopener noreferrer">${escapeHtml(label)}</a>`,
          )
        : label;
    },
  );
  text = escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>")
    .replace(/__([^_]+)__/gu, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/gu, "<s>$1</s>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/gu, "<em>$1</em>")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/gu, "<em>$1</em>");

  return text.replace(
    /\u0000(\d+)\u0000/gu,
    (_, index) => tokens[Number(index)],
  );
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\||\|$/gu, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line) {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell));
}

function markdownToHtml(markdown) {
  const lines = stripImages(markdown).split(/\r?\n/u);
  const output = [];
  let paragraph = [];
  let listType = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listType) return;
    output.push(`</${listType}>`);
    listType = null;
  };
  const closeBlocks = () => {
    flushParagraph();
    closeList();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      closeBlocks();
      const language = trimmed.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      const className = language
        ? ` class="language-${escapeHtml(language)}"`
        : "";
      output.push(
        `<pre><code${className}>${escapeHtml(code.join("\n"))}</code></pre>`,
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/u.exec(trimmed);
    if (heading) {
      closeBlocks();
      const level = heading[1].length;
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(?:-{3,}|\*{3,})$/u.test(trimmed)) {
      closeBlocks();
      output.push("<hr>");
      continue;
    }

    if (
      trimmed.startsWith("|") &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      closeBlocks();
      const headers = tableCells(trimmed);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      index -= 1;
      output.push("<table><thead><tr>");
      for (const header of headers)
        output.push(`<th>${inlineMarkdown(header)}</th>`);
      output.push("</tr></thead><tbody>");
      for (const row of rows) {
        output.push("<tr>");
        for (let cell = 0; cell < headers.length; cell += 1) {
          output.push(`<td>${inlineMarkdown(row[cell] ?? "")}</td>`);
        }
        output.push("</tr>");
      }
      output.push("</tbody></table>");
      continue;
    }

    if (trimmed.startsWith(">")) {
      closeBlocks();
      const quote = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quote.push(lines[index].trim().replace(/^>\s?/u, ""));
        index += 1;
      }
      index -= 1;
      output.push(
        `<blockquote><p>${inlineMarkdown(quote.join(" "))}</p></blockquote>`,
      );
      continue;
    }

    const unordered = /^\s*[-*+]\s+(.+)$/u.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/u.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? "ul" : "ol";
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        output.push(`<${listType}>`);
      }
      output.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`);
      continue;
    }

    if (!trimmed) {
      closeBlocks();
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  closeBlocks();
  return output.join("\n");
}

function buildTargets(records) {
  const sources = records.filter(
    (document) =>
      document.provenance?.dataset === "sopmu-wiki" &&
      document.review?.status === "approved" &&
      document.channel?.publishEligible === true,
  );

  const targets = sources.flatMap((source) =>
    splitDocument(source).map((part) => {
      const bodyHtml = markdownToHtml(part.bodyMarkdown);
      const id = part.id;
      const name = normalizeName(`sopmu-${part.name}`);
      const subtitle = [
        source.originalMetadata?.category,
        source.originalMetadata?.recommendation
          ? `추천: ${source.originalMetadata.recommendation}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const contentHash = hash(
        JSON.stringify({ name, title: part.title, subtitle, bodyHtml }),
      );
      return {
        id,
        sourceId: source.id,
        name,
        title: part.title,
        subtitle: subtitle || undefined,
        bodyHtml,
        contentHash,
      };
    }),
  );

  const ids = new Set();
  const names = new Set();
  for (const target of targets) {
    if (!target.bodyHtml.trim()) {
      throw new Error(`본문이 비어 있습니다: ${target.id}`);
    }
    if (/<img\b|!\[/iu.test(target.bodyHtml)) {
      throw new Error(`이미지가 제거되지 않았습니다: ${target.id}`);
    }
    if (ids.has(target.id) || names.has(target.name)) {
      throw new Error(
        `중복된 Documents 식별자입니다: ${target.id} / ${target.name}`,
      );
    }
    ids.add(target.id);
    names.add(target.name);
  }

  return { sources, targets };
}

function loadState() {
  if (!existsSync(statePath)) {
    return { schemaVersion: 1, space: null, documents: {} };
  }
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  if (state.schemaVersion !== 1 || typeof state.documents !== "object") {
    throw new Error(`지원하지 않는 동기화 상태 파일입니다: ${statePath}`);
  }
  return state;
}

function saveState(state) {
  const temporaryPath = join(dirname(statePath), ".channel-sync.json.tmp");
  writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temporaryPath, statePath);
}

function credentials() {
  const accessKey = process.env.CHANNEL_DOCUMENT_ACCESS_KEY;
  const accessSecret = process.env.CHANNEL_DOCUMENT_ACCESS_SECRET;
  const expectedSpaceName = process.env.CHANNEL_DOCUMENT_EXPECTED_SPACE_NAME;
  if (!accessKey || !accessSecret || !expectedSpaceName) {
    throw new Error(
      [
        "Documents API 환경 변수가 없습니다.",
        "channel-documents.env.example을 .env.documents.local로 복사한 뒤",
        "CHANNEL_DOCUMENT_ACCESS_KEY, CHANNEL_DOCUMENT_ACCESS_SECRET,",
        "CHANNEL_DOCUMENT_EXPECTED_SPACE_NAME을 입력하세요.",
      ].join(" "),
    );
  }
  return { accessKey, accessSecret, expectedSpaceName };
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds),
  );
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  return Math.min(1000 * 2 ** attempt, 8000);
}

function apiClient(accessKey, accessSecret) {
  const authorization = `Basic ${Buffer.from(`${accessKey}:${accessSecret}`).toString("base64")}`;

  return async function request(path, options = {}) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response;
      try {
        response = await fetch(`${apiBase}${path}`, {
          ...options,
          headers: {
            Accept: "application/json",
            Authorization: authorization,
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers,
          },
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error) {
        if (attempt === 3) throw error;
        await sleep(1000 * 2 ** attempt);
        continue;
      }

      const text = await response.text();
      const data = text ? parseResponse(text) : null;
      if (response.ok) return data;

      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }

      throw new Error(
        `${options.method || "GET"} ${path} 실패 (${response.status}): ${text.slice(0, 800)}`,
      );
    }
    throw new Error(
      `${options.method || "GET"} ${path} 재시도 횟수를 초과했습니다.`,
    );
  };
}

function parseResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function articlePayload(target) {
  return {
    language: "ko",
    name: target.name,
    title: target.title,
    subtitle: target.subtitle,
    bodyHtml: target.bodyHtml,
  };
}

function draftPayload(target) {
  return {
    name: target.name,
    title: target.title,
    subtitle: target.subtitle,
    bodyHtml: target.bodyHtml,
  };
}

function idsFrom(view) {
  const articleId = view?.article?.id;
  const revisionId = view?.revision?.id;
  if (!articleId || !revisionId) {
    throw new Error(
      `API 응답에서 article/revision ID를 찾지 못했습니다: ${JSON.stringify(view)}`,
    );
  }
  return { articleId: String(articleId), revisionId: String(revisionId) };
}

async function verifySpace(request, expectedSpaceName) {
  const view = await request("/open/v1/spaces/$me");
  const space = view?.space;
  if (!space?.id)
    throw new Error(
      `Space 조회 응답이 올바르지 않습니다: ${JSON.stringify(view)}`,
    );
  const localizedNames = space.name;
  const nameValues =
    localizedNames && typeof localizedNames === "object"
      ? Object.values(localizedNames)
      : [];
  const actualName =
    typeof localizedNames === "string"
      ? localizedNames
      : ((nameValues.includes(expectedSpaceName)
          ? expectedSpaceName
          : localizedNames?.[space.defaultLanguage]) ??
        localizedNames?.ko ??
        nameValues[0]);
  if (actualName !== expectedSpaceName) {
    throw new Error(
      `API 키의 Space가 다릅니다. 예상: ${expectedSpaceName}, 실제: ${actualName || "이름 확인 불가"}`,
    );
  }
  if (
    Array.isArray(space.supportedLanguages) &&
    !space.supportedLanguages.includes("ko")
  ) {
    throw new Error("API 키의 Space에서 한국어(ko)를 지원하지 않습니다.");
  }
  return { id: String(space.id), name: actualName };
}

async function syncTarget(request, target, state) {
  let current = state.documents[target.id];
  if (
    current?.status === "published" &&
    current.contentHash === target.contentHash
  ) {
    return "skipped";
  }

  let articleId = current?.articleId;
  let revisionId = current?.revisionId;

  if (current?.status === "draft" && articleId && revisionId) {
    const revisionView = await request(
      `/open/v1/spaces/$me/articles/${encodeURIComponent(articleId)}/revisions/${encodeURIComponent(revisionId)}`,
    );
    if (revisionView?.revision?.state === "published") {
      current = {
        ...current,
        status: "published",
        publishedAt: current.publishedAt ?? new Date().toISOString(),
      };
      state.documents[target.id] = current;
      saveState(state);
      if (current.contentHash === target.contentHash) return "skipped";
    } else if (revisionView?.revision?.state !== "draft") {
      current = {
        ...current,
        status: revisionView?.revision?.state ?? "unknown",
      };
      state.documents[target.id] = current;
      saveState(state);
    } else if (current.contentHash !== target.contentHash) {
      const view = await request(
        `/open/v1/spaces/$me/articles/${encodeURIComponent(articleId)}/revisions/${encodeURIComponent(revisionId)}`,
        { method: "PATCH", body: JSON.stringify(draftPayload(target)) },
      );
      ({ articleId, revisionId } = idsFrom(view));
    }
  }

  if (current?.status !== "draft" && articleId) {
    const view = await request(
      `/open/v1/spaces/$me/articles/${encodeURIComponent(articleId)}/revisions`,
      { method: "POST", body: JSON.stringify(articlePayload(target)) },
    );
    ({ articleId, revisionId } = idsFrom(view));
  } else if (!articleId) {
    const view = await request("/open/v1/spaces/$me/articles", {
      method: "POST",
      body: JSON.stringify(articlePayload(target)),
    });
    ({ articleId, revisionId } = idsFrom(view));
  }

  state.documents[target.id] = {
    sourceId: target.sourceId,
    articleId,
    revisionId,
    contentHash: target.contentHash,
    status: "draft",
    title: target.title,
    updatedAt: new Date().toISOString(),
  };
  saveState(state);

  await request(
    `/open/v1/spaces/$me/articles/${encodeURIComponent(articleId)}/revisions/${encodeURIComponent(revisionId)}/publish`,
    { method: "PUT" },
  );
  state.documents[target.id] = {
    ...state.documents[target.id],
    status: "published",
    publishedAt: new Date().toISOString(),
  };
  saveState(state);
  return current ? "updated" : "created";
}

function printPlan(sources, targets, state) {
  const selected = limit ? targets.slice(0, limit) : targets;
  const newCount = selected.filter(
    (target) => !state.documents[target.id],
  ).length;
  const changedCount = selected.filter(
    (target) =>
      state.documents[target.id] &&
      state.documents[target.id].contentHash !== target.contentHash,
  ).length;
  const unchangedCount = selected.filter(
    (target) =>
      state.documents[target.id]?.status === "published" &&
      state.documents[target.id].contentHash === target.contentHash,
  ).length;
  const resumeCount = selected.filter(
    (target) =>
      state.documents[target.id] &&
      state.documents[target.id].status !== "published" &&
      state.documents[target.id].contentHash === target.contentHash,
  ).length;
  console.log(`솦무위키 원본: ${sources.length}개`);
  console.log(`Documents 아티클: ${targets.length}개 (긴 문서 분할 포함)`);
  if (limit) console.log(`이번 실행 제한: ${selected.length}개`);
  console.log(
    `신규 ${newCount} / 변경 ${changedCount} / 이어서 ${resumeCount} / 동일 ${unchangedCount}`,
  );
  console.log("이미지 block은 제외하고 기존 이미지 설명 텍스트는 유지합니다.");
  return selected;
}

async function main() {
  if (!existsSync(documentsPath)) {
    throw new Error(`지식 파일을 찾을 수 없습니다: ${documentsPath}`);
  }
  const records = readJsonl(documentsPath);
  const { sources, targets } = buildTargets(records);
  const state = loadState();
  const selected = printPlan(sources, targets, state);

  if (!publish) {
    console.log("\n계획만 확인했습니다. 실제 등록: pnpm knowledge:publish");
    return;
  }

  const { accessKey, accessSecret, expectedSpaceName } = credentials();
  const request = apiClient(accessKey, accessSecret);
  const space = await verifySpace(request, expectedSpaceName);
  if (state.space?.id && state.space.id !== space.id) {
    throw new Error(
      `channel-sync.json은 다른 Space(${state.space.id})에 연결되어 있습니다. 현재 Space: ${space.id}`,
    );
  }
  state.space = space;
  saveState(state);
  console.log(`\nSpace 확인: ${space.name} (${space.id})`);

  const counts = { created: 0, updated: 0, skipped: 0 };
  for (let index = 0; index < selected.length; index += 1) {
    const target = selected[index];
    process.stdout.write(
      `[${index + 1}/${selected.length}] ${target.title} ... `,
    );
    try {
      const result = await syncTarget(request, target, state);
      counts[result] += 1;
      console.log(result);
    } catch (error) {
      console.error("failed");
      console.error(`\n${target.id}: ${error.message}`);
      console.error(
        "상태 파일이 보존되었습니다. 같은 명령을 다시 실행하면 이어서 처리합니다.",
      );
      process.exitCode = 1;
      return;
    }
  }

  const targetIds = new Set(targets.map((target) => target.id));
  const orphaned = Object.keys(state.documents).filter(
    (id) => !targetIds.has(id),
  );
  console.log(
    `\n완료: 신규 ${counts.created}, 변경 ${counts.updated}, 건너뜀 ${counts.skipped}`,
  );
  if (orphaned.length) {
    console.log(
      `원본에서 사라진 기존 아티클 ${orphaned.length}개는 안전을 위해 삭제하지 않았습니다.`,
    );
  }
  console.log(
    "Channel의 서포트 → ALF → 설정 → 지식에서 이 Space의 ALF 참조를 켜세요.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

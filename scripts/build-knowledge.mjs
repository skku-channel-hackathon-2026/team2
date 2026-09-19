#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputRoot = join(projectRoot, "data", "knowledge");
const checkOnly = process.argv.includes("--check");

const sourcePaths = {
  sopmu: join(projectRoot, "data", "sopmu-wiki", "documents.jsonl"),
  skku: join(projectRoot, "data", "Kingo-info", "skku-latest.json"),
  food: join(projectRoot, "data", "skku_food", "posts.jsonl"),
  everytime: join(projectRoot, "data", "everytime"),
};

for (const [name, path] of Object.entries(sourcePaths)) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${name} source: ${path}`);
  }
}

const documents = [];
const assets = [];
const assetById = new Map();
const rejected = [];
const sourceTimestamps = [];

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

function hash(value, length = 64) {
  return createHash("sha256")
    .update(String(value))
    .digest("hex")
    .slice(0, length);
}

function unique(values) {
  return [
    ...new Set(
      values.filter(
        (value) => value !== null && value !== undefined && value !== "",
      ),
    ),
  ];
}

function normalizeTitle(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function truncate(value, maxLength = 360) {
  const normalized = String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function markdownSummary(markdown, fallback) {
  const text = String(markdown ?? "")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/<[^>]+>/gu, " ")
    .split(/\r?\n/u)
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/u, "")
        .replace(/^>\s*/u, "")
        .replace(/^[-*+]\s+/u, "")
        .replace(/^\d+[.)]\s+/u, "")
        .replace(/[*_`~]/gu, "")
        .trim(),
    )
    .filter(
      (line) =>
        line &&
        !line.startsWith("카테고리:") &&
        !line.startsWith("추천:") &&
        !line.startsWith("이미지 설명:") &&
        line !== fallback,
    )
    .slice(0, 5)
    .join(" ");
  return truncate(text || `${fallback}에 관한 자료입니다.`);
}

function mimeFor(path) {
  const extension = extname(path).toLowerCase();
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".pdf": "application/pdf",
    }[extension] ?? "application/octet-stream"
  );
}

function addAsset(asset) {
  const existing = assetById.get(asset.id);
  if (existing) return existing;

  const absolutePath = asset.sourcePath
    ? join(projectRoot, asset.sourcePath)
    : null;
  const record = {
    schemaVersion: 1,
    id: asset.id,
    kind: asset.kind,
    sourcePath: asset.sourcePath,
    publicUrl: asset.publicUrl ?? null,
    mime: asset.mime ?? mimeFor(asset.sourcePath ?? ""),
    sizeBytes:
      absolutePath &&
      existsSync(absolutePath) &&
      statSync(absolutePath).isFile()
        ? statSync(absolutePath).size
        : null,
    exists: absolutePath ? existsSync(absolutePath) : true,
    alt: asset.alt ?? null,
    caption: asset.caption ?? null,
    visibleText: asset.visibleText ?? null,
    role: asset.role ?? null,
    provenance: asset.provenance,
    status:
      asset.status ??
      (asset.publicUrl
        ? "available"
        : asset.kind === "image"
          ? "needs_publish"
          : "local_only"),
  };
  assetById.set(record.id, record);
  assets.push(record);
  return record;
}

function addDocument(input) {
  const splitReasons = unique([
    ...(input.channel?.splitReasons ?? []),
    input.bodyMarkdown.length > 12_000 ? "본문이 12,000자를 초과함" : null,
    input.assetIds.length > 40 ? "연결 이미지가 40개를 초과함" : null,
  ]);
  const publishEligible =
    input.review.status === "approved" &&
    input.channel?.publishEligible !== false;

  const document = {
    schemaVersion: 1,
    id: input.id,
    parentId: input.parentId ?? null,
    documentType: input.documentType,
    title: input.title,
    summary: input.summary,
    bodyMarkdown: input.bodyMarkdown.trim(),
    retrieval: {
      questions: unique(input.retrieval?.questions ?? []),
      aliases: unique(input.retrieval?.aliases ?? []),
      topics: unique(input.retrieval?.topics ?? []),
    },
    scope: {
      campuses: unique(input.scope?.campuses ?? []),
      audiences: unique(input.scope?.audiences ?? []),
      departments: unique(input.scope?.departments ?? []),
    },
    authority: input.authority,
    temporal: {
      type: input.temporal?.type ?? "static",
      observedAt: input.temporal?.observedAt ?? null,
      validFrom: input.temporal?.validFrom ?? null,
      validUntil: input.temporal?.validUntil ?? null,
    },
    provenance: {
      dataset: input.provenance.dataset,
      sourceId: String(input.provenance.sourceId),
      sourceUrl: input.provenance.sourceUrl || null,
      rawPath: input.provenance.rawPath ?? null,
      collectedAt: input.provenance.collectedAt ?? null,
      model: input.provenance.model ?? null,
      contentHash: hash(
        JSON.stringify({
          title: input.title,
          bodyMarkdown: input.bodyMarkdown,
          sourceId: input.provenance.sourceId,
          originalMetadata: input.originalMetadata ?? {},
        }),
      ),
    },
    review: {
      status: input.review.status,
      reasons: unique(input.review.reasons ?? []),
      reviewedAt: input.review.reviewedAt ?? null,
    },
    assetIds: unique(input.assetIds),
    originalMetadata: input.originalMetadata ?? {},
    channel: {
      folder: input.channel.folder,
      publishEligible,
      publishReady: false,
      requiresSplit: splitReasons.length > 0,
      splitReasons,
    },
  };

  documents.push(document);
  if (document.review.status === "rejected") {
    rejected.push({
      id: document.id,
      title: document.title,
      dataset: document.provenance.dataset,
      reasons: document.review.reasons,
    });
  }
  return document;
}

function sopmuType(category) {
  if (category.includes("수강후기")) return "course-review";
  if (category.includes("연구실")) return "research-lab";
  if (category === "과동아리") return "club";
  if (category === "교내시설") return "facility";
  return "guide";
}

function sopmuQuestions(title, documentType) {
  if (documentType === "course-review") {
    return [`${title} 수업은 어때?`, `${title} 수강 후기를 알려줘`];
  }
  if (documentType === "research-lab") {
    return [
      `${title} 연구실은 무엇을 연구해?`,
      `${title} 연구실 정보를 알려줘`,
    ];
  }
  if (documentType === "club") {
    return [`${title} 동아리는 무슨 활동을 해?`, `${title} 가입 정보를 알려줘`];
  }
  return [`${title} 알려줘`, `${title}에 대해 설명해줘`];
}

function ingestSopmu() {
  const records = readJsonl(sourcePaths.sopmu);
  for (const source of records) {
    const documentType = sopmuType(source.category ?? "기타");
    const assetIds = [];

    for (const image of source.images ?? []) {
      const sourcePath = `data/sopmu-wiki/${image.path}`;
      addAsset({
        id: `sopmu:image:${image.id}`,
        kind: "image",
        sourcePath,
        publicUrl: null,
        alt: image.originalAlt || image.caption,
        caption: image.caption,
        visibleText: image.visibleText,
        role: image.type,
        provenance: {
          dataset: "sopmu-wiki",
          sourceId: image.id,
          sourceUrl: null,
          model: image.captionModel ?? null,
          method: image.captionMethod ?? null,
        },
      });
      assetIds.push(`sopmu:image:${image.id}`);
    }

    for (const attachment of source.attachments ?? []) {
      if (/\.(?:jpe?g|png|webp|gif)$/iu.test(attachment)) continue;
      const assetId = `sopmu:file:${hash(`${source.id}:${attachment}`, 20)}`;
      addAsset({
        id: assetId,
        kind: "file",
        sourcePath: `data/sopmu-wiki/${attachment}`,
        publicUrl: null,
        alt: basename(attachment),
        caption: null,
        provenance: {
          dataset: "sopmu-wiki",
          sourceId: source.id,
          sourceUrl: null,
          model: null,
          method: "notion-export",
        },
      });
      assetIds.push(assetId);
    }

    addDocument({
      id: `sopmu:${source.id}`,
      documentType,
      title: source.title,
      summary: markdownSummary(source.content, source.title),
      bodyMarkdown: source.content,
      retrieval: {
        questions: sopmuQuestions(source.title, documentType),
        aliases: [],
        topics: [source.category, source.title],
      },
      scope: {
        campuses: [],
        audiences: ["성균관대학교 학생"],
        departments: ["소프트웨어융합대학"],
      },
      authority: "curated-community",
      temporal: {
        type: "versioned",
        observedAt: source.date,
        validFrom: null,
        validUntil: null,
      },
      provenance: {
        dataset: "sopmu-wiki",
        sourceId: source.id,
        sourceUrl: null,
        rawPath: `data/sopmu-wiki/${source.source}`,
        collectedAt: source.date,
        model: source.images?.some((image) => image.captionModel)
          ? unique(source.images.map((image) => image.captionModel)).join(", ")
          : null,
      },
      review: {
        status: "approved",
        reasons: source.date ? [] : ["원문에 기준 날짜가 없음"],
        reviewedAt: null,
      },
      assetIds,
      originalMetadata: {
        category: source.category,
        date: source.date,
        recommendation: source.recommendation,
        source: source.source,
      },
      channel: {
        folder: `솦무위키/${source.category ?? "기타"}`,
        publishEligible: true,
        splitReasons: [],
      },
    });
  }
}

function foodPlaceName(post) {
  const firstLine = String(post.caption ?? "")
    .split(/\r?\n/u)[0]
    .trim();
  return firstLine || `이름 미확인 장소 (${post.shortcode})`;
}

function ingestFood() {
  const posts = readJsonl(sourcePaths.food);
  const groups = new Map();

  for (const post of posts) {
    if (post.fetchedAt) sourceTimestamps.push(post.fetchedAt);
    const name = foodPlaceName(post);
    const key = normalizeTitle(name) || post.shortcode;
    const group = groups.get(key) ?? { name, posts: [] };
    group.posts.push(post);
    groups.set(key, group);
  }

  for (const [key, group] of [...groups.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "ko"),
  )) {
    group.posts.sort((a, b) =>
      String(b.postedAt).localeCompare(String(a.postedAt)),
    );
    const assetIds = [];
    for (const post of group.posts) {
      const assetId = `skku-food:image:${post.shortcode}`;
      addAsset({
        id: assetId,
        kind: "image",
        sourcePath: `data/skku_food/${post.coverFile}`,
        publicUrl: null,
        alt: post.mediaAlt,
        caption: `${group.name} 관련 공개 게시물의 대표 이미지입니다. 시각 내용은 추가 검수가 필요합니다.`,
        visibleText: null,
        role: "photo",
        status: "needs_caption_and_publish",
        provenance: {
          dataset: "skku-food",
          sourceId: post.shortcode,
          sourceUrl: post.canonicalUrl ?? post.url,
          model: null,
          method: "instagram-public-page",
        },
      });
      assetIds.push(assetId);
    }

    const dates = group.posts
      .map((post) => post.postedAt)
      .filter(Boolean)
      .sort();
    const body = [
      `# ${group.name}`,
      "",
      "> 자료 성격: 공개 SNS에 게시된 학생 생활·맛집 후기",
      `> 게시 기준: ${dates[0]?.slice(0, 10) ?? "확인 불가"} ~ ${dates.at(-1)?.slice(0, 10) ?? "확인 불가"}`,
      "> 현재 영업 여부, 가격, 메뉴는 달라질 수 있으므로 방문 전에 다시 확인해야 합니다.",
      "",
      "## 후기 기록",
      "",
      ...group.posts.flatMap((post) => [
        `### ${post.postedAt?.slice(0, 10) ?? "날짜 미상"}`,
        "",
        post.caption || "본문이 없는 게시물입니다.",
        "",
        post.canonicalUrl || post.url
          ? `[원문 게시물](${post.canonicalUrl ?? post.url})`
          : "원문 링크 없음",
        "",
      ]),
    ].join("\n");

    addDocument({
      id: `skku-food:place:${hash(key, 20)}`,
      documentType: "place-review",
      title: group.name,
      summary: `${group.name}에 관한 공개 SNS 후기 ${group.posts.length}건을 출처별로 묶은 자료입니다. 현재 정보가 아닌 게시 당시의 경험으로 다뤄야 합니다.`,
      bodyMarkdown: body,
      retrieval: {
        questions: [
          `${group.name} 후기를 알려줘`,
          `${group.name}에서 무엇을 먹을 만해?`,
        ],
        aliases: [],
        topics: ["맛집", "학교 주변", group.name],
      },
      scope: {
        campuses: [],
        audiences: ["성균관대학교 학생"],
        departments: [],
      },
      authority: "social-review",
      temporal: {
        type: "versioned",
        observedAt: dates.at(-1) ?? null,
        validFrom: dates[0] ?? null,
        validUntil: null,
      },
      provenance: {
        dataset: "skku-food",
        sourceId: group.posts.map((post) => post.shortcode).join(","),
        sourceUrl: group.posts[0].canonicalUrl ?? group.posts[0].url,
        rawPath: "data/skku_food/posts.jsonl",
        collectedAt: group.posts[0].fetchedAt ?? null,
        model: null,
      },
      review: {
        status: "needs_review",
        reasons: [
          "SNS 후기를 식당별로 자동 집계함",
          "현재 영업 여부·가격·메뉴 확인 필요",
          "대표 이미지에 시각 캡션 추가 필요",
        ],
        reviewedAt: null,
      },
      assetIds,
      originalMetadata: {
        postCount: group.posts.length,
        shortcodes: group.posts.map((post) => post.shortcode),
      },
      channel: {
        folder: "학생 경험/맛집·생활 후기",
        publishEligible: false,
        splitReasons: [],
      },
    });
  }
}

function ingestEverytime() {
  for (const board of ["brori", "fresh"]) {
    const directory = join(sourcePaths.everytime, board);
    const files = readdirSync(directory)
      .filter((name) => name.endsWith(".json"))
      .sort();

    for (const filename of files) {
      const source = JSON.parse(
        readFileSync(join(directory, filename), "utf8"),
      );
      if (source.processedAt) sourceTimestamps.push(source.processedAt);
      const hasAnswers =
        Array.isArray(source.answers) && source.answers.length > 0;
      const reasons = [
        "익명 커뮤니티 답변이므로 공식 근거 확인 필요",
        !source.sourceUrl ? "원문 URL 없음" : null,
        !source.postedAt ? "작성 시각 없음" : null,
        !hasAnswers ? "답변 없음" : null,
      ];
      const body = [
        `# ${source.title}`,
        "",
        "> 자료 성격: 익명 커뮤니티 Q&A",
        "> 학사 정책의 근거로 직접 사용하지 말고 공식 규정·공지로 검증해야 합니다.",
        "",
        "## 질문",
        "",
        source.question || "질문 내용 없음",
        "",
        "## 익명 답변",
        "",
        ...(hasAnswers
          ? source.answers.flatMap((answer, index) => [
              `${index + 1}. ${answer}`,
              "",
            ])
          : ["답변 없음", ""]),
        "## 처리 요약",
        "",
        source.summary || "요약 없음",
      ].join("\n");

      addDocument({
        id: `everytime:${board}:${source.id}`,
        documentType: "community-qa",
        title: source.title,
        summary: source.summary || truncate(source.question),
        bodyMarkdown: body,
        retrieval: {
          questions: source.question ? [truncate(source.question, 240)] : [],
          aliases: [],
          topics: source.tags ?? [],
        },
        scope: {
          campuses: [],
          audiences: ["성균관대학교 학생"],
          departments: [],
        },
        authority: "community-anecdote",
        temporal: {
          type: "versioned",
          observedAt: source.postedAt || null,
          validFrom: null,
          validUntil: null,
        },
        provenance: {
          dataset: `everytime-${board}`,
          sourceId: source.id,
          sourceUrl: source.sourceUrl,
          rawPath: `data/everytime/${board}/${filename}`,
          collectedAt: source.processedAt,
          model: source.model,
        },
        review: {
          status: hasAnswers ? "needs_review" : "rejected",
          reasons,
          reviewedAt: null,
        },
        assetIds: [],
        originalMetadata: {
          board,
          postedAt: source.postedAt,
          tags: source.tags ?? [],
        },
        channel: {
          folder: "학생 경험/검수 대기 커뮤니티 FAQ",
          publishEligible: false,
          splitReasons: [],
        },
      });
    }
  }
}

function formatDateRange(startDate, endDate) {
  return endDate && endDate !== startDate
    ? `${startDate} ~ ${endDate}`
    : startDate;
}

function ingestOfficialMenus(source) {
  const requestedDate = source.requestedDate;
  for (const campus of source.meals.campuses ?? []) {
    for (const restaurant of campus.restaurants ?? []) {
      const menuDates = (restaurant.menus ?? [])
        .map((menu) => menu.date)
        .filter(Boolean)
        .sort();
      const validFrom = menuDates[0] ?? null;
      const validUntil = menuDates.at(-1) ?? null;
      const expired = Boolean(
        validUntil && requestedDate && validUntil < requestedDate,
      );
      const hasMenus = menuDates.length > 0;
      const body = [
        `# ${restaurant.name} ${source.meals.mealType ?? "식단"}`,
        "",
        `- 캠퍼스: ${restaurant.campus}`,
        `- 위치: ${restaurant.location || "확인 불가"}`,
        `- 표시 기간: ${restaurant.displayedDateRange || "확인 불가"}`,
        `- 수집 기준일: ${requestedDate}`,
        `- [공식 식단 페이지](${restaurant.detailSourceUrl})`,
        "",
        "## 메뉴",
        "",
        ...(hasMenus
          ? restaurant.menus.flatMap((menu) => [
              `### ${menu.date} (${menu.dayLabel}) — ${menu.corner}`,
              "",
              `- 메뉴: ${menu.menuItems.join(", ")}`,
              `- 가격: ${menu.priceText ? `${menu.priceText}원` : "확인 불가"}`,
              "",
            ])
          : ["수집된 메뉴가 없습니다."]),
      ].join("\n");

      addDocument({
        id: `skku-official:menu:${campus.id}:${restaurant.id}:${requestedDate}`,
        documentType: "menu",
        title: `${restaurant.name} 식단 (${restaurant.displayedDateRange || requestedDate})`,
        summary: `${restaurant.campus} ${restaurant.name}의 ${restaurant.displayedDateRange || requestedDate} 공식 식단입니다.`,
        bodyMarkdown: body,
        retrieval: {
          questions: [
            `${restaurant.name} 메뉴가 뭐야?`,
            `${restaurant.name} 식단과 가격을 알려줘`,
          ],
          aliases: [restaurant.name, restaurant.location],
          topics: ["학식", "식단", restaurant.campus, restaurant.name],
        },
        scope: {
          campuses: [restaurant.campus],
          audiences: ["성균관대학교 구성원"],
          departments: [],
        },
        authority: expired ? "official-archived" : "official-current",
        temporal: {
          type: "ephemeral",
          observedAt: requestedDate,
          validFrom,
          validUntil,
        },
        provenance: {
          dataset: "skku-official",
          sourceId: `menu:${campus.id}:${restaurant.id}:${requestedDate}`,
          sourceUrl: restaurant.detailSourceUrl,
          rawPath: "data/Kingo-info/skku-latest.json",
          collectedAt: source.fetchedAt,
          model: null,
        },
        review: {
          status: "approved",
          reasons: expired ? ["수집 기준일에 이미 표시 기간이 종료됨"] : [],
          reviewedAt: null,
        },
        assetIds: [],
        originalMetadata: {
          campusId: campus.id,
          restaurantId: restaurant.id,
          displayedDateRange: restaurant.displayedDateRange,
          menuCategory: source.meals.mealCategory,
        },
        channel: {
          folder: `공식 정보/식단/${restaurant.campus}`,
          publishEligible: hasMenus && !expired,
          splitReasons: [],
        },
      });
    }
  }
}

function ingestOfficialNotices(source) {
  for (const notice of source.notices.notices ?? []) {
    const body = [
      `# ${notice.title}`,
      "",
      `- 분류: ${notice.category || "미분류"}`,
      `- 게시일: ${notice.publishedAt || "확인 불가"}`,
      `- 작성자: ${notice.author || "확인 불가"}`,
      `- [공식 공지 원문](${notice.url})`,
      "",
      "> 현재 수집본에는 공지 본문이 포함되어 있지 않습니다. 제목과 원문 링크만 검색 보조용으로 사용합니다.",
    ].join("\n");

    addDocument({
      id: `skku-official:notice:${notice.id}`,
      documentType: "notice",
      title: notice.title,
      summary: `${notice.category || "학교"} 공식 공지입니다. 본문을 수집한 뒤 지식으로 공개해야 합니다.`,
      bodyMarkdown: body,
      retrieval: {
        questions: [`${notice.title} 내용을 알려줘`],
        aliases: [],
        topics: ["공지", notice.category, notice.title],
      },
      scope: {
        campuses: [],
        audiences: ["성균관대학교 구성원"],
        departments: [],
      },
      authority: "official-current",
      temporal: {
        type: "ephemeral",
        observedAt: notice.publishedAt,
        validFrom: notice.publishedAt,
        validUntil: null,
      },
      provenance: {
        dataset: "skku-official",
        sourceId: `notice:${notice.id}`,
        sourceUrl: notice.url,
        rawPath: "data/Kingo-info/skku-latest.json",
        collectedAt: source.fetchedAt,
        model: null,
      },
      review: {
        status: "needs_review",
        reasons: ["공지 본문 미수집", "마감일과 공개 종료 조건 확인 필요"],
        reviewedAt: null,
      },
      assetIds: [],
      originalMetadata: notice,
      channel: {
        folder: `공식 정보/공지/${notice.category || "기타"}`,
        publishEligible: false,
        splitReasons: [],
      },
    });
  }
}

function ingestOfficialCalendar(source) {
  const groups = new Map();
  for (const event of source.academicCalendar.events ?? []) {
    const month = event.startDate?.slice(0, 7) ?? "unknown";
    const values = groups.get(month) ?? [];
    values.push(event);
    groups.set(month, values);
  }

  for (const [month, events] of [...groups.entries()].sort()) {
    events.sort((a, b) => a.startDate.localeCompare(b.startDate));
    const year = month.slice(0, 4);
    const monthNumber = Number(month.slice(5, 7));
    const endOfMonth = `${month}-${new Date(Date.UTC(Number(year), monthNumber, 0)).getUTCDate().toString().padStart(2, "0")}`;
    const archived = endOfMonth < source.requestedDate;
    const body = [
      `# ${year}년 ${monthNumber}월 학사일정`,
      "",
      `> 기준: 성균관대학교 ${source.academicCalendar.academicYear}학년도 공식 학사일정`,
      `> 수집일: ${source.requestedDate}`,
      "",
      ...events.map(
        (event) =>
          `- **${formatDateRange(event.startDate, event.endDate)}**: ${event.title}`,
      ),
      "",
      `[공식 학사일정](${source.academicCalendar.sourceUrl})`,
    ].join("\n");

    addDocument({
      id: `skku-official:calendar:${month}`,
      documentType: "calendar",
      title: `${year}년 ${monthNumber}월 학사일정`,
      summary: `${year}년 ${monthNumber}월 성균관대학교 공식 학사일정 ${events.length}건입니다.`,
      bodyMarkdown: body,
      retrieval: {
        questions: [`${year}년 ${monthNumber}월 학사일정을 알려줘`],
        aliases: [`${monthNumber}월 학사일정`],
        topics: ["학사일정", year, `${monthNumber}월`],
      },
      scope: {
        campuses: [],
        audiences: ["성균관대학교 구성원"],
        departments: [],
      },
      authority: archived ? "official-archived" : "official-current",
      temporal: {
        type: "versioned",
        observedAt: source.requestedDate,
        validFrom: `${month}-01`,
        validUntil: endOfMonth,
      },
      provenance: {
        dataset: "skku-official",
        sourceId: `calendar:${month}`,
        sourceUrl: source.academicCalendar.sourceUrl,
        rawPath: "data/Kingo-info/skku-latest.json",
        collectedAt: source.fetchedAt,
        model: null,
      },
      review: {
        status: "approved",
        reasons: archived ? ["지난 월의 공식 일정"] : [],
        reviewedAt: null,
      },
      assetIds: [],
      originalMetadata: {
        academicYear: source.academicCalendar.academicYear,
        eventIds: events.map((event) => event.id),
      },
      channel: {
        folder: `공식 정보/학사일정/${year}`,
        publishEligible: true,
        splitReasons: [],
      },
    });
  }
}

function extractPdfText(path) {
  const result = spawnSync("pdftotext", ["-layout", path, "-"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout
    .replace(/\f/gu, "\n\n")
    .replace(/[ \t]+$/gmu, "")
    .replace(/\n{4,}/gu, "\n\n\n")
    .trim();
}

function ingestOfficialRegulations(source) {
  for (const regulation of source.regulations.documents ?? []) {
    for (const file of regulation.files ?? []) {
      const sourcePath = `data/Kingo-info/${file.relativePath}`;
      const absolutePath = join(projectRoot, sourcePath);
      const assetId = `skku-official:file:${file.attachNumber}`;
      addAsset({
        id: assetId,
        kind: "file",
        sourcePath,
        publicUrl: file.downloadUrl,
        mime: "application/pdf",
        alt: file.filename,
        caption: `${regulation.title} ${file.kind === "main" ? "본문" : "별표"} PDF`,
        visibleText: null,
        role: file.kind,
        status: "available",
        provenance: {
          dataset: "skku-official",
          sourceId: file.attachNumber,
          sourceUrl: file.downloadUrl,
          model: null,
          method: "official-download",
        },
      });

      const extractedText = existsSync(absolutePath)
        ? extractPdfText(absolutePath)
        : null;
      const label = file.kind === "main" ? "본문" : "별표";
      const body = [
        `# ${regulation.title} — ${label}`,
        "",
        `- 개정일: ${regulation.revisionDate}`,
        `- [공식 규정 페이지](${regulation.detailUrl})`,
        `- [원본 PDF](${file.downloadUrl})`,
        "",
        "## 추출 본문",
        "",
        extractedText || "PDF 텍스트를 추출하지 못했습니다.",
      ].join("\n");

      addDocument({
        id: `skku-official:regulation:${regulation.id}:${file.kind}:${file.attachNumber}`,
        documentType: "policy",
        title: `${regulation.title} — ${label}`,
        summary: `${regulation.revisionDate} 개정된 ${regulation.title}의 ${label}입니다. PDF에서 자동 추출한 텍스트를 검수해야 합니다.`,
        bodyMarkdown: body,
        retrieval: {
          questions: [`${regulation.title} 내용을 알려줘`],
          aliases: [regulation.title, file.filename],
          topics: ["학칙", "규정", regulation.title],
        },
        scope: {
          campuses: [],
          audiences: ["성균관대학교 구성원"],
          departments: [],
        },
        authority: "official-current",
        temporal: {
          type: "versioned",
          observedAt: source.requestedDate,
          validFrom: regulation.revisionDate?.replaceAll(".", "-") ?? null,
          validUntil: null,
        },
        provenance: {
          dataset: "skku-official",
          sourceId: `regulation:${regulation.id}:${file.attachNumber}`,
          sourceUrl: regulation.detailUrl,
          rawPath: sourcePath,
          collectedAt: source.fetchedAt,
          model: null,
        },
        review: {
          status: "needs_review",
          reasons: [
            extractedText
              ? "PDF 텍스트 자동 추출 결과 검수 필요"
              : "PDF 텍스트 추출 실패",
            file.kind !== "main" ? "별표의 표·레이아웃 복원 필요" : null,
          ],
          reviewedAt: null,
        },
        assetIds: [assetId],
        originalMetadata: {
          regulationId: regulation.id,
          articleNumber: regulation.articleNumber,
          revisionDate: regulation.revisionDate,
          fileKind: file.kind,
          filename: file.filename,
          sha256: file.sha256,
        },
        channel: {
          folder: "공식 정보/학칙·규정",
          publishEligible: false,
          splitReasons: [],
        },
      });
    }
  }
}

function ingestOfficial() {
  const source = JSON.parse(readFileSync(sourcePaths.skku, "utf8"));
  if (source.fetchedAt) sourceTimestamps.push(source.fetchedAt);
  ingestOfficialMenus(source);
  ingestOfficialNotices(source);
  ingestOfficialCalendar(source);
  ingestOfficialRegulations(source);
}

function finalizePublishReadiness() {
  for (const document of documents) {
    const relatedAssets = document.assetIds
      .map((id) => assetById.get(id))
      .filter(Boolean);
    const assetsReady = relatedAssets.every(
      (asset) =>
        asset.exists && (asset.kind !== "image" || Boolean(asset.publicUrl)),
    );
    const expiredEphemeral =
      document.temporal.type === "ephemeral" &&
      document.temporal.validUntil &&
      document.temporal.observedAt &&
      document.temporal.validUntil < document.temporal.observedAt;
    document.channel.publishReady = Boolean(
      document.channel.publishEligible &&
      !document.channel.requiresSplit &&
      assetsReady &&
      !expiredEphemeral,
    );
  }
}

function countsBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function buildConflicts() {
  const groups = new Map();
  for (const document of documents) {
    const key = normalizeTitle(document.title);
    const values = groups.get(key) ?? [];
    values.push(document);
    groups.set(key, values);
  }
  return [...groups.entries()]
    .filter(
      ([, values]) =>
        new Set(values.map((value) => value.provenance.dataset)).size > 1,
    )
    .map(([key, values]) => ({
      key,
      titles: unique(values.map((value) => value.title)),
      documentIds: values.map((value) => value.id).sort(),
      datasets: unique(values.map((value) => value.provenance.dataset)).sort(),
      status: "needs_review",
      reason: "서로 다른 데이터셋에 정규화된 제목이 같은 문서가 있음",
    }))
    .sort((a, b) => a.key.localeCompare(b.key, "ko"));
}

function jsonl(records) {
  return (
    records.map((record) => JSON.stringify(record)).join("\n") +
    (records.length ? "\n" : "")
  );
}

ingestSopmu();
ingestFood();
ingestEverytime();
ingestOfficial();

documents.sort((a, b) => a.id.localeCompare(b.id, "en"));
assets.sort((a, b) => a.id.localeCompare(b.id, "en"));
rejected.sort((a, b) => a.id.localeCompare(b.id, "en"));
finalizePublishReadiness();

const conflicts = buildConflicts();
const reviewQueue = documents
  .filter(
    (document) =>
      document.review.status === "needs_review" ||
      document.channel.requiresSplit,
  )
  .map((document) => ({
    itemType: "document",
    id: document.id,
    title: document.title,
    dataset: document.provenance.dataset,
    authority: document.authority,
    reasons: unique([
      ...document.review.reasons,
      ...document.channel.splitReasons,
    ]),
    suggestedAction:
      document.review.status === "needs_review"
        ? "원문과 공식 근거를 확인한 뒤 approved 또는 rejected로 결정"
        : "의미 있는 제목 경계로 분리한 뒤 Channel 문서 생성",
  }))
  .sort((a, b) => a.id.localeCompare(b.id, "en"));

const generatedAt = sourceTimestamps.filter(Boolean).sort().at(-1) ?? null;
const qualityReport = {
  schemaVersion: 1,
  generatedAt,
  totals: {
    documents: documents.length,
    assets: assets.length,
    reviewQueue: reviewQueue.length,
    rejected: rejected.length,
    conflicts: conflicts.length,
  },
  documentsByDataset: countsBy(
    documents.map((document) => document.provenance.dataset),
  ),
  documentsByAuthority: countsBy(
    documents.map((document) => document.authority),
  ),
  documentsByType: countsBy(documents.map((document) => document.documentType)),
  documentsByReviewStatus: countsBy(
    documents.map((document) => document.review.status),
  ),
  channel: {
    publishEligible: documents.filter(
      (document) => document.channel.publishEligible,
    ).length,
    publishReady: documents.filter((document) => document.channel.publishReady)
      .length,
    requiresSplit: documents.filter(
      (document) => document.channel.requiresSplit,
    ).length,
  },
  assets: {
    missingFiles: assets.filter((asset) => !asset.exists).length,
    imagesWithoutPublicUrl: assets.filter(
      (asset) => asset.kind === "image" && !asset.publicUrl,
    ).length,
    needsCaption: assets.filter((asset) =>
      asset.status.includes("needs_caption"),
    ).length,
  },
  sourceSpecific: {
    sopmuWithoutObservedDate: documents.filter(
      (document) =>
        document.provenance.dataset === "sopmu-wiki" &&
        !document.temporal.observedAt,
    ).length,
    everytimeWithoutSourceUrl: documents.filter(
      (document) =>
        document.provenance.dataset.startsWith("everytime-") &&
        !document.provenance.sourceUrl,
    ).length,
    officialNoticesWithoutBody: documents.filter(
      (document) =>
        document.provenance.dataset === "skku-official" &&
        document.documentType === "notice" &&
        document.review.status === "needs_review",
    ).length,
    expiredMenus: documents.filter(
      (document) =>
        document.documentType === "menu" &&
        document.authority === "official-archived",
    ).length,
  },
};

const outputs = {
  "documents.jsonl": jsonl(documents),
  "assets.jsonl": jsonl(assets),
  "review-queue.jsonl": jsonl(reviewQueue),
  "rejected.jsonl": jsonl(rejected),
  "conflicts.jsonl": jsonl(conflicts),
  "quality-report.json": `${JSON.stringify(qualityReport, null, 2)}\n`,
};

const manifest = {
  schemaVersion: 1,
  generatedAt,
  generator: "scripts/build-knowledge.mjs",
  sources: {
    sopmu: "data/sopmu-wiki/documents.jsonl",
    skkuOfficial: "data/Kingo-info/skku-latest.json",
    skkuFood: "data/skku_food/posts.jsonl",
    everytime: ["data/everytime/brori/*.json", "data/everytime/fresh/*.json"],
  },
  files: Object.fromEntries(
    Object.entries(outputs).map(([name, content]) => [
      name,
      {
        records: name.endsWith(".jsonl")
          ? content.split(/\r?\n/u).filter(Boolean).length
          : 1,
        sha256: hash(content),
      },
    ]),
  ),
};
outputs["manifest.json"] = `${JSON.stringify(manifest, null, 2)}\n`;

if (checkOnly) {
  const differences = [];
  for (const [name, expected] of Object.entries(outputs)) {
    const path = join(outputRoot, name);
    if (!existsSync(path) || readFileSync(path, "utf8") !== expected)
      differences.push(name);
  }
  if (differences.length) {
    console.error(`Knowledge build is stale: ${differences.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Knowledge build is current (${documents.length} documents, ${assets.length} assets).`,
    );
  }
} else {
  mkdirSync(outputRoot, { recursive: true });
  for (const [name, content] of Object.entries(outputs)) {
    writeFileSync(join(outputRoot, name), content);
  }
  console.log(
    `Wrote ${documents.length} documents and ${assets.length} assets to data/knowledge.`,
  );
}

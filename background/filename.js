// Filename + path building: slugs, domain extraction, date tokens,
// and rendering the configured naming preset/template.

export function slugify(input, maxLen = 50) {
  const slug = (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "");
  return slug || "untitled";
}

export function extractDomain(url) {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "") || "page";
  } catch {
    return "page";
  }
}

export function dateTokens(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const HH = pad(d.getHours());
  const MM = pad(d.getMinutes());
  return {
    date: `${yyyy}${mm}${dd}`,
    time: `${HH}${MM}`,
    yearMonth: `${yyyy}-${mm}`,
  };
}

// Sanitize a single path *segment* (not a full path) for the filesystem.
function sanitizeSegment(segment) {
  return segment.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

export function buildTokens({ url, title }, now = new Date()) {
  const domain = extractDomain(url);
  const titleSlug = slugify(title);
  const { date, time, yearMonth } = dateTokens(now);
  return { domain, title: titleSlug, date, time, yearMonth };
}

function renderTemplate(template, tokens) {
  return template.replace(/\{(domain|title|date|time)\}/g, (_, key) => tokens[key] ?? "");
}

export function buildBaseFilename(options, tokens) {
  let name;
  switch (options.filenamePreset) {
    case "title_date":
      name = `${tokens.title}_${tokens.date}-${tokens.time}`;
      break;
    case "date_domain":
      name = `${tokens.date}-${tokens.time}_${tokens.domain}`;
      break;
    case "custom":
      name = renderTemplate(options.customTemplate, tokens);
      break;
    case "domain_date_title":
    default:
      name = `${tokens.domain}_${tokens.date}-${tokens.time}_${tokens.title}`;
      break;
  }
  return sanitizeSegment(name);
}

export function buildRelativePath(options, tokens, ext) {
  const parts = [sanitizeSegment(options.baseFolder || "FullShot")];

  if (options.subfolders === "month") {
    parts.push(sanitizeSegment(tokens.yearMonth));
  } else if (options.subfolders === "domain") {
    parts.push(sanitizeSegment(tokens.domain));
  }

  const filename = `${buildBaseFilename(options, tokens)}.${ext}`;
  parts.push(filename);
  return parts.join("/");
}

export function exampleFilename(options) {
  const tokens = buildTokens(
    { url: "https://example.com/blog/my-article", title: "My Example Article Title" },
    new Date(2026, 8, 20, 14, 5)
  );
  const ext = options.defaultFormat === "image" ? (options.imageFormat === "jpeg" ? "jpg" : "png") : "pdf";
  return buildRelativePath(options, tokens, ext);
}

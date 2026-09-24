// This function is never imported/run in an extension context directly.
// Its source is serialized (via .toString()) and executed inside the
// captured page through CDP Runtime.evaluate, so it must be fully
// self-contained (no closures over outside bindings, no imports).
//
// It walks visible text nodes and returns their text plus bounding
// rect in *document* coordinates (independent of current scroll
// position), for building the invisible searchable text layer.
export function collectVisibleTextNodes() {
  const results = [];
  const scrollX = window.scrollX || 0;
  const scrollY = window.scrollY || 0;

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (!style) return true;
    if (style.visibility === "hidden" || style.display === "none") return false;
    if (parseFloat(style.opacity) === 0) return false;
    return true;
  }

  function elementChainVisible(el) {
    let node = el;
    while (node && node.nodeType === 1) {
      if (!isVisible(node)) return false;
      node = node.parentElement;
    }
    return true;
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue && node.nodeValue.trim();
      if (!text) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEXTAREA") {
        return NodeFilter.FILTER_REJECT;
      }
      if (!elementChainVisible(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node = walker.nextNode();
  while (node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = range.getClientRects();
    for (const rect of rects) {
      if (rect.width < 2 || rect.height < 2) continue;
      results.push({
        text: node.nodeValue.trim(),
        x: rect.left + scrollX,
        y: rect.top + scrollY,
        width: rect.width,
        height: rect.height,
      });
    }
    node = walker.nextNode();
  }

  return results;
}

// Also self-contained: nudges the page to trigger lazy-loaded content
// (images/sections behind IntersectionObserver), then returns to the
// original scroll position.
export async function preScrollPage() {
  const originalX = window.scrollX;
  const originalY = window.scrollY;
  const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
  const total = Math.max(
    document.documentElement.scrollHeight,
    document.body ? document.body.scrollHeight : 0
  );

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let y = 0; y < total; y += step) {
    window.scrollTo(0, y);
    await wait(90);
  }
  window.scrollTo(0, total);
  await wait(150);
  window.scrollTo(originalX, originalY);
  await wait(50);
  return true;
}

// Self-contained, like the others above. Many app-shell layouts (SPA
// dashboards, docs sites with a fixed header/sidebar) don't scroll the
// document at all — a single inner pane does, with its own
// `overflow: auto` and a fixed height. Page.getLayoutMetrics() only
// measures the outer document, so without this, capture only ever
// sees one screenful of that inner pane.
//
// This temporarily strips the CSS clipping off any large-enough
// internally-scrolling element so its true content height becomes
// part of the document's normal layout flow (and therefore part of
// what CDP considers "the page"), tagging what it changed so
// restoreScrollContainers() can put it back exactly afterward.
export function unclipScrollContainers() {
  const MARK = "data-fullshot-unclip";
  const SKIP_TAGS = new Set(["TEXTAREA", "SELECT", "INPUT", "IFRAME"]);
  const minHeight = window.innerHeight * 0.3;

  function markAndUnclip(el) {
    if (el.hasAttribute(MARK)) return false; // already handled (shared ancestor)

    el.setAttribute(`${MARK}-overflow`, el.style.overflow || "");
    el.setAttribute(`${MARK}-overflow-y`, el.style.overflowY || "");
    el.setAttribute(`${MARK}-overflow-x`, el.style.overflowX || "");
    el.setAttribute(`${MARK}-height`, el.style.height || "");
    el.setAttribute(`${MARK}-max-height`, el.style.maxHeight || "");
    el.setAttribute(MARK, "1");

    el.style.setProperty("overflow", "visible", "important");
    el.style.setProperty("height", "auto", "important");
    el.style.setProperty("max-height", "none", "important");
    return true;
  }

  const candidates = document.querySelectorAll("*");
  let count = 0;

  for (const el of candidates) {
    if (SKIP_TAGS.has(el.tagName)) continue;
    if (el.clientHeight < minHeight) continue;

    const style = window.getComputedStyle(el);
    const clipsY = style.overflowY === "auto" || style.overflowY === "scroll";
    const clipsX = style.overflowX === "auto" || style.overflowX === "scroll";
    if (!clipsY && !clipsX) continue;

    const overflowsVertically = el.scrollHeight - el.clientHeight > 4;
    const overflowsHorizontally = el.scrollWidth - el.clientWidth > 4;
    if (!overflowsVertically && !overflowsHorizontally) continue;

    if (markAndUnclip(el)) count++;

    // A flex/grid app shell commonly constrains this element's *ancestors*
    // too (a fixed-height or overflow:hidden wrapper one or more levels
    // up) — freeing only the scrollable element itself still leaves it
    // squeezed into that ancestor's box, so walk all the way up and free
    // those too. This has to include <body>/<html> themselves: a
    // `html, body { height: 100vh; overflow: hidden }` reset is an
    // extremely common pattern and is exactly the kind of clip that
    // needs removing — Page.getLayoutMetrics() measures the document's
    // rendered content box, which stays capped at one viewport as long
    // as anything from the scrollable element up to <html> still clips.
    let ancestor = el.parentElement;
    while (ancestor) {
      if (markAndUnclip(ancestor)) count++;
      if (ancestor === document.documentElement) break;
      ancestor = ancestor.parentElement;
    }
  }

  return count;
}

export function restoreScrollContainers() {
  const MARK = "data-fullshot-unclip";
  const marked = document.querySelectorAll(`[${MARK}]`);

  for (const el of marked) {
    el.style.overflow = el.getAttribute(`${MARK}-overflow`) || "";
    el.style.overflowY = el.getAttribute(`${MARK}-overflow-y`) || "";
    el.style.overflowX = el.getAttribute(`${MARK}-overflow-x`) || "";
    el.style.height = el.getAttribute(`${MARK}-height`) || "";
    el.style.maxHeight = el.getAttribute(`${MARK}-max-height`) || "";
    for (const suffix of ["", "-overflow", "-overflow-y", "-overflow-x", "-height", "-max-height"]) {
      el.removeAttribute(`${MARK}${suffix}`);
    }
  }

  return marked.length;
}

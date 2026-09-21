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

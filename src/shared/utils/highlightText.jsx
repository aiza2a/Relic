// 高亮文本关键词
export function highlightText(text, keyword) {
  if (!keyword || !text) return text;

  // 转义正则特殊字符
  const escapedKeyword = escapeRegExp(keyword);
  const regex = new RegExp(`(${escapedKeyword})`, 'gi');
  const parts = text.split(regex);

  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (part.toLowerCase() === keyword.toLowerCase()) {
      return (
        <mark
          key={index}
          className="search-highlight bg-[var(--qc-search-highlight-bg)] text-[var(--qc-search-highlight-fg)] rounded-sm px-0.5"
          data-highlight="true"
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}

// 转义正则表达式特殊字符
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, (match) => '\\' + match);
}

// 高亮 HTML 内容中的关键词
export function highlightHtmlContent(container, keyword) {
  if (!container || !keyword) return;

  clearHighlights(container);

  const escapedKeyword = escapeRegExp(keyword);
  const regex = new RegExp(`(${escapedKeyword})`, 'gi');

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue.match(regex)) {
      textNodes.push(node);
    }
  }

  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue;
    const parts = text.split(regex);

    if (parts.length > 1) {
      const fragment = document.createDocumentFragment();
      parts.forEach((part) => {
        if (part.toLowerCase() === keyword.toLowerCase()) {
          const mark = document.createElement('mark');
          mark.className =
            'search-highlight bg-[var(--qc-search-highlight-bg)] text-[var(--qc-search-highlight-fg)] rounded-sm px-0.5';
          mark.setAttribute('data-highlight', 'true');
          mark.textContent = part;
          fragment.appendChild(mark);
        } else if (part) {
          fragment.appendChild(document.createTextNode(part));
        }
      });
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  });
}

// 清除容器中的高亮
export function clearHighlights(container) {
  if (!container) return;

  const marks = container.querySelectorAll('mark[data-highlight="true"]');
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    const text = document.createTextNode(mark.textContent);
    parent.replaceChild(text, mark);
    parent.normalize();
  });
}

// 在容器内部滚动到第一个高亮元素
export function scrollToFirstHighlight(container) {
  if (!container) return false;

  const firstHighlight = container.querySelector('mark[data-highlight="true"]');
  if (!firstHighlight) return false;

  const containerRect = container.getBoundingClientRect();
  const highlightRect = firstHighlight.getBoundingClientRect();

  const highlightTop = highlightRect.top - containerRect.top + container.scrollTop;

  const isVisible =
    highlightRect.top >= containerRect.top &&
    highlightRect.bottom <= containerRect.bottom;

  if (!isVisible) {
    const scrollTarget = highlightTop - container.clientHeight / 2 + highlightRect.height / 2;
    container.scrollTop = Math.max(0, scrollTarget);
  }

  return true;
}

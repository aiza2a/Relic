import DOMPurify from 'dompurify'

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'span', 'div',
    'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'b', 'i', 'sub', 'sup', 'strike', 'del', 'ins'
  ],
  ALLOWED_ATTR: [
    'style', 'class', 'data-image-id', 'src', 'alt', 'title',
    'href', 'target', 'colspan', 'rowspan', 'align', 'valign'
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_TRUSTED_TYPE: false,
  FORBID_TAGS: ['script', 'iframe', 'embed', 'object', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
}

// 使用 DOMPurify 清理 HTML 内容
export function sanitizeHTML(htmlContent) {
  return DOMPurify.sanitize(htmlContent, PURIFY_CONFIG)
}


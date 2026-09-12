const TRAILING_CHARS = new Set([
    '.', ',', ';', ':', '!', '?', '\'', '"', '»', '“', '”', '’', '‘',
    ')', ']', '}', 
    '。', '，', '、', '；', '：', '？', '！', '）', '】', '》', '」', '』', '”', '’', '…'
  ])
  
  function cleanUrl(raw) {
    if (!raw) return raw
    let url = raw.trim()
  
    const badTail = /[)\]}\s.,;!?'"»“”’‘）】》」』。，、；：？！…]+$/u
    while (badTail.test(url)) {
      url = url.replace(badTail, '')
    }
  
    const safeEnd = /[a-z0-9/_#=&%-]$/i
    if (!safeEnd.test(url)) {
      const match = url.match(/^(https?:\/\/[^\u4e00-\u9fa5\s<>"']*[a-z0-9/_#=&%-])/i)
      if (match) url = match[1]
    }
  
    return url
  }
  
  export function extractLinksFromHtml(htmlContent) {
    if (!htmlContent) return []
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlContent, 'text/html')
      const linkElements = doc.querySelectorAll('a[href]')
      const set = new Set()
      linkElements.forEach(a => {
        const href = a.getAttribute('href')
        if (!href) return
        if (/^(https?|ftp):\/\//i.test(href)) {
          set.add(cleanUrl(href))
        } else if (/^www\./i.test(href)) {
          set.add(cleanUrl('https://' + href))
        }
      })
      return [...set]
    } catch (e) {
      console.warn('parse HTML failed', e)
      return []
    }
  }

  export function extractLinksFromText(text) {
    if (!text) return []
    const set = new Set()
  
    const mdRe = /\[[^\]]+\]\(\s*(https?:\/\/[^\s)]+)\s*\)/gi
    for (const m of text.matchAll(mdRe)) {
      set.add(cleanUrl(m[1]))
    }

    const protoRe = /\b(?:https?|ftp):\/\/[^\s<>"'`]+/gi
    for (const m of text.matchAll(protoRe)) {
      set.add(cleanUrl(m[0]))
    }

    const wwwRe = /\bwww\.[^\s<>"'`]+/gi
    for (const m of text.matchAll(wwwRe)) {
      set.add(cleanUrl('https://' + m[0]))
    }
  
    return [...set]
  }
  
  export function extractAllLinks(item) {
    if (!item) return []
    const set = new Set()
  
    if (item.html_content) {
      extractLinksFromHtml(item.html_content).forEach(l => set.add(l))
    }
    if (item.content) {
      extractLinksFromText(item.content).forEach(l => set.add(l))
    }
  
    return [...set]
  }

  export function isUrl(text) {
    if (!text) return false
    const t = text.trim()
    return /^(https?|ftp):\/\//i.test(t) || /^www\./i.test(t)
  }

  export function normalizeUrl(url) {
    if (!url) return url
    const t = url.trim()
    if (!/^(https?|ftp):\/\//i.test(t)) return 'https://' + t
    return t
  }
  
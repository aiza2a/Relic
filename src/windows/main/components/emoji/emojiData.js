import emojiDataEn from 'emoji-picker-element-data/en/cldr/data.json';
import emojiDataCn from 'emoji-picker-element-data/zh/cldr/data.json';

export const GROUP_ID_MAP = {
  0: 'smileys-emotion',
  1: 'people-body',
  3: 'animals-nature',
  4: 'food-drink',
  5: 'travel-places',
  6: 'activities',
  7: 'objects',
  8: 'symbols'
};

export const SYMBOL_RANGES = {
  punctuation: [[0x3000, 0x303F], [0xFF01, 0xFF5E]],
  arrows:     [[0x2190, 0x21FF], [0x27F0, 0x27FF], [0x2900, 0x297F]],
  math:       [[0x2200, 0x22FF], [0x27C0, 0x27EF], [0x2980, 0x29FF]],
  currency:   [[0x20A0, 0x20CF]],
  geometric:  [[0x25A0, 0x25FF]],
  box:        [[0x2500, 0x257F]],
  misc:       [[0x2600, 0x26FF], [0x2700, 0x27BF]],
  technical:  [[0x2300, 0x23FF]],
  letterlike: [[0x2100, 0x214F]],
  numbers:    [[0x2460, 0x24FF]],
};

export const PUNCTUATION_MANUAL = [
  '!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
  ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~',
  '\u2018', '\u2019', '\u201C', '\u201D', '…', '—', '–', '·', '•', '©', '®', '™', '°', '±', '×', '÷',
];

function scanRanges(ranges) {
  const arr = [];
  for (const [start, end] of ranges) {
    for (let cp = start; cp <= end; cp++) {
      try {
        const ch = String.fromCodePoint(cp);
        if (!/\s/.test(ch) && ch.trim()) arr.push(ch);
      } catch (e) {}
    }
  }
  return arr;
}

export const symbolCategories = {};
for (const name in SYMBOL_RANGES) {
  symbolCategories[name] = scanRanges(SYMBOL_RANGES[name]);
}
symbolCategories['punctuation'] = [...PUNCTUATION_MANUAL, ...symbolCategories['punctuation']];

export const SYMBOL_CATS = [
  { id: 'punctuation', icon: 'ti-quote', labelKey: 'emoji.cat.punctuation' },
  { id: 'arrows', icon: 'ti-arrow-right', labelKey: 'emoji.cat.arrows' },
  { id: 'math', icon: 'ti-math', labelKey: 'emoji.cat.math' },
  { id: 'currency', icon: 'ti-currency-dollar', labelKey: 'emoji.cat.currency' },
  { id: 'geometric', icon: 'ti-cube', labelKey: 'emoji.cat.geometric' },
  { id: 'box', icon: 'ti-square-dashed', labelKey: 'emoji.cat.box' },
  { id: 'misc', icon: 'ti-star', labelKey: 'emoji.cat.misc' },
  { id: 'technical', icon: 'ti-settings', labelKey: 'emoji.cat.technical' },
  { id: 'letterlike', icon: 'ti-letter-a', labelKey: 'emoji.cat.letterlike' },
  { id: 'numbers', icon: 'ti-number', labelKey: 'emoji.cat.numbers' },
];

export const EMOJI_CATS = [
  { id: 'recent', icon: 'ti-clock', labelKey: 'emoji.recent' },
  { id: 'smileys-emotion', icon: 'ti-mood-smile', labelKey: 'emoji.smileys' },
  { id: 'people-body', icon: 'ti-user', labelKey: 'emoji.people' },
  { id: 'animals-nature', icon: 'ti-paw', labelKey: 'emoji.animals' },
  { id: 'food-drink', icon: 'ti-apple', labelKey: 'emoji.food' },
  { id: 'travel-places', icon: 'ti-plane', labelKey: 'emoji.travel' },
  { id: 'activities', icon: 'ti-ball-football', labelKey: 'emoji.activities' },
  { id: 'objects', icon: 'ti-bulb', labelKey: 'emoji.objects' },
  { id: 'symbols', icon: 'ti-abc', labelKey: 'emoji.symbolsCat' },
];

export const RECENT_KEY = 'emoji_recent_v1';
export const SKIN_TONE_KEY = 'emoji_skin_tone';
export const MAX_RECENT = 32;

export const SKIN_TONES = [
  { id: 'default', label: 'Default' },
  { id: 'light', label: 'Light' },
  { id: 'medium-light', label: 'Medium-Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'medium-dark', label: 'Medium-Dark' },
  { id: 'dark', label: 'Dark' },
];

export const EMOJI_COLS = 8;
export const SYMBOL_COLS = 8;

export const splitIntoRowsStatic = (items, cols, catId) => {
  const rows = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push({
      type: 'row',
      items: items.slice(i, i + cols),
      cols,
      catId,
      id: `${catId}-row-${i}`
    });
  }
  return rows;
};

let emojiDataCache = null;
let emojiMetaCache = null;
let emojiRowsCache = null;
let emojiSkinSupport = null;

export const ensureEmojiData = () => {
  if (emojiDataCache) return;
  
  const cnNames = {};
  emojiDataCn.forEach(item => {
    if (item.emoji && item.annotation) {
      cnNames[item.emoji] = item.annotation;
    }
  });

  const grouped = {};
  const metaMap = {};
  const rowsCache = {};
  const skinSupport = new Map();
  
  emojiDataEn.forEach(item => {
    const groupId = GROUP_ID_MAP[item.group];
    if (!groupId) return;
    
    if (!grouped[groupId]) grouped[groupId] = [];
    const entry = {
      emoji: item.emoji,
      name: item.annotation,
      nameCn: cnNames[item.emoji] || item.annotation
    };
    grouped[groupId].push(entry);
    metaMap[item.emoji] = entry;
    
    if (item.skins && item.skins.length > 0) {
      skinSupport.set(item.emoji, item.skins.map(s => s.emoji));
    }
  });

  Object.keys(grouped).forEach(catId => {
    rowsCache[catId] = splitIntoRowsStatic(grouped[catId], EMOJI_COLS, catId);
  });

  emojiDataCache = grouped;
  emojiMetaCache = metaMap;
  emojiRowsCache = rowsCache;
  emojiSkinSupport = skinSupport;
};

export const getEmojiDataCache = () => emojiDataCache;
export const getEmojiMetaCache = () => emojiMetaCache;
export const getEmojiRowsCache = () => emojiRowsCache;
export const getEmojiSkinSupport = () => emojiSkinSupport;

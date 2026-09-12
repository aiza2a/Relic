const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const FUNCTION_RE = /^([a-z]+)\((.*)\)$/i;
const MAX_COLOR_CODE_LENGTH = 64;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function splitColorArgs(input) {
  const normalized = input.replace(/\s*\/\s*/g, ' ');
  if (normalized.includes(',')) {
    return normalized.split(',').map(part => part.trim()).filter(Boolean);
  }
  return normalized.trim().split(/\s+/).filter(Boolean);
}

function parseNumberToken(token) {
  const value = Number.parseFloat(String(token).trim());
  return Number.isFinite(value) ? value : null;
}

function parseHue(token) {
  const raw = String(token).trim().toLowerCase();
  const value = parseNumberToken(raw);
  if (value == null) return null;

  if (raw.endsWith('turn')) return normalizeHue(value * 360);
  if (raw.endsWith('rad')) return normalizeHue(value * 180 / Math.PI);
  return normalizeHue(value);
}

function normalizeHue(value) {
  return ((value % 360) + 360) % 360;
}

function parseRgbChannel(token) {
  const raw = String(token).trim();
  const value = parseNumberToken(raw);
  if (value == null) return null;

  if (raw.endsWith('%')) {
    if (value < 0 || value > 100) return null;
    return Math.round(value * 255 / 100);
  }

  if (value < 0 || value > 255) return null;
  return Math.round(value);
}

function parsePercentToken(token) {
  const raw = String(token).trim();
  const value = parseNumberToken(raw);
  if (value == null) return null;

  if (raw.endsWith('%')) {
    if (value < 0 || value > 100) return null;
    return value / 100;
  }

  if (value < 0 || value > 100) return null;
  return value <= 1 ? value : value / 100;
}

function parseAlphaToken(token) {
  const raw = String(token).trim();
  const value = parseNumberToken(raw);
  if (value == null) return null;

  if (raw.endsWith('%')) {
    if (value < 0 || value > 100) return null;
    return value / 100;
  }

  if (value < 0 || value > 1) return null;
  return value;
}

function parseCmykChannel(token) {
  const raw = String(token).trim();
  const value = parseNumberToken(raw);
  if (value == null) return null;

  if (raw.endsWith('%')) {
    if (value < 0 || value > 100) return null;
    return value / 100;
  }

  if (value < 0 || value > 100) return null;
  return value <= 1 ? value : value / 100;
}

function expandHex(hex) {
  const value = hex.trim().toLowerCase();
  const match = value.match(HEX_RE);
  if (!match) return null;

  const body = match[1];
  if (body.length === 3) {
    return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
  }
  return `#${body}`;
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function hexToRgb(hex) {
  const expanded = expandHex(hex);
  if (!expanded) return null;
  return {
    r: Number.parseInt(expanded.slice(1, 3), 16),
    g: Number.parseInt(expanded.slice(3, 5), 16),
    b: Number.parseInt(expanded.slice(5, 7), 16),
  };
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (h < 60) {
    rp = c; gp = x;
  } else if (h < 120) {
    rp = x; gp = c;
  } else if (h < 180) {
    gp = c; bp = x;
  } else if (h < 240) {
    gp = x; bp = c;
  } else if (h < 300) {
    rp = x; bp = c;
  } else {
    rp = c; bp = x;
  }

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (h < 60) {
    rp = c; gp = x;
  } else if (h < 120) {
    rp = x; gp = c;
  } else if (h < 180) {
    gp = c; bp = x;
  } else if (h < 240) {
    gp = x; bp = c;
  } else if (h < 300) {
    rp = x; bp = c;
  } else {
    rp = c; bp = x;
  }

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function cmykToRgb(c, m, y, k) {
  return {
    r: Math.round(255 * (1 - c) * (1 - k)),
    g: Math.round(255 * (1 - m) * (1 - k)),
    b: Math.round(255 * (1 - y) * (1 - k)),
  };
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }

  return {
    h: Math.round(normalizeHue(h)),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function rgbToHsv({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }

  return {
    h: Math.round(normalizeHue(h)),
    s: Math.round((max === 0 ? 0 : delta / max) * 100),
    v: Math.round(max * 100),
  };
}

function rgbToCmyk({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);

  if (k >= 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  return {
    c: Math.round((1 - rn - k) / (1 - k) * 100),
    m: Math.round((1 - gn - k) / (1 - k) * 100),
    y: Math.round((1 - bn - k) / (1 - k) * 100),
    k: Math.round(k * 100),
  };
}

function parseRgb(args) {
  if (args.length < 3 || args.length > 4) return null;
  if (args.length === 4 && parseAlphaToken(args[3]) == null) return null;
  const channels = args.slice(0, 3).map(parseRgbChannel);
  if (channels.some(value => value == null)) return null;
  return { r: channels[0], g: channels[1], b: channels[2] };
}

function parseHsl(args) {
  if (args.length < 3 || args.length > 4) return null;
  if (args.length === 4 && parseAlphaToken(args[3]) == null) return null;
  const h = parseHue(args[0]);
  const s = parsePercentToken(args[1]);
  const l = parsePercentToken(args[2]);
  if (h == null || s == null || l == null) return null;
  return hslToRgb(h, s, l);
}

function parseHsv(args) {
  if (args.length < 3 || args.length > 4) return null;
  if (args.length === 4 && parseAlphaToken(args[3]) == null) return null;
  const h = parseHue(args[0]);
  const s = parsePercentToken(args[1]);
  const v = parsePercentToken(args[2]);
  if (h == null || s == null || v == null) return null;
  return hsvToRgb(h, s, v);
}

function parseCmyk(args) {
  if (args.length !== 4) return null;
  const channels = args.map(parseCmykChannel);
  if (channels.some(value => value == null)) return null;
  return cmykToRgb(channels[0], channels[1], channels[2], channels[3]);
}

export function parseStandaloneColorCode(value) {
  const input = String(value ?? '');
  if (!input || input.length > MAX_COLOR_CODE_LENGTH) return null;

  const raw = input.trim();
  if (!raw || /\r|\n/.test(raw)) return null;

  const hex = expandHex(raw);
  if (hex) {
    return { format: 'hex', srgbHex: hex, rgb: hexToRgb(hex), raw };
  }

  const match = raw.match(FUNCTION_RE);
  if (!match) return null;

  const name = match[1].toLowerCase();
  const args = splitColorArgs(match[2]);
  const rgb = (() => {
    if (name === 'rgb' || name === 'rgba') return parseRgb(args);
    if (name === 'hsl' || name === 'hsla') return parseHsl(args);
    if (name === 'hsv' || name === 'hsva') return parseHsv(args);
    if (name === 'cmyk') return parseCmyk(args);
    return null;
  })();

  if (!rgb) return null;

  const format = name.startsWith('rgb')
    ? 'rgb'
    : name.startsWith('hsl')
      ? 'hsl'
      : name.startsWith('hsv')
        ? 'hsv'
        : 'cmyk';

  return { format, srgbHex: rgbToHex(rgb), rgb, raw };
}

export function formatColorCodeLike(parsed, srgbHex) {
  const rgb = hexToRgb(srgbHex);
  if (!parsed || !rgb) return srgbHex;

  switch (parsed.format) {
    case 'rgb':
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    case 'hsl': {
      const hsl = rgbToHsl(rgb);
      return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    }
    case 'hsv': {
      const hsv = rgbToHsv(rgb);
      return `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`;
    }
    case 'cmyk': {
      const cmyk = rgbToCmyk(rgb);
      return `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
    }
    default:
      return expandHex(srgbHex) || srgbHex;
  }
}

// Procedural texture generation for cells
// Based on Chinese character texture generation logic

// Chinese characters for procedural texture generation
const PHILOSOPHY_CHARS = [
  "道", "德", "仁", "义", "礼", "智", "信", "和", "中", "正",
  "理", "气", "心", "性", "天", "地", "人", "物", "生", "死",
  "有", "无", "虚", "实", "阴", "阳", "动", "静", "变", "常",
  "美", "艺", "文", "诗", "书", "画", "音", "乐", "舞", "戏",
  "雅", "俗", "精", "神", "韵", "味", "境", "意", "情", "思",
  "知", "行", "学", "问", "思", "辨", "修", "养", "悟", "觉",
  "空", "色", "相", "法", "因", "果", "缘", "业", "苦", "乐",
  "墨", "笔", "纸", "砚", "琴", "棋", "书", "画", "茶", "酒",
  "山", "水", "花", "鸟", "竹", "梅", "兰", "菊", "松", "石",
];

// Deterministic hash function for consistent results
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

// Color palettes for different region types
// Each type has a base color palette with variations - similar colors for same type
const REGION_COLOR_PALETTES = {
  // Grassland - warm earth tones with green/yellow variations (more warm, less blue, brighter)
  "Grassland": {
    base: [220, 240, 180], // Base warm green (brighter, less blue)
    variations: [
      [210, 230, 170], [230, 250, 190], [215, 235, 180], [225, 245, 190],
      [205, 225, 165], [235, 255, 200], [220, 240, 180], [215, 240, 185],
      [225, 235, 190], [215, 245, 175], [210, 240, 180], [230, 245, 195],
      [240, 220, 190], [220, 250, 200], [210, 235, 185], [230, 240, 195],
    ],
    textBase: [100, 120, 60],
  },
  // Wetland - cool blue-green tones (reduce blue dominance, brighter, more green)
  "Wetland": {
    base: [200, 220, 190], // More green, less blue, brighter
    variations: [
      [190, 210, 180], [210, 230, 200], [195, 215, 185], [205, 225, 195],
      [185, 205, 175], [215, 235, 205], [200, 220, 190], [195, 220, 195],
      [205, 215, 185], [195, 230, 200], [190, 225, 195], [210, 215, 200],
      [200, 215, 185], [210, 225, 195], [195, 220, 190], [205, 230, 200],
    ],
    textBase: [80, 100, 70],
  },
  // Desert - warm sandy/beige tones (more warm colors, brighter, less blue)
  "Desert": {
    base: [250, 240, 200],
    variations: [
      [240, 230, 190], [255, 250, 210], [245, 235, 195], [255, 245, 205],
      [235, 225, 185], [255, 255, 215], [250, 240, 200], [245, 240, 205],
      [255, 235, 195], [245, 250, 210], [240, 245, 200], [255, 235, 195],
      [250, 230, 210], [255, 240, 220], [245, 235, 215], [255, 245, 225],
    ],
    textBase: [140, 130, 80],
  },
  // Forest - deeper green tones (more green, less blue, brighter)
  "Forest": {
    base: [180, 210, 150],
    variations: [
      [170, 200, 140], [190, 220, 160], [175, 205, 145], [185, 215, 155],
      [165, 195, 135], [195, 225, 165], [180, 210, 150], [175, 210, 155],
      [185, 205, 145], [175, 220, 160], [170, 215, 150], [190, 205, 155],
      [180, 200, 155], [190, 215, 165], [175, 205, 150], [185, 220, 160],
    ],
    textBase: [80, 100, 50],
  },
  // Mountains - gray tones (reduce blue, add more gray/purple, brighter)
  "Mountains": {
    base: [220, 220, 210],
    variations: [
      [210, 210, 200], [230, 230, 220], [215, 215, 205], [225, 225, 215],
      [205, 205, 195], [235, 235, 225], [220, 220, 210], [215, 220, 215],
      [225, 215, 205], [215, 230, 220], [210, 225, 215], [230, 215, 220],
      [220, 215, 200], [230, 225, 210], [215, 220, 205], [225, 230, 215],
    ],
    textBase: [100, 100, 90],
  },
  // Hills - softer gray-green tones (more green, less blue, brighter)
  "Hills": {
    base: [210, 220, 185],
    variations: [
      [200, 210, 175], [220, 230, 195], [205, 215, 180], [215, 225, 190],
      [195, 205, 170], [225, 235, 200], [210, 220, 185], [205, 220, 190],
      [215, 215, 180], [205, 230, 195], [200, 225, 190], [220, 215, 195],
      [210, 215, 180], [220, 225, 190], [205, 220, 185], [215, 230, 195],
    ],
    textBase: [90, 100, 65],
  },
  // Tundra - cool gray tones (reduce blue dominance, brighter)
  "Tundra": {
    base: [220, 230, 215], // Less blue, brighter, more neutral
    variations: [
      [210, 220, 205], [230, 240, 225], [215, 225, 210], [225, 235, 220],
      [205, 215, 200], [235, 245, 230], [220, 230, 215], [215, 230, 220],
      [225, 225, 210], [215, 240, 225], [210, 235, 220], [230, 225, 225],
      [220, 225, 210], [230, 235, 220], [215, 230, 215], [225, 240, 225],
    ],
    textBase: [100, 110, 95],
  },
  // Lake - cyan/green tones (reduce blue, add more cyan/green, brighter)
  "Lake": {
    base: [210, 230, 220], // Less pure blue, more cyan/green, brighter
    variations: [
      [200, 220, 210], [220, 240, 230], [205, 225, 215], [215, 235, 225],
      [195, 215, 205], [225, 245, 235], [210, 230, 220], [205, 230, 225],
      [215, 225, 215], [205, 240, 230], [200, 235, 225], [220, 225, 230],
      [210, 220, 220], [220, 235, 230], [205, 230, 220], [215, 240, 235],
    ],
    textBase: [80, 100, 90],
  },
  // Ocean - already skipped, but just in case (reduce blue, brighter)
  "Ocean": {
    base: [200, 220, 210], // Less blue, brighter, more neutral
    variations: [
      [190, 210, 200], [210, 230, 220], [195, 215, 205], [205, 225, 215],
      [185, 205, 195], [215, 235, 225], [200, 220, 210], [195, 220, 215],
      [205, 215, 205], [195, 230, 220], [190, 225, 215], [210, 215, 220],
    ],
    textBase: [80, 100, 90],
  },
  // Cavern (underground) - darker gray tones (add subtle color variations, brighter, less blue)
  "cavern": {
    base: [180, 180, 170],
    variations: [
      [170, 170, 160], [190, 190, 180], [175, 175, 165], [185, 185, 175],
      [165, 165, 155], [195, 195, 185], [180, 180, 170], [175, 180, 175],
      [185, 175, 165], [175, 190, 180], [170, 185, 175], [190, 175, 180],
      [180, 175, 165], [190, 185, 175], [175, 180, 170], [185, 190, 180],
    ],
    textBase: [70, 70, 60],
  },
  // Default - neutral warm tones (more variety, less blue, brighter)
  "default": {
    base: [240, 235, 220],
    variations: [
      [230, 225, 210], [250, 245, 230], [235, 230, 215], [245, 240, 225],
      [225, 220, 205], [255, 250, 235], [240, 235, 220], [235, 235, 220],
      [245, 230, 215], [235, 245, 230], [230, 240, 225], [250, 230, 230],
      [240, 240, 225], [250, 235, 235], [235, 240, 220], [245, 245, 230],
    ],
    textBase: [120, 115, 100],
  },
};

// Generate color variation within a palette
const generateColorVariation = (baseColor, seed, variationRange = 30) => {
  const rng = (n) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };
  
  // Generate variation within range, keeping it in bright pastel range (200-255)
  // More vivid and lighter colors
  const variation = (rng(1) - 0.5) * variationRange;
  return baseColor.map((channel, idx) => {
    // Add more variation per channel for more diversity
    const channelVariation = (rng(1 + idx) - 0.5) * variationRange;
    const varied = channel + variation + channelVariation * 0.3;
    // Keep in bright pastel range (200-255) for more vivid, lighter colors
    return Math.max(200, Math.min(255, Math.round(varied)));
  });
};

// Generate text colors with more variety - not just dark versions
const generateTextColor = (bgColor, seed, regionType = null) => {
  const rng = (n) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };
  
  // Get palette for text color options
  const palette = REGION_COLOR_PALETTES[regionType] || REGION_COLOR_PALETTES["default"];
  
  // Generate text color with more variety - more vivid and colorful
  // Use different approach: create contrasting but colorful text (lighter, more vibrant)
  const textColorOptions = [
    // Lighter complementary colors (more vibrant)
    [Math.min(220, bgColor[2] + 60), Math.min(220, bgColor[0] + 60), Math.min(220, bgColor[1] + 60)],
    // Warmer vibrant tones
    [Math.min(240, bgColor[0] + 80), Math.min(220, bgColor[1] + 60), Math.min(200, bgColor[2] + 40)],
    // Cooler vibrant tones
    [Math.min(220, bgColor[0] + 40), Math.min(240, bgColor[1] + 80), Math.min(240, bgColor[2] + 80)],
    // Purple/pink vibrant tones
    [Math.min(240, bgColor[0] + 60), Math.min(200, bgColor[1] + 40), Math.min(240, bgColor[2] + 80)],
    // Yellow/orange vibrant tones
    [Math.min(250, bgColor[0] + 100), Math.min(240, bgColor[1] + 80), Math.min(200, bgColor[2] + 40)],
    // Cyan/teal vibrant tones
    [Math.min(200, bgColor[0] + 40), Math.min(250, bgColor[1] + 100), Math.min(250, bgColor[2] + 100)],
    // Medium contrast (darker but still colorful)
    [Math.max(100, bgColor[0] - 80), Math.max(100, bgColor[1] - 80), Math.max(100, bgColor[2] - 80)],
  ];
  
  // Select a text color option based on seed
  const textIdx = Math.floor(rng(3) * textColorOptions.length);
  let textColor = textColorOptions[textIdx];
  
  // Add variation to text color for more diversity (more vibrant range)
  textColor = textColor.map((channel, idx) => {
    const variation = (rng(4 + idx) - 0.5) * 40;
    // Keep text colors in a more vibrant range (80-240) for better visibility
    return Math.max(80, Math.min(240, Math.round(channel + variation)));
  });
  
  return textColor;
};

// Generate deterministic colors based on seed and region type
const generateColors = (seed, regionType = null) => {
  const rng = (n) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };

  // Get palette for this region type
  const palette = REGION_COLOR_PALETTES[regionType] || REGION_COLOR_PALETTES["default"];
  
  // Select a variation from the palette based on seed
  const variationIdx = Math.floor(rng(1) * palette.variations.length);
  const baseBg = palette.variations[variationIdx];
  
  // Generate variation within the selected color (more variation for diversity)
  const bg = generateColorVariation(baseBg, seed, 20);
  
  // Text color - more varied and colorful, not just dark
  const text = generateTextColor(bg, seed, regionType);
  
  return {
    bg,
    text,
  };
};

// Generate procedural texture as data URL
const generateProceduralTexture = (cellKey, size = 128, regionType = null) => {
  // Create a unique seed from the cell key
  const seed = hashString(cellKey);
  
  // Get deterministic character and colors (with region type for color palette)
  const charIdx = seed % PHILOSOPHY_CHARS.length;
  const char = PHILOSOPHY_CHARS[charIdx];
  const colors = generateColors(seed, regionType);
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Draw opaque background - ensure fully opaque pastel color
  ctx.fillStyle = `rgb(${colors.bg[0]}, ${colors.bg[1]}, ${colors.bg[2]})`;
  ctx.fillRect(0, 0, size, size);
  
  // Ensure canvas is fully opaque (no transparency)
  ctx.globalAlpha = 1.0;
  
  // Draw character with better font support
  ctx.fillStyle = `rgb(${colors.text[0]}, ${colors.text[1]}, ${colors.text[2]})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Try to use a font that supports Chinese characters
  // Use larger font size for better visibility
  const fontSize = Math.floor(size * 0.65);
  const fonts = [
    'Microsoft YaHei',
    'SimSun',
    'SimHei',
    'KaiTi',
    'STKaiti',
    'Arial Unicode MS',
    'sans-serif'
  ];
  
  // Set font and try to draw
  ctx.font = `bold ${fontSize}px ${fonts.join(', ')}`;
  
  try {
    ctx.fillText(char, size / 2, size / 2);
  } catch (e) {
    // Fallback: draw a simple geometric pattern if font fails
    ctx.fillStyle = `rgb(${colors.text[0]}, ${colors.text[1]}, ${colors.text[2]})`;
    const margin = size * 0.15;
    ctx.fillRect(margin, margin, size - margin * 2, size - margin * 2);
  }
  
  // Return as data URL
  return canvas.toDataURL('image/png');
};

// Cache for generated textures
const textureCache = new Map();

// Get procedural texture with caching
export const getProceduralTexture = (cellKey, size = 128, regionType = null) => {
  const cacheKey = `${cellKey}-${size}-${regionType || 'default'}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey);
  }
  
  const textureUrl = generateProceduralTexture(cellKey, size, regionType);
  textureCache.set(cacheKey, textureUrl);
  return textureUrl;
};

// Get region texture (procedural) - uses region type for color palette
export const getRegionTex = (type, cellKey) => {
  // Generate procedural texture based on cell key and region type
  // Type determines the color palette, cellKey determines the variation
  if (cellKey) {
    return getProceduralTexture(cellKey, 128, type);
  }
  // Fallback for cells without key
  return getProceduralTexture(`region-${type || 'default'}`, 128, type);
};

// Get site texture (procedural) - sites use their own type for color palette
export const getSiteTex = (type, cellKey) => {
  // Generate procedural texture based on cell key and site type
  // Site type can also determine color palette if needed
  const key = cellKey ? `${cellKey}-site-${type || 'default'}` : `site-${type || 'default'}`;
  // Sites use a neutral palette unless we want to add site-specific palettes
  return getProceduralTexture(key, 128, null);
};

// Get figure texture (procedural) - figures use neutral palette
export const getFigureTex = (hf, cellKey) => {
  // Generate procedural texture based on figure ID or cell key
  const key = cellKey ? `${cellKey}-fig-${hf?.id || 'default'}` : `fig-${hf?.id || 'default'}`;
  return getProceduralTexture(key, 128, null);
};

// Get structure texture (procedural)
export const getStructureTex = (id, cellKey) => {
  const key = cellKey ? `${cellKey}-struct-${id || 'default'}` : `struct-${id || 'default'}`;
  return getProceduralTexture(key, 128, null);
};

// Get underground region texture (procedural)
export const getUndergroundRegionTex = (id, cellKey) => {
  const key = cellKey ? `${cellKey}-ug-${id || 'default'}` : `ug-${id || 'default'}`;
  // Underground regions could use a darker palette
  return getProceduralTexture(key, 128, "Mountain"); // Use mountain-like palette for underground
};

// Get written content texture (procedural)
export const getWrittenContentTex = (id, cellKey) => {
  const key = cellKey ? `${cellKey}-wc-${id || 'default'}` : `wc-${id || 'default'}`;
  return getProceduralTexture(key, 128, null);
};


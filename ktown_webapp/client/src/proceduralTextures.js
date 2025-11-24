// Procedural texture generation for cells
// Based on Chinese character texture generation logic
// Now supports intensity-based gradient hotspots (see colorGradients.js)

import { getCellColorRGB, calculateInfoIntensity, GRADIENT_CONFIG } from './colorGradients';

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
  // Grassland - warm earth tones with green/yellow variations (more warm, NO blue, brighter)
  "Grassland": {
    base: [220, 240, 150], // Base warm green (brighter, minimal blue)
    variations: [
      [210, 230, 140], [230, 250, 160], [215, 235, 150], [225, 245, 155],
      [205, 225, 135], [235, 255, 170], [220, 240, 150], [215, 240, 155],
      [225, 235, 160], [215, 245, 145], [210, 240, 150], [230, 245, 165],
      [240, 220, 160], [220, 250, 170], [210, 235, 155], [230, 240, 165],
    ],
    textBase: [100, 120, 50],
  },
  // Wetland - green tones (NO blue, brighter, more green)
  "Wetland": {
    base: [200, 220, 160], // More green, minimal blue, brighter
    variations: [
      [190, 210, 150], [210, 230, 170], [195, 215, 155], [205, 225, 165],
      [185, 205, 145], [215, 235, 175], [200, 220, 160], [195, 220, 165],
      [205, 215, 155], [195, 230, 170], [190, 225, 165], [210, 215, 170],
      [200, 215, 155], [210, 225, 165], [195, 220, 160], [205, 230, 170],
    ],
    textBase: [80, 100, 50],
  },
  // Desert - warm sandy/beige tones (more warm colors, brighter, NO blue)
  "Desert": {
    base: [250, 240, 180],
    variations: [
      [240, 230, 170], [255, 250, 190], [245, 235, 175], [255, 245, 185],
      [235, 225, 165], [255, 255, 195], [250, 240, 180], [245, 240, 185],
      [255, 235, 175], [245, 250, 190], [240, 245, 180], [255, 235, 175],
      [250, 230, 190], [255, 240, 200], [245, 235, 195], [255, 245, 205],
    ],
    textBase: [140, 130, 60],
  },
  // Forest - deeper green tones (more green, NO blue, brighter)
  "Forest": {
    base: [180, 210, 130],
    variations: [
      [170, 200, 120], [190, 220, 140], [175, 205, 125], [185, 215, 135],
      [165, 195, 115], [195, 225, 145], [180, 210, 130], [175, 210, 135],
      [185, 205, 125], [175, 220, 140], [170, 215, 130], [190, 205, 135],
      [180, 200, 135], [190, 215, 145], [175, 205, 130], [185, 220, 140],
    ],
    textBase: [80, 100, 40],
  },
  // Mountains - gray tones (NO blue, add more gray/warm, brighter)
  "Mountains": {
    base: [220, 220, 190],
    variations: [
      [210, 210, 180], [230, 230, 200], [215, 215, 185], [225, 225, 195],
      [205, 205, 175], [235, 235, 205], [220, 220, 190], [215, 220, 195],
      [225, 215, 185], [215, 230, 200], [210, 225, 195], [230, 215, 200],
      [220, 215, 180], [230, 225, 190], [215, 220, 185], [225, 230, 195],
    ],
    textBase: [100, 100, 70],
  },
  // Hills - softer gray-green tones (more green, NO blue, brighter)
  "Hills": {
    base: [210, 220, 165],
    variations: [
      [200, 210, 155], [220, 230, 175], [205, 215, 160], [215, 225, 170],
      [195, 205, 150], [225, 235, 180], [210, 220, 165], [205, 220, 170],
      [215, 215, 160], [205, 230, 175], [200, 225, 170], [220, 215, 175],
      [210, 215, 160], [220, 225, 170], [205, 220, 165], [215, 230, 175],
    ],
    textBase: [90, 100, 45],
  },
  // Tundra - cool gray tones (NO blue, brighter, more neutral)
  "Tundra": {
    base: [220, 230, 195], // Minimal blue, brighter, more neutral
    variations: [
      [210, 220, 185], [230, 240, 205], [215, 225, 190], [225, 235, 200],
      [205, 215, 180], [235, 245, 210], [220, 230, 195], [215, 230, 200],
      [225, 225, 190], [215, 240, 205], [210, 235, 200], [230, 225, 205],
      [220, 225, 190], [230, 235, 200], [215, 230, 195], [225, 240, 205],
    ],
    textBase: [100, 110, 75],
  },
  // Lake - green/cyan tones (NO blue, add more green, brighter)
  "Lake": {
    base: [210, 230, 190], // Minimal blue, more green, brighter
    variations: [
      [200, 220, 180], [220, 240, 200], [205, 225, 185], [215, 235, 195],
      [195, 215, 175], [225, 245, 205], [210, 230, 190], [205, 230, 195],
      [215, 225, 185], [205, 240, 200], [200, 235, 195], [220, 225, 200],
      [210, 220, 190], [220, 235, 200], [205, 230, 190], [215, 240, 205],
    ],
    textBase: [80, 100, 70],
  },
  // Ocean - already skipped, but just in case (NO blue, brighter)
  "Ocean": {
    base: [200, 220, 180], // Minimal blue, brighter, more neutral
    variations: [
      [190, 210, 170], [210, 230, 190], [195, 215, 175], [205, 225, 185],
      [185, 205, 165], [215, 235, 195], [200, 220, 180], [195, 220, 185],
      [205, 215, 175], [195, 230, 190], [190, 225, 185], [210, 215, 190],
    ],
    textBase: [80, 100, 70],
  },
  // Cavern (underground) - darker gray tones (add subtle color variations, brighter, NO blue)
  "cavern": {
    base: [180, 180, 150],
    variations: [
      [170, 170, 140], [190, 190, 160], [175, 175, 145], [185, 185, 155],
      [165, 165, 135], [195, 195, 165], [180, 180, 150], [175, 180, 155],
      [185, 175, 145], [175, 190, 160], [170, 185, 155], [190, 175, 160],
      [180, 175, 145], [190, 185, 155], [175, 180, 150], [185, 190, 160],
    ],
    textBase: [70, 70, 40],
  },
  // Default - neutral warm tones (more variety, NO blue, brighter)
  "default": {
    base: [240, 235, 200],
    variations: [
      [230, 225, 190], [250, 245, 210], [235, 230, 195], [245, 240, 205],
      [225, 220, 185], [255, 250, 215], [240, 235, 200], [235, 235, 200],
      [245, 230, 195], [235, 245, 210], [230, 240, 205], [250, 230, 210],
      [240, 240, 205], [250, 235, 215], [235, 240, 200], [245, 245, 210],
    ],
    textBase: [120, 115, 80],
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
// Now supports information intensity for gradient hotspots
const generateColors = (seed, regionType = null, cell = null) => {
  const rng = (n) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };

  // If cell is provided, use intensity-based gradient
  if (cell) {
    const intensity = calculateInfoIntensity(cell);
    const type = regionType || cell?.region?.type || "default";
    
    const baseColor = GRADIENT_CONFIG.baseColors[type] || GRADIENT_CONFIG.baseColors["default"];
    const hotspotColor = GRADIENT_CONFIG.hotspotColors[type] || GRADIENT_CONFIG.hotspotColors["default"];
    
    // Get base color from gradient
    const bgBase = getCellColorRGB(cell, regionType);
    
    // Add some variation based on seed for texture diversity
    const bg = generateColorVariation(bgBase, seed, 15); // Less variation to preserve gradient
    
    // Text color - more varied and colorful, not just dark
    const text = generateTextColor(bg, seed, regionType);
    
    return {
      bg,
      text,
      intensity, // Return intensity for debugging
    };
  }
  
  // Fallback: original palette-based system (for backward compatibility)
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
// Now supports cell parameter for intensity-based gradients
const generateProceduralTexture = (cellKey, size = 128, regionType = null, cell = null) => {
  // Create a unique seed from the cell key
  const seed = hashString(cellKey);
  
  // Get deterministic character and colors (with region type for color palette)
  const charIdx = seed % PHILOSOPHY_CHARS.length;
  const char = PHILOSOPHY_CHARS[charIdx];
  const colors = generateColors(seed, regionType, cell); // Pass cell for intensity gradients
  
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
// Now supports cell parameter for intensity-based gradients
export const getProceduralTexture = (cellKey, size = 128, regionType = null, cell = null) => {
  // Include intensity in cache key if cell is provided (for gradient variations)
  const intensityKey = cell ? `-intensity-${calculateInfoIntensity(cell).toFixed(2)}` : '';
  const cacheKey = `${cellKey}-${size}-${regionType || 'default'}${intensityKey}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey);
  }
  
  const textureUrl = generateProceduralTexture(cellKey, size, regionType, cell);
  textureCache.set(cacheKey, textureUrl);
  return textureUrl;
};

// Get region texture (procedural) - uses region type for color palette
// Now supports cell parameter for intensity-based gradients
export const getRegionTex = (type, cellKey, cell = null) => {
  // Generate procedural texture based on cell key and region type
  // Type determines the color palette, cellKey determines the variation
  // Cell parameter enables intensity-based gradient hotspots
  if (cellKey) {
    return getProceduralTexture(cellKey, 128, type, cell);
  }
  // Fallback for cells without key
  return getProceduralTexture(`region-${type || 'default'}`, 128, type, cell);
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


// Texture generation - optimized and simplified
// Creates text-based textures with 2 random letters per cell
// Colors are based on cell content and blend with neighbors organically

// Global reference to worldData for neighbor lookups
let globalWorldData = null;

// Set world data for neighbor access
export const setWorldDataForTextures = (worldData) => {
  globalWorldData = worldData;
  // Clear cache when world data changes
  textureCache.clear();
  neighborCache.clear();
  if (worldData && worldData.cells) {
    // Pre-build cell map for fast lookups
    worldData._cellMap = new Map();
    worldData.cells.forEach(cell => {
      worldData._cellMap.set(`${cell.x},${cell.y}`, cell);
    });
  }
};

// Helper to convert hex color to RGB
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Helper to convert RGB to hex
const rgbToHex = (r, g, b) => {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
};

// Deterministic hash function for consistent results
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// Optimized cache for neighbor lookups - larger cache for better performance
const neighborCache = new Map();
const MAX_CACHE_SIZE = 10000;

// Pre-calculate distance squared for faster comparison (avoid sqrt when possible)
const getNeighboringCells = (cellX, cellY, radius = 3) => {
  if (!globalWorldData || !globalWorldData.cells) return [];
  
  const cacheKey = `${cellX},${cellY},${radius}`;
  if (neighborCache.has(cacheKey)) {
    return neighborCache.get(cacheKey);
  }
  
  const neighbors = [];
  const cellMap = globalWorldData._cellMap;
  
  if (!cellMap) return [];
  
  const radiusSquared = radius * radius; // Use squared distance to avoid sqrt
  
  // Use square radius for faster calculation
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (dx === 0 && dy === 0) continue;
      
      // Check squared distance first (faster than sqrt)
      const distSquared = dx * dx + dy * dy;
      if (distSquared > radiusSquared) continue;
      
      const neighborX = cellX + dx;
      const neighborY = cellY + dy;
      const neighbor = cellMap.get(`${neighborX},${neighborY}`);
      
      if (neighbor && neighbor.region?.type !== 'Ocean') {
        // Calculate actual distance only when needed
        const distance = Math.sqrt(distSquared);
        neighbors.push({ cell: neighbor, distance });
      }
    }
  }
  
  // Cache result (limit cache size for memory)
  if (neighborCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(neighborCache.entries());
    neighborCache.clear();
    // Keep half of the cache
    entries.slice(-MAX_CACHE_SIZE / 2).forEach(([key, value]) => neighborCache.set(key, value));
  }
  neighborCache.set(cacheKey, neighbors);
  
  return neighbors;
};

// Simple hotspot spread: fast and preserves color identity
// Colors spread from hotspots, getting lighter as they spread further
let getBaseColorForCell = null; // Forward declaration

const calculateBlendedColor = (baseColor, cellX, cellY, radius = 15) => {
  if (!globalWorldData || !getBaseColorForCell) return baseColor;
  
  // Get neighbors - cached for performance
  const neighbors = getNeighboringCells(cellX, cellY, radius);
  if (neighbors.length === 0) return baseColor;
  
  const baseRgb = hexToRgb(baseColor);
  if (!baseRgb) return baseColor;
  
  // Fast accumulation of neighbor colors weighted by distance
  let totalR = 0, totalG = 0, totalB = 0, totalWeight = 0;
  let minDistance = Infinity;
  
  neighbors.forEach(({ cell, distance }) => {
    const neighborColor = getBaseColorForCell(cell);
    if (!neighborColor) return;
    
    const neighborRgb = hexToRgb(neighborColor);
    if (!neighborRgb) return;
    
    // Skip default/gray colors (they don't spread)
    if (neighborRgb.r > 220 && neighborRgb.g > 220 && neighborRgb.b > 220) return;
    
    // Weight by distance - exponential falloff
    const normalizedDist = distance / radius;
    const weight = Math.pow(1 - normalizedDist, 1.5); // Smooth falloff
    
    totalR += neighborRgb.r * weight;
    totalG += neighborRgb.g * weight;
    totalB += neighborRgb.b * weight;
    totalWeight += weight;
    
    if (distance < minDistance) minDistance = distance;
  });
  
  if (totalWeight === 0) return baseColor;
  
  // Average neighbor color
  const avgR = totalR / totalWeight;
  const avgG = totalG / totalWeight;
  const avgB = totalB / totalWeight;
  
  // Check if base is default color (gray/white)
  const isDefaultColor = baseRgb.r > 220 && baseRgb.g > 220 && baseRgb.b > 220;
  
  // Strong blend factor - colors spread aggressively from hotspots
  const blendFactor = isDefaultColor ? 0.75 : 0.55; // Default cells get more influence
  
  const r = baseRgb.r * (1 - blendFactor) + avgR * blendFactor;
  const g = baseRgb.g * (1 - blendFactor) + avgG * blendFactor;
  const b = baseRgb.b * (1 - blendFactor) + avgB * blendFactor;
  
  // Lighten based on distance - cells further from hotspot are lighter
  const lightenFactor = 1 + (minDistance / radius) * 0.25; // Lighten up to 25%
  
  return rgbToHex(
    Math.min(255, Math.round(r * lightenFactor)),
    Math.min(255, Math.round(g * lightenFactor)),
    Math.min(255, Math.round(b * lightenFactor))
  );
};

// Determine colors based on cell information - vibrant and colorful
const getColorLogic = (regionType = null, cellData = null, seed = 0) => {
  const rng = (n) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };
  
  let letterColor = '#FFFFFF';
  let outlineColor = '#000000';
  
  // Check cell content
  const hasSites = cellData?.sites && (Array.isArray(cellData.sites) ? cellData.sites.length > 0 : true);
  const hasStructures = cellData?.sites?.some(site => 
    (Array.isArray(site.structures) ? site.structures.length > 0 : site.structures)
  );
  const hasFigures = cellData?.sites?.some(site => {
    const structures = Array.isArray(site.structures) ? site.structures : [site.structures];
    return structures.some(struct => {
      const inhabitants = Array.isArray(struct?.inhabitant || struct?.inhabitants) 
        ? (struct.inhabitant || struct.inhabitants)
        : struct?.inhabitant || struct?.inhabitants ? [struct.inhabitant || struct.inhabitants] : [];
      return inhabitants.length > 0;
    });
  });
  const hasUndergroundRegions = cellData?.undergroundRegions && 
    (Array.isArray(cellData.undergroundRegions) ? cellData.undergroundRegions.length > 0 : true);
  const hasWrittenContent = cellData?.writtenContent && 
    (Array.isArray(cellData.writtenContent) ? cellData.writtenContent.length > 0 : true);
  
  // Color logic by content priority
  if (hasFigures) {
    const variants = [
      { letter: '#FF1744', outline: '#FFEA00' },
      { letter: '#FF3D00', outline: '#FFC400' },
      { letter: '#FF0000', outline: '#FFD600' },
      { letter: '#FF6F00', outline: '#FFEB3B' },
    ];
    const v = variants[Math.floor(rng(1) * variants.length)];
    letterColor = v.letter;
    outlineColor = v.outline;
  } else if (hasStructures) {
    const variants = [
      { letter: '#00E5FF', outline: '#00FFFF' },
      { letter: '#2196F3', outline: '#64B5F6' },
      { letter: '#00BCD4', outline: '#4DD0E1' },
      { letter: '#00D4FF', outline: '#18FFFF' },
    ];
    const v = variants[Math.floor(rng(2) * variants.length)];
    letterColor = v.letter;
    outlineColor = v.outline;
  } else if (hasSites) {
    const variants = [
      { letter: '#00E676', outline: '#69F0AE' },
      { letter: '#00FF00', outline: '#76FF03' },
      { letter: '#00C853', outline: '#64DD17' },
      { letter: '#00E5B0', outline: '#1DE9B6' },
    ];
    const v = variants[Math.floor(rng(3) * variants.length)];
    letterColor = v.letter;
    outlineColor = v.outline;
  } else if (hasWrittenContent) {
    const variants = [
      { letter: '#AA00FF', outline: '#E1BEE7' },
      { letter: '#E91E63', outline: '#F8BBD0' },
      { letter: '#FF00FF', outline: '#FF80AB' },
      { letter: '#9C27B0', outline: '#CE93D8' },
    ];
    const v = variants[Math.floor(rng(4) * variants.length)];
    letterColor = v.letter;
    outlineColor = v.outline;
  } else if (hasUndergroundRegions) {
    const variants = [
      { letter: '#6A1B9A', outline: '#9C4DCC' },
      { letter: '#4A148C', outline: '#7B1FA2' },
      { letter: '#311B92', outline: '#5E35B1' },
    ];
    const v = variants[Math.floor(rng(5) * variants.length)];
    letterColor = v.letter;
    outlineColor = v.outline;
  } else {
    // Region types - vibrant colors
    switch(regionType) {
      case 'Ocean':
        const ocean = [
          { letter: '#00B4DB', outline: '#00E5FF' },
          { letter: '#0093E5', outline: '#4DB8FF' },
          { letter: '#00C9FF', outline: '#5AC8FA' },
        ];
        const oc = ocean[Math.floor(rng(6) * ocean.length)];
        letterColor = oc.letter;
        outlineColor = oc.outline;
        break;
      case 'Mountain':
        const mountain = [
          { letter: '#9C27B0', outline: '#CE93D8' },
          { letter: '#673AB7', outline: '#9575CD' },
          { letter: '#7B1FA2', outline: '#AB47BC' },
        ];
        const mt = mountain[Math.floor(rng(7) * mountain.length)];
        letterColor = mt.letter;
        outlineColor = mt.outline;
        break;
      case 'Desert':
        const desert = [
          { letter: '#FFB300', outline: '#FFD54F' },
          { letter: '#FFA000', outline: '#FFC107' },
          { letter: '#FFD700', outline: '#FFEB3B' },
        ];
        const ds = desert[Math.floor(rng(8) * desert.length)];
        letterColor = ds.letter;
        outlineColor = ds.outline;
        break;
      case 'Forest':
        const forest = [
          { letter: '#2E7D32', outline: '#66BB6A' },
          { letter: '#1B5E20', outline: '#4CAF50' },
          { letter: '#00C853', outline: '#00E676' },
        ];
        const fs = forest[Math.floor(rng(9) * forest.length)];
        letterColor = fs.letter;
        outlineColor = fs.outline;
        break;
      case 'Grassland':
        const grassland = [
          { letter: '#FF6F00', outline: '#FFB74D' },
          { letter: '#FF9800', outline: '#FFB74D' },
          { letter: '#F57C00', outline: '#FFA726' },
        ];
        const gl = grassland[Math.floor(rng(10) * grassland.length)];
        letterColor = gl.letter;
        outlineColor = gl.outline;
        break;
      case 'Tundra':
        const tundra = [
          { letter: '#03A9F4', outline: '#4FC3F7' },
          { letter: '#0288D1', outline: '#29B6F6' },
          { letter: '#00BCD4', outline: '#4DD0E1' },
        ];
        const tu = tundra[Math.floor(rng(11) * tundra.length)];
        letterColor = tu.letter;
        outlineColor = tu.outline;
        break;
      case 'Glacier':
        const glacier = [
          { letter: '#B0BEC5', outline: '#CFD8DC' },
          { letter: '#90A4AE', outline: '#B0BEC5' },
          { letter: '#ECEFF1', outline: '#FFFFFF' },
        ];
        const gc = glacier[Math.floor(rng(12) * glacier.length)];
        letterColor = gc.letter;
        outlineColor = gc.outline;
        break;
      default:
        letterColor = '#E0E0E0';
        outlineColor = '#FFFFFF';
    }
  }
  
  return { letterColor, outlineColor };
};

// Get base color for a cell without blending (to avoid recursion)
getBaseColorForCell = (cell) => {
  const seed = hashString(cell.key || `cell-${cell.x}-${cell.y}`);
  const colors = getColorLogic(cell.region?.type, cell, seed);
  return colors.letterColor;
};

// Generate texture with 2 random letters
const generateTextureFromText = (cellKey, size = 128, regionType = null, textData = null, cellData = null) => {
  const seed = hashString(cellKey);
  const rng = (n) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };

  // Get base colors
  const baseColors = getColorLogic(regionType, cellData, seed);
  let letterColor = baseColors.letterColor;
  let outlineColor = baseColors.outlineColor;
  
  // Blend with neighbors - HOTSPOT SPREAD: colors spread widely from hotspots
  const cellX = cellData?.x;
  const cellY = cellData?.y;
  if (cellX != null && cellY != null && globalWorldData) {
    // Larger radius for wide spread, but optimized for speed
    letterColor = calculateBlendedColor(letterColor, cellX, cellY, 15);
    outlineColor = calculateBlendedColor(outlineColor, cellX, cellY, 12);
  }
  
  // Canvas size - optimized for performance
  const lowQualitySize = 24;
  const canvas = document.createElement('canvas');
  canvas.width = lowQualitySize;
  canvas.height = lowQualitySize;
  const ctx = canvas.getContext('2d');
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, lowQualitySize, lowQualitySize);
  
  // Generate 2 random lowercase letters
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const letter1 = letters[Math.floor(rng(1) * letters.length)];
  const letter2 = letters[Math.floor(rng(2) * letters.length)];
  
  const fontSize = lowQualitySize * 0.65;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Draw first letter
  ctx.strokeStyle = outlineColor;
  ctx.fillStyle = letterColor;
  ctx.lineWidth = Math.max(2, lowQualitySize / 16);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeText(letter1, lowQualitySize * 0.35, lowQualitySize * 0.5);
  ctx.fillText(letter1, lowQualitySize * 0.35, lowQualitySize * 0.5);
  
  // Draw second letter
  ctx.strokeText(letter2, lowQualitySize * 0.65, lowQualitySize * 0.5);
  ctx.fillText(letter2, lowQualitySize * 0.65, lowQualitySize * 0.5);
  
  // Optional third letter (50% chance)
  if (rng(3) < 0.5) {
    const letter3 = letters[Math.floor(rng(4) * letters.length)];
    const fontSize3 = lowQualitySize * 0.45;
    ctx.font = `bold ${fontSize3}px Arial, sans-serif`;
    ctx.strokeText(letter3, lowQualitySize * 0.5, lowQualitySize * 0.5);
    ctx.fillText(letter3, lowQualitySize * 0.5, lowQualitySize * 0.5);
  }
  
  // Scale up to final size
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = size;
  finalCanvas.height = size;
  const finalCtx = finalCanvas.getContext('2d');
  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = 'high';
  finalCtx.drawImage(canvas, 0, 0, lowQualitySize, lowQualitySize, 0, 0, size, size);
  
  return finalCanvas.toDataURL('image/png');
};

// Cache for generated textures
const textureCache = new Map();

// Get texture with caching
export const getProceduralTexture = (cellKey, size = 128, regionType = null, textData = null, cellData = null) => {
  const cacheKey = `${cellKey}-${size}-${regionType || 'default'}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey);
  }
  
  const textureUrl = generateTextureFromText(cellKey, size, regionType, textData, cellData);
  textureCache.set(cacheKey, textureUrl);
  return textureUrl;
};

// Get region texture
export const getRegionTex = (type, cellKey, regionData = null, cellData = null) => {
  const textData = regionData ? (typeof regionData === 'string' ? { name: regionData } : regionData) : null;
  if (cellKey) {
    return getProceduralTexture(cellKey, 128, type, textData, cellData);
  }
  return getProceduralTexture(`region-${type || 'default'}`, 128, type, textData, cellData);
};

// Get site texture
export const getSiteTex = (type, cellKey, siteData = null, cellData = null) => {
  const textData = siteData ? { name: siteData.name || siteData } : null;
  const key = cellKey ? `${cellKey}-site-${type || 'default'}` : `site-${type || 'default'}`;
  return getProceduralTexture(key, 128, null, textData, cellData);
};

// Get figure texture
export const getFigureTex = (hf, cellKey, cellData = null) => {
  const textData = hf ? { name: hf.name || hf.id || 'Unknown figure' } : null;
  const key = cellKey ? `${cellKey}-fig-${hf?.id || 'default'}` : `fig-${hf?.id || 'default'}`;
  return getProceduralTexture(key, 128, null, textData, cellData);
};

// Get structure texture
export const getStructureTex = (id, cellKey, structureData = null, cellData = null) => {
  const textData = structureData ? { name: structureData.name || structureData.type || 'Structure' } : null;
  const key = cellKey ? `${cellKey}-struct-${id || 'default'}` : `struct-${id || 'default'}`;
  return getProceduralTexture(key, 128, null, textData, cellData);
};

// Get underground region texture
export const getUndergroundRegionTex = (id, cellKey, undergroundRegionData = null, cellData = null) => {
  const textData = undergroundRegionData ? { name: undergroundRegionData.name || 'Underground Region' } : null;
  const key = cellKey ? `${cellKey}-ug-${id || 'default'}` : `ug-${id || 'default'}`;
  return getProceduralTexture(key, 128, "Mountain", textData, cellData);
};

// Get written content texture
export const getWrittenContentTex = (id, cellKey, writtenContentData = null, cellData = null) => {
  const textData = writtenContentData ? { name: writtenContentData.title || writtenContentData.name || 'Written Content' } : null;
  const key = cellKey ? `${cellKey}-wc-${id || 'default'}` : `wc-${id || 'default'}`;
  return getProceduralTexture(key, 128, null, textData, cellData);
};

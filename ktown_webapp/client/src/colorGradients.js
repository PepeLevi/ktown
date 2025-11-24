// Color Gradient System - Hotspots based on information density
// EXPERIMENT HERE: Change these values to adjust color gradients

// Calculate information intensity for a cell (0.0 to 1.0)
// More information = higher intensity = more intense colors
export const calculateInfoIntensity = (cell) => {
  if (!cell) return 0;
  
  let intensity = 0;
  const maxIntensity = 1.0;
  
  // Weight different types of information
  // EXPERIMENT: Adjust these weights to change what affects intensity
  const WEIGHTS = {
    sites: 0.3,           // Sites are important
    structures: 0.25,     // Structures add intensity
    figures: 0.2,        // Historical figures
    undergroundRegions: 0.15, // Underground regions
    writtenContents: 0.1, // Books/written content
  };
  
  // Count information
  const siteCount = (cell.sites || []).length;
  const structureCount = (cell.sites || []).reduce((sum, site) => {
    const structs = site.structures?.structure || [];
    return sum + (Array.isArray(structs) ? structs.length : (structs ? 1 : 0));
  }, 0);
  const figureCount = (cell.historical_figures || []).length + 
                      (cell.sites || []).reduce((sum, site) => {
    return sum + ((site.inhabitants || []).length);
  }, 0);
  const ugCount = (cell.undergroundRegions || []).length;
  const wcCount = (cell.written_contents || []).length;
  
  // Calculate weighted intensity
  intensity = Math.min(maxIntensity,
    (siteCount * WEIGHTS.sites) +
    (structureCount * WEIGHTS.structures) +
    (figureCount * WEIGHTS.figures) +
    (ugCount * WEIGHTS.undergroundRegions) +
    (wcCount * WEIGHTS.writtenContents)
  );
  
  // Normalize to 0-1 range (with some smoothing)
  // EXPERIMENT: Change this curve to adjust how intensity scales
  // Higher values = more aggressive scaling (hotspots more intense)
  const intensityCurve = 1.5; // 1.0 = linear, >1.0 = more intense hotspots
  intensity = Math.pow(intensity, 1 / intensityCurve);
  
  return intensity;
};

// Color gradient configuration
// EXPERIMENT HERE: Change these colors to create different gradient effects
export const GRADIENT_CONFIG = {
  // Base colors for each region type (low intensity)
  baseColors: {
    "Grassland": [220, 240, 150],   // Light green
    "Wetland": [200, 220, 160],     // Light green-blue
    "Desert": [250, 240, 180],      // Light beige
    "Forest": [180, 210, 130],      // Medium green
    "Mountains": [220, 220, 190],   // Light gray
    "Hills": [210, 220, 165],       // Light gray-green
    "Tundra": [220, 230, 195],      // Light gray-blue
    "Lake": [210, 230, 190],        // Light green-blue
    "Ocean": [200, 220, 180],       // Light blue-green
    "cavern": [180, 180, 150],      // Dark gray
    "default": [240, 235, 200],     // Light beige
  },
  
  // Hotspot colors (high intensity) - vibrant, intense colors
  // EXPERIMENT: Change these to create different hotspot effects
  hotspotColors: {
    "Grassland": [255, 200, 100],   // Bright orange-yellow (hotspot)
    "Wetland": [100, 255, 150],     // Bright green (hotspot)
    "Desert": [255, 180, 80],       // Bright orange (hotspot)
    "Forest": [100, 255, 120],      // Bright green (hotspot)
    "Mountains": [255, 220, 150],   // Bright yellow-orange (hotspot)
    "Hills": [255, 200, 120],       // Bright orange (hotspot)
    "Tundra": [200, 255, 220],      // Bright cyan (hotspot)
    "Lake": [100, 200, 255],        // Bright blue (hotspot)
    "Ocean": [100, 180, 255],       // Bright blue (hotspot)
    "cavern": [255, 150, 100],      // Bright red-orange (hotspot)
    "default": [255, 200, 100],     // Bright orange (hotspot)
  },
  
  // Intensity curve - how intensity affects color blending
  // EXPERIMENT: Change this to adjust gradient smoothness
  // 1.0 = linear, <1.0 = smoother, >1.0 = more aggressive
  intensityCurve: 1.2,
  
  // Minimum intensity threshold - below this, use base color
  // EXPERIMENT: Set to 0 to always use gradients, higher to only show hotspots
  minIntensityThreshold: 0.0,
};

// Interpolate color based on intensity
// intensity: 0.0 (base) to 1.0 (hotspot)
export const getColorForIntensity = (baseColor, hotspotColor, intensity) => {
  const { intensityCurve, minIntensityThreshold } = GRADIENT_CONFIG;
  
  // Apply threshold
  if (intensity < minIntensityThreshold) {
    intensity = 0;
  }
  
  // Apply curve for smooth/aggressive transitions
  const curvedIntensity = Math.pow(intensity, intensityCurve);
  
  // Interpolate between base and hotspot
  const r = Math.round(baseColor[0] + (hotspotColor[0] - baseColor[0]) * curvedIntensity);
  const g = Math.round(baseColor[1] + (hotspotColor[1] - baseColor[1]) * curvedIntensity);
  const b = Math.round(baseColor[2] + (hotspotColor[2] - baseColor[2]) * curvedIntensity);
  
  // Clamp to valid RGB range
  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
  ];
};

// Get color for a cell based on region type and information intensity
export const getCellColorWithIntensity = (cell, regionType = null) => {
  const intensity = calculateInfoIntensity(cell);
  const type = regionType || cell?.region?.type || "default";
  
  const baseColor = GRADIENT_CONFIG.baseColors[type] || GRADIENT_CONFIG.baseColors["default"];
  const hotspotColor = GRADIENT_CONFIG.hotspotColors[type] || GRADIENT_CONFIG.hotspotColors["default"];
  
  const color = getColorForIntensity(baseColor, hotspotColor, intensity);
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
};

// Get RGB array for procedural texture generation
export const getCellColorRGB = (cell, regionType = null) => {
  const intensity = calculateInfoIntensity(cell);
  const type = regionType || cell?.region?.type || "default";
  
  const baseColor = GRADIENT_CONFIG.baseColors[type] || GRADIENT_CONFIG.baseColors["default"];
  const hotspotColor = GRADIENT_CONFIG.hotspotColors[type] || GRADIENT_CONFIG.hotspotColors["default"];
  
  return getColorForIntensity(baseColor, hotspotColor, intensity);
};


// Texture generation using text from queen.json
// Creates text-based textures using region names and other data from queen.json
// Uses deterministic seeds to ensure consistent textures for each cell

// Image services that provide real architectural/cathedral images (low quality for performance)
const ARCHITECTURAL_IMAGE_SERVICES = {
  // Picsum Photos - deterministic random photos (very reliable)
  picsumArchitecture: (seed, size = 100) => {
    // Use different seeds for variety - architecture, cathedral, building, stone, etc.
    const themes = ['architecture', 'cathedral', 'building', 'stone', 'gothic', 'arch'];
    const theme = themes[Math.floor(seed / 1000) % themes.length];
    return `https://picsum.photos/seed/${theme}${seed}/${size}/${size}`;
  },
  
  // Placeholder.com - simple placeholder (fastest fallback)
  placeholderArchitecture: (seed, size = 100) => {
    return `https://via.placeholder.com/${size}`;
  },
  
  // Lorem Picsum with architectural seed variations
  loremPicsum1: (seed, size = 100) => {
    return `https://picsum.photos/seed/cathedral${seed}/${size}/${size}`;
  },
  
  loremPicsum2: (seed, size = 100) => {
    return `https://picsum.photos/seed/architecture${seed}/${size}/${size}`;
  },
  
  loremPicsum3: (seed, size = 100) => {
    return `https://picsum.photos/seed/building${seed}/${size}/${size}`;
  }
};

// Try loading architectural image from multiple sources with fallbacks (low quality for performance)
const loadImageWithFallback = async (primaryUrl, seed) => {
  const lowQualitySize = 100; // Small size for low quality/performance
  
  // Try architectural image services with fallbacks (low quality thumbnails)
  const services = [
    () => loadImage(primaryUrl, 3000), // Primary URL
    () => loadImage(ARCHITECTURAL_IMAGE_SERVICES.picsumArchitecture(seed, lowQualitySize), 3000), // Picsum architecture
    () => loadImage(ARCHITECTURAL_IMAGE_SERVICES.loremPicsum1(seed, lowQualitySize), 3000), // Cathedral theme
    () => loadImage(ARCHITECTURAL_IMAGE_SERVICES.loremPicsum2(seed, lowQualitySize), 3000), // Architecture theme
    () => loadImage(ARCHITECTURAL_IMAGE_SERVICES.loremPicsum3(seed, lowQualitySize), 3000), // Building theme
  ];
  
  for (const service of services) {
    try {
      const img = await service();
      return img;
    } catch (error) {
      // Silently try next service (only log if all fail)
      continue;
    }
  }
  
  // All services failed, create a simple fallback pattern
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  // Create a simple stone-like pattern
  ctx.fillStyle = '#C0C0C0';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#808080';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 8, 0);
    ctx.lineTo(i * 8, 64);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * 8);
    ctx.lineTo(64, i * 8);
    ctx.stroke();
  }
  
  return canvas;
};

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

// Draw abstract character-like pattern on canvas
const drawAbstractCharacter = (ctx, size, color, seed) => {
  const rng = (n) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };
  
  const padding = size * 0.1;
  const innerSize = size - padding * 2;
  const baseX = padding;
  const baseY = padding;
  
  // Set stroke style
  ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  ctx.lineWidth = Math.max(1, size / 32);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Choose pattern style based on seed
  const styleIdx = Math.floor(rng(0) * PATTERN_STYLES.length);
  const style = PATTERN_STYLES[styleIdx];
  
  if (style === 'dense') {
    // Many intersecting strokes
    const numStrokes = 4 + Math.floor(rng(1) * 5);
    for (let i = 0; i < numStrokes; i++) {
      if (rng(i + 10) < 0.5) {
        // Horizontal stroke
        const y = baseY + Math.floor(rng(i + 20) * innerSize);
        ctx.beginPath();
        ctx.moveTo(baseX + 2, y);
        ctx.lineTo(baseX + innerSize - 2, y);
        ctx.stroke();
      } else {
        // Vertical stroke
        const x = baseX + Math.floor(rng(i + 30) * innerSize);
        ctx.beginPath();
        ctx.moveTo(x, baseY + 2);
        ctx.lineTo(x, baseY + innerSize - 2);
        ctx.stroke();
      }
    }
  } else if (style === 'sparse') {
    // Fewer, longer strokes
    const numStrokes = 2 + Math.floor(rng(1) * 3);
    for (let i = 0; i < numStrokes; i++) {
      const choice = rng(i + 40);
      if (choice < 0.4) {
        // Horizontal stroke
        const y = baseY + 4 + Math.floor(rng(i + 50) * (innerSize - 8));
        const startX = baseX + Math.floor(rng(i + 60) * (innerSize / 3));
        const endX = baseX + innerSize * 2 / 3 + Math.floor(rng(i + 70) * (innerSize / 3));
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      } else if (choice < 0.7) {
        // Vertical stroke
        const x = baseX + 4 + Math.floor(rng(i + 80) * (innerSize - 8));
        const startY = baseY + Math.floor(rng(i + 90) * (innerSize / 3));
        const endY = baseY + innerSize * 2 / 3 + Math.floor(rng(i + 100) * (innerSize / 3));
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
      } else {
        // Diagonal stroke
        if (rng(i + 110) < 0.5) {
          ctx.beginPath();
          ctx.moveTo(baseX + 4, baseY + 4);
          ctx.lineTo(baseX + innerSize - 4, baseY + innerSize - 4);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(baseX + innerSize - 4, baseY + 4);
          ctx.lineTo(baseX + 4, baseY + innerSize - 4);
          ctx.stroke();
        }
      }
    }
  } else if (style === 'vertical') {
    // Vertical lines with horizontal connectors
    const numVert = 2 + Math.floor(rng(1) * 3);
    const xPositions = [];
    for (let i = 0; i < numVert; i++) {
      xPositions.push(baseX + 2 + Math.floor(rng(i + 120) * (innerSize - 4)));
    }
    xPositions.sort((a, b) => a - b);
    
    // Draw vertical lines
    xPositions.forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, baseY + 2);
      ctx.lineTo(x, baseY + innerSize - 2);
      ctx.stroke();
    });
    
    // Add horizontal connectors
    const numConnectors = 1 + Math.floor(rng(2) * 3);
    for (let i = 0; i < numConnectors && xPositions.length > 1; i++) {
      const y = baseY + 4 + Math.floor(rng(i + 130) * (innerSize - 8));
      ctx.beginPath();
      ctx.moveTo(xPositions[0], y);
      ctx.lineTo(xPositions[xPositions.length - 1], y);
      ctx.stroke();
    }
  } else if (style === 'horizontal') {
    // Horizontal lines with vertical connectors
    const numHoriz = 2 + Math.floor(rng(1) * 3);
    const yPositions = [];
    for (let i = 0; i < numHoriz; i++) {
      yPositions.push(baseY + 2 + Math.floor(rng(i + 140) * (innerSize - 4)));
    }
    yPositions.sort((a, b) => a - b);
    
    // Draw horizontal lines
    yPositions.forEach(y => {
      ctx.beginPath();
      ctx.moveTo(baseX + 2, y);
      ctx.lineTo(baseX + innerSize - 2, y);
      ctx.stroke();
    });
    
    // Add vertical connectors
    const numConnectors = 1 + Math.floor(rng(2) * 3);
    for (let i = 0; i < numConnectors && yPositions.length > 1; i++) {
      const x = baseX + 4 + Math.floor(rng(i + 150) * (innerSize - 8));
      ctx.beginPath();
      ctx.moveTo(x, yPositions[0]);
      ctx.lineTo(x, yPositions[yPositions.length - 1]);
      ctx.stroke();
    }
  } else if (style === 'boxy') {
    // Box-like structures (radicals)
    const numBoxes = 1 + Math.floor(rng(1) * 3);
    for (let i = 0; i < numBoxes; i++) {
      const boxX = baseX + Math.floor(rng(i + 160) * (innerSize / 2));
      const boxY = baseY + Math.floor(rng(i + 170) * (innerSize / 2));
      const boxW = 8 + Math.floor(rng(i + 180) * (innerSize / 3));
      const boxH = 8 + Math.floor(rng(i + 190) * (innerSize / 3));
      
      if (rng(i + 200) < 0.7) {
        // Draw box outline
        ctx.strokeRect(boxX, boxY, boxW, boxH);
      } else {
        // Just top and left
        ctx.beginPath();
        ctx.moveTo(boxX, boxY);
        ctx.lineTo(boxX + boxW, boxY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(boxX, boxY);
        ctx.lineTo(boxX, boxY + boxH);
        ctx.stroke();
      }
    }
    
    // Add some strokes inside/around boxes
    const numExtraStrokes = 1 + Math.floor(rng(3) * 3);
    for (let i = 0; i < numExtraStrokes; i++) {
      if (rng(i + 210) < 0.5) {
        const y = baseY + 2 + Math.floor(rng(i + 220) * (innerSize - 4));
        ctx.beginPath();
        ctx.moveTo(baseX + 2, y);
        ctx.lineTo(baseX + innerSize - 2, y);
        ctx.stroke();
      } else {
        const x = baseX + 2 + Math.floor(rng(i + 230) * (innerSize - 4));
        ctx.beginPath();
        ctx.moveTo(x, baseY + 2);
        ctx.lineTo(x, baseY + innerSize - 2);
        ctx.stroke();
      }
    }
  } else if (style === 'curved') {
    // More flowing, curved strokes
    const numStrokes = 3 + Math.floor(rng(1) * 4);
    for (let i = 0; i < numStrokes; i++) {
      const numPoints = 2 + Math.floor(rng(i + 240) * 3);
      ctx.beginPath();
      for (let j = 0; j < numPoints; j++) {
        const x = baseX + Math.floor(rng(i + j + 250) * innerSize);
        const y = baseY + Math.floor(rng(i + j + 260) * innerSize);
        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  } else if (style === 'face') {
    // Simple face pattern - eyes, nose, mouth
    const centerX = baseX + innerSize / 2;
    const centerY = baseY + innerSize / 2;
    const faceWidth = innerSize * 0.6;
    const faceHeight = innerSize * 0.7;
    
    // Face outline (oval)
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, faceWidth / 2, faceHeight / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // Eyes
    const eyeY = centerY - innerSize * 0.15;
    const eyeSpacing = innerSize * 0.2;
    const eyeSize = innerSize * 0.08;
    
    // Left eye
    ctx.beginPath();
    ctx.arc(centerX - eyeSpacing, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.stroke();
    if (rng(1) < 0.5) {
      ctx.fill();
    }
    
    // Right eye
    ctx.beginPath();
    ctx.arc(centerX + eyeSpacing, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.stroke();
    if (rng(2) < 0.5) {
      ctx.fill();
    }
    
    // Nose (simple line or triangle)
    if (rng(3) < 0.5) {
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(centerX, eyeY + eyeSize);
      ctx.lineTo(centerX, centerY + innerSize * 0.1);
      ctx.stroke();
    } else {
      // Triangle
      ctx.beginPath();
      ctx.moveTo(centerX, eyeY + eyeSize);
      ctx.lineTo(centerX - innerSize * 0.05, centerY + innerSize * 0.1);
      ctx.lineTo(centerX + innerSize * 0.05, centerY + innerSize * 0.1);
      ctx.closePath();
      ctx.stroke();
    }
    
    // Mouth
    const mouthY = centerY + innerSize * 0.2;
    const mouthWidth = innerSize * 0.15;
    if (rng(4) < 0.5) {
      // Smile (arc)
      ctx.beginPath();
      ctx.arc(centerX, mouthY, mouthWidth, 0, Math.PI);
      ctx.stroke();
    } else {
      // Straight line
      ctx.beginPath();
      ctx.moveTo(centerX - mouthWidth, mouthY);
      ctx.lineTo(centerX + mouthWidth, mouthY);
      ctx.stroke();
    }
  } else if (style === 'greek_mask') {
    // Greek theater mask pattern - stylized face with dramatic features
    const centerX = baseX + innerSize / 2;
    const centerY = baseY + innerSize / 2;
    const maskWidth = innerSize * 0.65;
    const maskHeight = innerSize * 0.75;
    
    // Mask outline (rounded top, pointed or rounded bottom)
    ctx.beginPath();
    ctx.moveTo(centerX - maskWidth / 2, centerY - maskHeight / 2);
    ctx.quadraticCurveTo(centerX - maskWidth / 2, centerY - maskHeight / 2 - innerSize * 0.1, centerX, centerY - maskHeight / 2 - innerSize * 0.1);
    ctx.quadraticCurveTo(centerX + maskWidth / 2, centerY - maskHeight / 2 - innerSize * 0.1, centerX + maskWidth / 2, centerY - maskHeight / 2);
    ctx.lineTo(centerX + maskWidth / 2, centerY + maskHeight / 2);
    if (rng(1) < 0.5) {
      // Pointed chin
      ctx.lineTo(centerX, centerY + maskHeight / 2 + innerSize * 0.1);
      ctx.lineTo(centerX - maskWidth / 2, centerY + maskHeight / 2);
    } else {
      // Rounded chin
      ctx.quadraticCurveTo(centerX, centerY + maskHeight / 2 + innerSize * 0.1, centerX - maskWidth / 2, centerY + maskHeight / 2);
    }
    ctx.closePath();
    ctx.stroke();
    
    // Large dramatic eyes
    const eyeY = centerY - innerSize * 0.1;
    const eyeSpacing = innerSize * 0.25;
    const eyeWidth = innerSize * 0.12;
    const eyeHeight = innerSize * 0.15;
    
    // Left eye (almond shape)
    ctx.beginPath();
    ctx.ellipse(centerX - eyeSpacing, eyeY, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (rng(2) < 0.7) {
      ctx.fill();
    }
    
    // Right eye
    ctx.beginPath();
    ctx.ellipse(centerX + eyeSpacing, eyeY, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (rng(3) < 0.7) {
      ctx.fill();
    }
    
    // Nose (vertical line or simple shape)
    ctx.beginPath();
    ctx.moveTo(centerX, eyeY + eyeHeight);
    ctx.lineTo(centerX, centerY + innerSize * 0.15);
    ctx.stroke();
    
    // Mouth (dramatic expression)
    const mouthY = centerY + innerSize * 0.25;
    const mouthWidth = innerSize * 0.2;
    if (rng(4) < 0.5) {
      // Open mouth (O shape)
      ctx.beginPath();
      ctx.arc(centerX, mouthY, mouthWidth * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Wide mouth (arc)
      ctx.beginPath();
      ctx.arc(centerX, mouthY, mouthWidth, 0, Math.PI);
      ctx.stroke();
    }
    
    // Optional decorative lines (forehead, cheeks)
    if (rng(5) < 0.5) {
      // Forehead lines
      ctx.beginPath();
      ctx.moveTo(centerX - maskWidth / 3, centerY - maskHeight / 2);
      ctx.lineTo(centerX + maskWidth / 3, centerY - maskHeight / 2);
      ctx.stroke();
    }
  } else if (style === 'rostros') {
    // Rostros (faces) - more detailed face pattern with variations
    const centerX = baseX + innerSize / 2;
    const centerY = baseY + innerSize / 2;
    const faceWidth = innerSize * 0.55;
    const faceHeight = innerSize * 0.65;
    
    // Face shape (can be round, oval, or square-ish)
    const faceShape = Math.floor(rng(1) * 3);
    if (faceShape === 0) {
      // Round
      ctx.beginPath();
      ctx.arc(centerX, centerY, faceWidth / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (faceShape === 1) {
      // Oval
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, faceWidth / 2, faceHeight / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Square-ish with rounded corners
      const cornerRadius = innerSize * 0.1;
      ctx.beginPath();
      ctx.moveTo(centerX - faceWidth / 2 + cornerRadius, centerY - faceHeight / 2);
      ctx.lineTo(centerX + faceWidth / 2 - cornerRadius, centerY - faceHeight / 2);
      ctx.quadraticCurveTo(centerX + faceWidth / 2, centerY - faceHeight / 2, centerX + faceWidth / 2, centerY - faceHeight / 2 + cornerRadius);
      ctx.lineTo(centerX + faceWidth / 2, centerY + faceHeight / 2 - cornerRadius);
      ctx.quadraticCurveTo(centerX + faceWidth / 2, centerY + faceHeight / 2, centerX + faceWidth / 2 - cornerRadius, centerY + faceHeight / 2);
      ctx.lineTo(centerX - faceWidth / 2 + cornerRadius, centerY + faceHeight / 2);
      ctx.quadraticCurveTo(centerX - faceWidth / 2, centerY + faceHeight / 2, centerX - faceWidth / 2, centerY + faceHeight / 2 - cornerRadius);
      ctx.lineTo(centerX - faceWidth / 2, centerY - faceHeight / 2 + cornerRadius);
      ctx.quadraticCurveTo(centerX - faceWidth / 2, centerY - faceHeight / 2, centerX - faceWidth / 2 + cornerRadius, centerY - faceHeight / 2);
      ctx.closePath();
      ctx.stroke();
    }
    
    // Eyes with more variation
    const eyeY = centerY - innerSize * 0.12;
    const eyeSpacing = innerSize * 0.18;
    const eyeSize = innerSize * 0.06 + Math.floor(rng(2) * innerSize * 0.04);
    
    // Left eye
    const leftEyeX = centerX - eyeSpacing;
    if (rng(3) < 0.7) {
      // Circular eye
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeY, eyeSize, 0, Math.PI * 2);
      ctx.stroke();
      if (rng(4) < 0.6) {
        ctx.fill();
      }
    } else {
      // Almond eye
      ctx.beginPath();
      ctx.ellipse(leftEyeX, eyeY, eyeSize * 1.2, eyeSize * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Right eye
    const rightEyeX = centerX + eyeSpacing;
    if (rng(5) < 0.7) {
      ctx.beginPath();
      ctx.arc(rightEyeX, eyeY, eyeSize, 0, Math.PI * 2);
      ctx.stroke();
      if (rng(6) < 0.6) {
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(rightEyeX, eyeY, eyeSize * 1.2, eyeSize * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Eyebrows (optional)
    if (rng(7) < 0.6) {
      const browY = eyeY - eyeSize * 1.5;
      // Left brow
      ctx.beginPath();
      ctx.moveTo(leftEyeX - eyeSize, browY);
      ctx.lineTo(leftEyeX + eyeSize, browY);
      ctx.stroke();
      // Right brow
      ctx.beginPath();
      ctx.moveTo(rightEyeX - eyeSize, browY);
      ctx.lineTo(rightEyeX + eyeSize, browY);
      ctx.stroke();
    }
    
    // Nose
    const noseY = centerY + innerSize * 0.05;
    const noseType = Math.floor(rng(8) * 3);
    if (noseType === 0) {
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(centerX, eyeY + eyeSize);
      ctx.lineTo(centerX, noseY);
      ctx.stroke();
    } else if (noseType === 1) {
      // Two lines (nostrils)
      ctx.beginPath();
      ctx.moveTo(centerX - innerSize * 0.03, eyeY + eyeSize);
      ctx.lineTo(centerX - innerSize * 0.05, noseY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centerX + innerSize * 0.03, eyeY + eyeSize);
      ctx.lineTo(centerX + innerSize * 0.05, noseY);
      ctx.stroke();
    } else {
      // Triangle
      ctx.beginPath();
      ctx.moveTo(centerX, eyeY + eyeSize);
      ctx.lineTo(centerX - innerSize * 0.04, noseY);
      ctx.lineTo(centerX + innerSize * 0.04, noseY);
      ctx.closePath();
      ctx.stroke();
    }
    
    // Mouth
    const mouthY = centerY + innerSize * 0.2;
    const mouthWidth = innerSize * 0.12 + Math.floor(rng(9) * innerSize * 0.06);
    const mouthType = Math.floor(rng(10) * 3);
    if (mouthType === 0) {
      // Smile
      ctx.beginPath();
      ctx.arc(centerX, mouthY, mouthWidth, 0, Math.PI);
      ctx.stroke();
    } else if (mouthType === 1) {
      // Frown
      ctx.beginPath();
      ctx.arc(centerX, mouthY + mouthWidth * 0.3, mouthWidth, Math.PI, 0);
      ctx.stroke();
    } else {
      // Straight line
      ctx.beginPath();
      ctx.moveTo(centerX - mouthWidth, mouthY);
      ctx.lineTo(centerX + mouthWidth, mouthY);
      ctx.stroke();
    }
  }
};

// Load image from URL with timeout (shorter timeout for faster services)
const loadImage = (url, timeout = 3000) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    let timeoutId;
    let resolved = false;
    
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
    };
    
    img.onload = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(img);
    };
    
    img.onerror = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(new Error(`Failed to load image from ${url}`));
    };
    
    // Set timeout (shorter for faster services)
    timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(new Error(`Image load timeout for ${url}`));
    }, timeout);
    
    img.src = url;
  });
};


// Convert hex to RGB
const hexToRgb = (hex) => {
  if (!hex) return [0, 0, 0];
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
};

// Convert RGB to hex
const rgbToHex = (r, g, b) => {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
};

// Blend two RGB colors
const blendRgb = (rgb1, rgb2, factor) => {
  return [
    Math.round(rgb1[0] * (1 - factor) + rgb2[0] * factor),
    Math.round(rgb1[1] * (1 - factor) + rgb2[1] * factor),
    Math.round(rgb1[2] * (1 - factor) + rgb2[2] * factor)
  ];
};

// Calculate content amount for a cell to determine opacity
const calculateCellContentAmount = (cellData) => {
  if (!cellData) return 0;
  
  let contentCount = 0;
  
  // Count sites
  if (cellData.sites) {
    contentCount += Array.isArray(cellData.sites) ? cellData.sites.length : 1;
    
    // Count structures within sites
    if (Array.isArray(cellData.sites)) {
      cellData.sites.forEach(site => {
        const structures = site.structures?.structure || site.structures;
        if (structures) {
          contentCount += Array.isArray(structures) ? structures.length : 1;
          
          // Count figures in structures
          (Array.isArray(structures) ? structures : [structures]).forEach(struct => {
            const inhabitants = struct.inhabitants || struct.historical_figures;
            if (inhabitants) {
              contentCount += Array.isArray(inhabitants) ? inhabitants.length : 1;
            }
          });
        }
      });
    }
  }
  
  // Count underground regions
  if (cellData.undergroundRegions) {
    contentCount += Array.isArray(cellData.undergroundRegions) ? cellData.undergroundRegions.length : 1;
  }
  
  // Count cell-level figures
  if (cellData.historical_figures) {
    contentCount += Array.isArray(cellData.historical_figures) ? cellData.historical_figures.length : 1;
  }
  
  // Count written content
  if (cellData.written_contents) {
    contentCount += Array.isArray(cellData.written_contents) ? cellData.written_contents.length : 1;
  }
  
  return contentCount;
};

// Generate texture with 2 random letters - low quality, black background, black letters with white outline
// Determine colors based on cell information
const getColorLogic = (regionType = null, cellData = null, cellKey = null) => {
  let letterColor = 'black'; // Default letter color
  let outlineColor = 'white'; // Default outline color
  let backgroundColor = 'black'; // Always black background
  
  // Check if cell has content
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
  
  // Check if this is a hotspot (has important content)
  const isHotspot = hasFigures || hasStructures || hasSites || hasWrittenContent;
  // Check if ONLY has underground regions
  const onlyUnderground = hasUndergroundRegions && !isHotspot;
  
  // Hotspot colors (pure, intense colors)
  let hotspotColor = null;
  let hotspotOutlineColor = null;
  
  if (hasFigures) {
    hotspotColor = '#FF6B6B'; // Red/orange
    hotspotOutlineColor = '#FFD93D'; // Yellow
  } else if (hasStructures) {
    hotspotColor = '#4ECDC4'; // Cyan/turquoise
    hotspotOutlineColor = '#95E1D3'; // Light cyan
  } else if (hasSites) {
    hotspotColor = '#A8E6CF'; // Light green
    hotspotOutlineColor = '#FFD3B6'; // Light orange
  } else if (hasWrittenContent) {
    hotspotColor = '#FFAAA5'; // Light red
    hotspotOutlineColor = '#FFD3A5'; // Light peach
  }
  
  // If it's a hotspot, use pure color
  if (isHotspot && hotspotColor) {
    letterColor = hotspotColor;
    outlineColor = hotspotOutlineColor;
  } else if (onlyUnderground && cellKey) {
    // Only underground regions - check for nearby hotspots and create VERY subtle gradient
    const purpleColor = '#B4A7D6';
    const purpleOutline = '#D4AFB9';
    
    // Try to extract coordinates from cellKey
    let cellX = null, cellY = null;
    const coordMatch = cellKey.match(/(\d+)[-_](\d+)/);
    if (coordMatch) {
      cellX = parseInt(coordMatch[1]);
      cellY = parseInt(coordMatch[2]);
    }
    
    // Find nearest hotspot (very subtle effect)
    let nearestHotspotColor = null;
    let nearestDistance = Infinity;
    let nearestOutlineColor = null;
    
    // Check only immediate neighbors (radius 1-2 for subtle effect)
    const maxRadius = 2;
    
    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > radius || dist === 0) continue;
          
          let neighborKey;
          if (cellX !== null && cellY !== null) {
            neighborKey = `${cellX + dx}-${cellY + dy}`;
          } else {
            neighborKey = `${cellKey}-n${dx}-${dy}`;
          }
          
          const neighborSeed = hashString(neighborKey);
          const neighborRng = (n) => {
            const x = Math.sin(neighborSeed + n) * 10000;
            return x - Math.floor(x);
          };
          
          // Lower probability for more subtle effect
          const clusterFactor = Math.sin(neighborSeed * 0.1) * 0.5 + 0.5;
          const neighborIsHotspot = neighborRng(100) < (0.08 + clusterFactor * 0.12); // 8-20% chance
          
          if (neighborIsHotspot) {
            // Determine hotspot type
            const neighborType = Math.floor(neighborRng(200) * 4);
            let neighborColor = null;
            let neighborOutline = null;
            
            if (neighborType === 0) {
              neighborColor = '#FF6B6B';
              neighborOutline = '#FFD93D';
            } else if (neighborType === 1) {
              neighborColor = '#4ECDC4';
              neighborOutline = '#95E1D3';
            } else if (neighborType === 2) {
              neighborColor = '#A8E6CF';
              neighborOutline = '#FFD3B6';
            } else {
              neighborColor = '#FFAAA5';
              neighborOutline = '#FFD3A5';
            }
            
            if (dist < nearestDistance) {
              nearestDistance = dist;
              nearestHotspotColor = neighborColor;
              nearestOutlineColor = neighborOutline;
            }
          }
        }
      }
      
      if (nearestHotspotColor) break; // Use nearest hotspot
    }
    
    // Very subtle blend - only slight tint of hotspot color
    if (nearestHotspotColor && nearestDistance <= maxRadius) {
      // Very subtle gradient: distance 1 = 20% hotspot, distance 2 = 10% hotspot
      const maxBlend = 0.2; // Maximum 20% hotspot influence (very subtle)
      const blendFactor = maxBlend * (1 - (nearestDistance - 1) / (maxRadius - 1));
      
      const purpleRgb = hexToRgb(purpleColor);
      const hotspotRgb = hexToRgb(nearestHotspotColor);
      const blendedRgb = blendRgb(purpleRgb, hotspotRgb, blendFactor);
      
      letterColor = rgbToHex(blendedRgb[0], blendedRgb[1], blendedRgb[2]);
      
      // Very subtle outline blend
      const purpleOutlineRgb = hexToRgb(purpleOutline);
      const hotspotOutlineRgb = hexToRgb(nearestOutlineColor);
      const blendedOutlineRgb = blendRgb(purpleOutlineRgb, hotspotOutlineRgb, blendFactor * 0.7);
      outlineColor = rgbToHex(blendedOutlineRgb[0], blendedOutlineRgb[1], blendedOutlineRgb[2]);
    } else {
      // No hotspot nearby, use pure purple
      letterColor = purpleColor;
      outlineColor = purpleOutline;
    }
  } else {
    // Base cells - color by region type
    switch(regionType) {
      case 'Ocean':
        letterColor = '#5DADE2'; // Blue
        outlineColor = '#85C1E9'; // Light blue
        break;
      case 'Mountain':
        letterColor = '#A569BD'; // Purple
        outlineColor = '#BB8FCE'; // Light purple
        break;
      case 'Desert':
        letterColor = '#F4D03F'; // Yellow
        outlineColor = '#F7DC6F'; // Light yellow
        break;
      case 'Forest':
        letterColor = '#52BE80'; // Green
        outlineColor = '#7DCEA0'; // Light green
        break;
      case 'Grassland':
        letterColor = '#F8C471'; // Orange
        outlineColor = '#FAD7A0'; // Light orange
        break;
      case 'Tundra':
        letterColor = '#AED6F1'; // Light blue
        outlineColor = '#D6EAF8'; // Very light blue
        break;
      case 'Glacier':
        letterColor = '#EBF5FB'; // Very light blue/white
        outlineColor = '#D6EAF8'; // Light blue
        break;
      default:
        letterColor = '#E8E8E8'; // Light grey
        outlineColor = '#FFFFFF'; // White
    }
  }
  
  return { letterColor, outlineColor, backgroundColor };
};

const generateTextureFromText = (cellKey, size = 128, regionType = null, textData = null, cellData = null) => {
  // Create a unique seed from the cell key
  const seed = hashString(cellKey);
  
  // Use seed for deterministic randomness
  const rng = (n) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };
  
  // Get colors based on cell information (pass cellKey for subtle gradient)
  const { letterColor, outlineColor, backgroundColor } = getColorLogic(regionType, cellData, cellKey);
  
  // VERY LOW QUALITY: Use extremely small canvas size for very low quality rendering
  const lowQualitySize = 16; // Extremely small for very low quality
  const scale = size / lowQualitySize;
  
  // Create canvas with background color
  const canvas = document.createElement('canvas');
  canvas.width = lowQualitySize;
  canvas.height = lowQualitySize;
  const ctx = canvas.getContext('2d');
  
  // Disable image smoothing for pixelated/low quality look
  ctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingQuality = 'low';
  
  // Background color
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, lowQualitySize, lowQualitySize);
  
  // Generate 2 random lowercase letters (a-z) based on seed
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const letter1 = letters[Math.floor(rng(1) * letters.length)];
  const letter2 = letters[Math.floor(rng(2) * letters.length)];
  
  // Large font size relative to small canvas
  const fontSize = lowQualitySize * 0.7;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Draw first letter (left side)
  const letter1X = lowQualitySize * 0.35;
  const letter1Y = lowQualitySize * 0.5;
  
  // Outline (stroke) with color from logic
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1;
  ctx.strokeText(letter1, letter1X, letter1Y);
  
  // Fill with letter color from logic
  ctx.fillStyle = letterColor;
  ctx.fillText(letter1, letter1X, letter1Y);
  
  // Draw second letter (right side)
  const letter2X = lowQualitySize * 0.65;
  const letter2Y = lowQualitySize * 0.5;
  
  // Outline (stroke) with color from logic
  ctx.strokeStyle = outlineColor;
  ctx.strokeText(letter2, letter2X, letter2Y);
  
  // Fill with letter color from logic
  ctx.fillStyle = letterColor;
  ctx.fillText(letter2, letter2X, letter2Y);
  
  // Sometimes add a third overlapping letter on top (50% chance)
  if (rng(3) < 0.5) {
    const letter3 = letters[Math.floor(rng(4) * letters.length)];
    const letter3X = lowQualitySize * 0.5;
    const letter3Y = lowQualitySize * 0.5;
    const letter3FontSize = lowQualitySize * 0.5;
    
    ctx.font = `bold ${letter3FontSize}px Arial, sans-serif`;
    
    // Outline with color from logic
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1;
    ctx.strokeText(letter3, letter3X, letter3Y);
    
    // Fill with letter color from logic
    ctx.fillStyle = letterColor;
    ctx.fillText(letter3, letter3X, letter3Y);
  }
  
  // Scale up canvas to target size for final output (but keep low quality)
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = size;
  finalCanvas.height = size;
  const finalCtx = finalCanvas.getContext('2d');
  finalCtx.imageSmoothingEnabled = false;
  finalCtx.imageSmoothingQuality = 'low';
  finalCtx.drawImage(canvas, 0, 0, lowQualitySize, lowQualitySize, 0, 0, size, size);
  
  // Return as PNG
  return finalCanvas.toDataURL('image/png');
};

// Cache for generated textures (stores promises to handle async loading)
const textureCache = new Map();
const imageCache = new Map(); // Cache for loaded images

// Get texture with caching (synchronous - generates text-based textures locally)
export const getProceduralTexture = (cellKey, size = 128, regionType = null, textData = null, cellData = null) => {
  const cacheKey = `${cellKey}-${size}-${regionType || 'default'}-${textData?.name || 'no-text'}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey);
  }
  
  // Generate text-based texture synchronously (fast, local generation)
  const textureUrl = generateTextureFromText(cellKey, size, regionType, textData, cellData);
  textureCache.set(cacheKey, textureUrl);
  return textureUrl;
};

// Get region texture - uses region type for color palette and region name for text
export const getRegionTex = (type, cellKey, regionData = null, cellData = null) => {
  // Generate texture based on cell key, region type, region name/text, and cell data for content calculation
  const textData = regionData ? (typeof regionData === 'string' ? { name: regionData } : regionData) : null;
  if (cellKey) {
    return getProceduralTexture(cellKey, 128, type, textData, cellData);
  }
  // Fallback for cells without key
  return getProceduralTexture(`region-${type || 'default'}`, 128, type, textData, cellData);
};

// Get site texture - sites use their own type for color palette and site name for text
export const getSiteTex = (type, cellKey, siteData = null, cellData = null) => {
  // Generate texture based on cell key, site type, and site name/text
  const textData = siteData ? { name: siteData.name || siteData } : null;
  const key = cellKey ? `${cellKey}-site-${type || 'default'}` : `site-${type || 'default'}`;
  return getProceduralTexture(key, 128, null, textData, cellData);
};

// Get figure texture - figures use neutral palette and figure name for text
export const getFigureTex = (hf, cellKey, cellData = null) => {
  // Generate texture based on figure ID or cell key and figure name
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
  // Underground regions could use a darker palette
  return getProceduralTexture(key, 128, "Mountain", textData, cellData); // Use mountain-like palette for underground
};

// Get written content texture
export const getWrittenContentTex = (id, cellKey, writtenContentData = null, cellData = null) => {
  const textData = writtenContentData ? { name: writtenContentData.title || writtenContentData.name || 'Written Content' } : null;
  const key = cellKey ? `${cellKey}-wc-${id || 'default'}` : `wc-${id || 'default'}`;
  return getProceduralTexture(key, 128, null, textData, cellData);
};


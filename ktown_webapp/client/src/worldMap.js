// src/WorldMap.jsx
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import {
  getRegionTex,
  getSiteTex,
  getFigureTex,
} from "./proceduralTextures";

const regionColor = "yellow";
const siteColor = "blue";
const structureColor = "green";
const figureColor = "pink";
const bookColor = "white";

const CELL_SIZE = 30;
const CELL_GAP = 0;

// zoom limits
const MIN_ZOOM = 1;
const MAX_ZOOM = 160;

// LOD Configuration - for optimizing large maps
const LOD_CONFIG = {
  maxCellsToRender: 400, // Maximum individual cells/blocks to render at once (performance limit)
  minCellsToCombine: 300, // Only combine cells if more than this many visible
  maxCellsPerBlock: 40, // Maximum cells per block
  zoomUpdateThrottle: 50, // Throttle zoom updates (ms) for smoother performance
  // Block sizes based on zoom - progressive subdivision
  // Zoom 1-3: 8x8 blocks (64 cells)
  // Zoom 4-6: 4x4 blocks (16 cells)
  // Zoom 7-9: 2x2 blocks (4 cells)
  // Zoom 10+: individual cells
};

// Hierarchical zoom thresholds - defines when each level becomes visible
// This is extensible: add new levels by adding entries to this array
// When a level is visible, it SUBDIVIDES its parent completely (fractal subdivision)
// Subdivision is procedural - only shows as you zoom in
const HIERARCHY_LEVELS = [
  {
    name: "cell",
    minZoom: 1, // Always visible
    getChildren: (cell) => {
      // Cell can contain: sites, underground regions, cell-level historical figures, written contents
      const children = [];
      if (cell.sites && cell.sites.length > 0) children.push(...cell.sites.map(s => ({ type: 'site', data: s })));
      if (cell.undergroundRegions && cell.undergroundRegions.length > 0) {
        children.push(...cell.undergroundRegions.map(ug => ({ type: 'undergroundRegion', data: ug })));
      }
      if (cell.historical_figures && cell.historical_figures.length > 0) {
        children.push(...cell.historical_figures.map(hf => ({ type: 'cellFigure', data: hf })));
      }
      if (cell.written_contents && cell.written_contents.length > 0) {
        children.push(...cell.written_contents.map(wc => ({ type: 'writtenContent', data: wc })));
      }
      return children;
    },
    sizeRatio: 1.0, // Full cell size
  },
  {
    name: "undergroundRegion",
    minZoom: 3, // Show underground regions when zoom >= 3
    getChildren: () => [], // Leaf nodes
    sizeRatio: 1.0,
  },
  {
    name: "site",
    minZoom: 5, // Show sites when zoom >= 5 - they subdivide the cell
    getChildren: (site) => {
      const structures = site.data?.structures?.structure || site.structures?.structure;
      if (!structures) return [];
      return Array.isArray(structures) ? structures : [structures];
    },
    sizeRatio: 1.0, // Sites fill the entire cell when visible (fractal subdivision)
  },
  {
    name: "structure",
    minZoom: 15, // Show structures when zoom >= 15 - they subdivide the site
    getChildren: (structure) => {
      // Structures contain inhabitants (historical figures)
      return structure.inhabitants || [];
    },
    sizeRatio: 1.0, // Structures fill the entire site when visible (fractal subdivision)
  },
  {
    name: "figure",
    minZoom: 40, // Show figures when zoom >= 40 - they subdivide the structure
    getChildren: () => [], // Figures are leaf nodes
    sizeRatio: 1.0, // Figures fill the entire structure when visible (fractal subdivision)
  },
  {
    name: "cellFigure",
    minZoom: 8, // Show cell-level figures when zoom >= 8
    getChildren: () => [], // Leaf nodes
    sizeRatio: 1.0,
  },
  {
    name: "writtenContent",
    minZoom: 10, // Show written contents (books) when zoom >= 10
    getChildren: () => [], // Leaf nodes
    sizeRatio: 1.0,
  },
];

// Calculate Fibonacci-style fractal subdivision in a square
// Dynamic: works with any count, creating square-like subdivisions
// Pattern: always divide the largest dimension, creating recursive Fibonacci-like pattern
// 2 subdivisions: half left (1), half right (2) - vertical split
// 3 subdivisions: half left (1), right half split horizontally: top (2), bottom (3)
// 4 subdivisions: half left (1), right half: top square (2), bottom split: left (3), right (4)
// Recursive: always divide the largest remaining area to maintain square-like proportions
function calculateGridPositions(
  index,
  count,
  boundingBoxWidth,
  boundingBoxHeight,
  offsetX = 0,
  offsetY = 0
) {
  if (count === 0) return { x: 0, y: 0, width: 0, height: 0 };
  
  if (count === 1) {
    // Single element fills entire parent space
    return { 
      x: offsetX, 
      y: offsetY, 
      width: boundingBoxWidth, 
      height: boundingBoxHeight 
    };
  }

  // Determine if we should split vertically or horizontally
  // For Fibonacci pattern: always divide the larger dimension to create more square-like shapes
  const isWide = boundingBoxWidth >= boundingBoxHeight;
  
  if (index === 0) {
    // First element always takes half of the larger dimension
    if (isWide) {
      // Vertical split: left half (creates a square-like left portion)
      return {
        x: offsetX,
        y: offsetY,
        width: boundingBoxWidth / 2,
        height: boundingBoxHeight
      };
    } else {
      // Horizontal split: top half (creates a square-like top portion)
      return {
        x: offsetX,
        y: offsetY,
        width: boundingBoxWidth,
        height: boundingBoxHeight / 2
      };
    }
  }

  // Remaining elements go in the other half, recursively subdivided
  // This creates the Fibonacci pattern: each subdivision maintains square-like proportions
  const remainingCount = count - 1;
  const remainingIndex = index - 1;
  
  if (isWide) {
    // Vertical split: remaining elements in right half, which will be subdivided recursively
    const remainingWidth = boundingBoxWidth / 2;
    return calculateGridPositions(
      remainingIndex,
      remainingCount,
      remainingWidth,
      boundingBoxHeight,
      offsetX + remainingWidth,
      offsetY
    );
  } else {
    // Horizontal split: remaining elements in bottom half, which will be subdivided recursively
    const remainingHeight = boundingBoxHeight / 2;
    return calculateGridPositions(
      remainingIndex,
      remainingCount,
      boundingBoxWidth,
      remainingHeight,
      offsetX,
      offsetY + remainingHeight
    );
  }
}


function WorldMap({
  worldData,
  onCellClick,
  onEntityClick,
  selectedCell,
  selectedEntity,
}) {
  const svgRef = useRef(null);

  const zoomBehaviorRef = useRef(null); // 🆕 store d3.zoom()
  const mapWidthRef = useRef(0); // 🆕 store map width
  const mapHeightRef = useRef(0); // 🆕 store map height
  const currentZoomRef = useRef(1); // Track current zoom level
  const focusedCellRef = useRef(null); // Track which cell is currently focused/zoomed into
  const xScaleRef = useRef(null); // Store xScale for zoom calculations
  const yScaleRef = useRef(null); // Store yScale for zoom calculations
  const zoomUpdateTimeoutRef = useRef(null); // Throttle zoom updates
  const lastRenderedZoomRef = useRef(1); // Track last rendered zoom level

  const regionTypesRef = useRef([]);
  const siteTypesRef = useRef([]);
  const figureKindsRef = useRef(["default"]);
  
  // Track drag state for cells - allow panning even when clicking on cells
  const cellDragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    threshold: 5, // pixels to consider it a drag
    timeoutId: null,
  });

  const sanitizeKey = (val) => String(val || "Unknown").replace(/\s+/g, "");

  // Sanitize for CSS selector - remove invalid characters (commas, dots, etc.)
  const sanitizeForSelector = (val) => {
    return String(val || "unknown")
      .replace(/[^a-zA-Z0-9_-]/g, "_") // Replace invalid chars with underscore
      .replace(/_+/g, "_") // Collapse multiple underscores
      .replace(/^_|_$/g, ""); // Remove leading/trailing underscores
  };

  // helper: accept single object or array and always return array
  const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  // Check if a hierarchy level should be visible at current zoom
  const isLevelVisible = (levelName) => {
    const level = HIERARCHY_LEVELS.find((l) => l.name === levelName);
    if (!level) return false;
    return currentZoomRef.current >= level.minZoom;
  };

  // Optimize visible cells - combine into blocks based on zoom level
  // Progressive subdivision: larger blocks at low zoom, smaller at high zoom
  const optimizeVisibleCells = (visibleCells, zoom) => {
    if (!visibleCells || visibleCells.length === 0) return [];
    
    // Filter out ocean cells
    const validCells = visibleCells.filter(c => c && c.region?.type !== "Ocean");
    if (validCells.length === 0) return [];
    
    // Calculate block size based on zoom - progressive subdivision
    let blockSize = 8; // Start with 8x8 blocks (64 cells) at low zoom
    if (zoom >= 10) {
      blockSize = 1; // Individual cells at high zoom
    } else if (zoom >= 7) {
      blockSize = 2; // 2x2 blocks (4 cells)
    } else if (zoom >= 4) {
      blockSize = 4; // 4x4 blocks (16 cells)
    }
    // zoom < 4: blockSize = 8 (8x8 blocks, 64 cells)
    
    // If we should use individual cells, return them
    if (blockSize === 1 || validCells.length <= LOD_CONFIG.maxCellsToRender) {
      return validCells.map(cell => ({ type: 'individual', cell }));
    }
    
    // Too many cells or low zoom - combine into blocks
    // Create a map of cells by coordinates
    const cellMap = new Map();
    validCells.forEach(cell => {
      cellMap.set(`${cell.x},${cell.y}`, cell);
    });
    
    const blocks = [];
    const cellsInBlocks = new Set();
    const blocksGrid = new Map(); // Track blocks by grid position to avoid overlaps
    
    // Create blocks in a grid pattern to avoid overlaps
    // Group cells into blocks based on their grid position
    validCells.forEach(cell => {
      const cellKey = `${cell.x},${cell.y}`;
      if (cellsInBlocks.has(cellKey)) return; // Already in a block
      
      // Calculate which block grid position this cell belongs to
      const blockGridX = Math.floor(cell.x / blockSize);
      const blockGridY = Math.floor(cell.y / blockSize);
      const blockGridKey = `${blockGridX},${blockGridY}`;
      
      // Get or create block for this grid position
      let block = blocksGrid.get(blockGridKey);
      if (!block) {
        block = {
          type: 'block',
          cells: [],
          gridX: blockGridX,
          gridY: blockGridY,
          minX: Infinity,
          maxX: -Infinity,
          minY: Infinity,
          maxY: -Infinity,
        };
        blocksGrid.set(blockGridKey, block);
        blocks.push(block);
      }
      
      // Add cell to block if it fits in the grid
      const expectedX = blockGridX * blockSize;
      const expectedY = blockGridY * blockSize;
      
      if (cell.x >= expectedX && cell.x < expectedX + blockSize &&
          cell.y >= expectedY && cell.y < expectedY + blockSize) {
        block.cells.push(cell);
        block.minX = Math.min(block.minX, cell.x);
        block.maxX = Math.max(block.maxX, cell.x);
        block.minY = Math.min(block.minY, cell.y);
        block.maxY = Math.max(block.maxY, cell.y);
        cellsInBlocks.add(cellKey);
      }
    });
    
    // Filter out blocks with too few cells (should be individual)
    const validBlocks = blocks.filter(block => block.cells.length > 1 && block.cells.length <= LOD_CONFIG.maxCellsPerBlock);
    
    // All cells not in blocks stay as individual
    const individualCells = validCells
      .filter(cell => !cellsInBlocks.has(`${cell.x},${cell.y}`))
      .map(cell => ({ type: 'individual', cell }));
    
    return [...individualCells, ...validBlocks.map(block => ({ type: 'block', block }))];
  };
  
  // Get representative cell for a block (for texture/color)
  const getBlockRepresentativeCell = (block) => {
    if (!block || !block.cells || block.cells.length === 0) return null;
    
    // Use the cell closest to the center of the block
    const centerX = Math.floor((block.minX + block.maxX) / 2);
    const centerY = Math.floor((block.minY + block.maxY) / 2);
    
    let closestCell = block.cells[0];
    let minDistance = Infinity;
    
    block.cells.forEach(cell => {
      const dx = cell.x - centerX;
      const dy = cell.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minDistance) {
        minDistance = distance;
        closestCell = cell;
      }
    });
    
    return closestCell;
  };
  
  // Get representative texture for a block - use cell at top-left corner for consistency
  const getBlockTexture = (block, xScale, yScale) => {
    if (!block || !block.cells || block.cells.length === 0) return null;
    
    // Use the cell at the top-left corner of the block for consistent texture per block
    // This ensures each block position has its own texture, not overlapping
    const topLeftCell = block.cells.find(cell => 
      cell.x === block.minX && cell.y === block.minY
    ) || block.cells[0]; // Fallback to first cell if top-left not found
    
    if (!topLeftCell) return null;
    
    // Use unique key based on block grid position for consistent texture
    const blockKey = `block-${block.gridX}-${block.gridY}`;
    const cellKey = topLeftCell.key || blockKey;
    return getRegionTex(topLeftCell.region?.type, cellKey);
  };
  
  // Render a single block - respects grid, no overlaps, uses correct coordinates
  const renderSingleBlock = (block, xScale, yScale, g) => {
    if (!block || !block.cells || block.cells.length === 0) return;
    
    // Calculate block bounds in screen space - respect original cell grid
    // Use actual cell positions, not grid-aligned rectangles (avoids overlaps)
    const blockMinX = Math.min(...block.cells.map(c => xScale(c.y)));
    const blockMaxX = Math.max(...block.cells.map(c => xScale(c.y + 1)));
    const blockMinY = Math.min(...block.cells.map(c => yScale(c.x)));
    const blockMaxY = Math.max(...block.cells.map(c => yScale(c.x + 1)));
    
    const blockBbox = {
      x: blockMinX,
      y: blockMinY,
      width: blockMaxX - blockMinX,
      height: blockMaxY - blockMinY,
    };
    
    // Get representative cell for texture and interaction
    const representativeCell = getBlockRepresentativeCell(block);
    if (!representativeCell) return;
    
    // Use unique block key based on grid position
    const blockKey = `block-${block.gridX}-${block.gridY}`;
    const texUrl = getBlockTexture(block, xScale, yScale);
    const patternKey = `block-${sanitizeForSelector(blockKey)}`;
    
    // Create rect for block - exact size based on contained cells
    const rect = g.append("rect")
      .attr("class", `cell block`)
      .attr("x", blockMinX)
      .attr("y", blockMinY)
      .attr("width", blockBbox.width)
      .attr("height", blockBbox.height)
      .style("cursor", "pointer")
      .style("pointer-events", "auto");
    
    // Apply texture
    if (texUrl) {
      const defs = d3.select(svgRef.current).select("defs");
      const pid = getOrCreatePattern(defs, patternKey, texUrl);
      if (pid) {
        rect.style("fill", `url(#${pid})`).style("opacity", 1);
      }
    } else {
      // Fallback: use representative cell's texture
      const fallbackTex = getRegionTex(representativeCell.region?.type, blockKey);
      const defs = d3.select(svgRef.current).select("defs");
      const pid = getOrCreatePattern(defs, `fallback-${patternKey}`, fallbackTex);
      if (pid) {
        rect.style("fill", `url(#${pid})`).style("opacity", 1);
      }
    }
    
    // Add click handler for blocks
    const blockCell = {
      key: blockKey,
      x: block.minX,
      y: block.minY,
      isBlock: true,
      block: block,
      region: representativeCell.region,
    };
    
    rect.on("click", (event) => {
      event.stopPropagation();
      const composed = {
        kind: "cell",
        name: `Block (${block.minX},${block.minY} to ${block.maxX},${block.maxY})`,
        type: representativeCell.region?.type || null,
        cellCoords: { x: block.minX, y: block.minY },
        cell: blockCell,
        region: representativeCell.region,
        block: block,
      };
      
      if (onEntityClick) {
        onEntityClick(composed);
      }
      if (onCellClick) {
        onCellClick(blockCell);
      }
    });
  };

  // Check if a cell is visible in the current viewport
  const isCellVisible = (cell, xScale, yScale, transform, svgNode) => {
    if (!cell || !xScale || !yScale || !transform || !svgNode) return false;
    
    const viewBox = svgNode.viewBox.baseVal;
    const { x, y, k } = transform;
    
    // Calculate cell position in world coordinates
    const cellX = xScale(cell.y);
    const cellY = yScale(cell.x);
    const cellWidth = CELL_SIZE;
    const cellHeight = CELL_SIZE;
    
    // Transform cell bounds to viewport coordinates
    const cellLeft = cellX * k + x;
    const cellRight = (cellX + cellWidth) * k + x;
    const cellTop = cellY * k + y;
    const cellBottom = (cellY + cellHeight) * k + y;
    
    // Check if cell intersects with viewport (with some padding for smooth transitions)
    const padding = CELL_SIZE * k; // Padding based on zoom level
    const viewportRight = viewBox.width + padding;
    const viewportBottom = viewBox.height + padding;
    
    return !(cellRight < -padding || cellLeft > viewportRight || 
             cellBottom < -padding || cellTop > viewportBottom);
  };
  
  // Check if a cell should subdivide based on visibility and zoom
  // Only subdivide cells that are visible in viewport (dynamic and logical)
  const shouldCellSubdivide = (cell, zoom, xScale, yScale, transform, svgNode) => {
    if (!cell || !xScale || !yScale || !transform || !svgNode) return false;
    
    // First check if cell is visible in viewport
    if (!isCellVisible(cell, xScale, yScale, transform, svgNode)) {
      return false; // Don't subdivide cells outside viewport
    }
    
    const viewBox = svgNode.viewBox.baseVal;
    const viewportCenterX = viewBox.width / 2;
    const viewportCenterY = viewBox.height / 2;
    const { x, y, k } = transform;
    
    // Transform viewport center to world coordinates
    const worldCenterX = (viewportCenterX - x) / k;
    const worldCenterY = (viewportCenterY - y) / k;
    
    // Calculate cell center
    const cellX = xScale(cell.y);
    const cellY = yScale(cell.x);
    const cellCenterX = cellX + CELL_SIZE / 2;
    const cellCenterY = cellY + CELL_SIZE / 2;
    
    // Calculate distance from viewport center (in world coordinates)
    const dx = Math.abs(cellCenterX - worldCenterX);
    const dy = Math.abs(cellCenterY - worldCenterY);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Subdivision radius based on zoom - cells closer to center subdivide first
    // More progressive: radius increases smoothly with zoom
    // At zoom 1: radius = 2 cells
    // At zoom 5: radius = ~4 cells
    // At zoom 10: radius = ~8 cells
    const baseRadius = CELL_SIZE * 2.5; // Base radius at zoom 1
    const zoomFactor = 1.3; // How much radius increases per zoom level
    const maxRadius = baseRadius * Math.pow(zoomFactor, Math.max(0, zoom - 1));
    
    // Cells closer to center and within radius should subdivide
    return distance <= maxRadius;
  };
  
  // Check if an element belongs to a cell that should subdivide
  // This is a legacy function - kept for compatibility but may not be used
  const belongsToSubdividingCell = (cell, zoom) => {
    // Fallback to simple distance check if no transform available
    const focused = focusedCellRef.current;
    if (!focused || !cell) return false;
    const dx = Math.abs(cell.x - focused.x);
    const dy = Math.abs(cell.y - focused.y);
    const distance = Math.max(dx, dy);
    const maxDistance = Math.floor((zoom - 1) / 10);
    return distance <= maxDistance;
  };

  // Get the parent level for a given level
  const getParentLevel = (levelName) => {
    const idx = HIERARCHY_LEVELS.findIndex((l) => l.name === levelName);
    return idx > 0 ? HIERARCHY_LEVELS[idx - 1] : null;
  };

  const handleLabelClick = (d) => {
    console.log("clicks label", d);
  };

  const getPatternId = (kind, key) => `pattern-${kind}-${sanitizeKey(key)}`;

  // Update visibility of elements based on zoom level (cumulative fractal subdivision)
  // All visible levels are shown together, progressively subdividing the space
  const updateElementVisibility = (gSelection, zoom, xScale, yScale) => {
    if (!gSelection || gSelection.empty()) return;
    
    const sitesVisible = isLevelVisible("site");
    const structuresVisible = isLevelVisible("structure");
    const figuresVisible = isLevelVisible("figure");
    const undergroundRegionsVisible = isLevelVisible("undergroundRegion");
    const cellFiguresVisible = isLevelVisible("cellFigure");
    const writtenContentsVisible = isLevelVisible("writtenContent");
    
    // Check if cell has any visible children
    const hasAnyVisibleChildren = (cell) => {
      const shouldSubdivide = shouldCellSubdivide(cell, zoom);
      if (!shouldSubdivide) return false;
      return (cell.sites && cell.sites.length > 0 && sitesVisible) ||
             (cell.undergroundRegions && cell.undergroundRegions.length > 0 && undergroundRegionsVisible) ||
             (cell.historical_figures && cell.historical_figures.length > 0 && cellFiguresVisible) ||
             (cell.written_contents && cell.written_contents.length > 0 && writtenContentsVisible);
    };
    
    // Update sites visibility - show if level is visible and cell subdivides
    gSelection.selectAll("rect.site-marker").each(function(d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      rect.style("opacity", (sitesVisible && shouldSubdivide) ? 1 : 0);
    });
    gSelection.selectAll("text.site-label").each(function(d) {
      const text = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      text.style("opacity", (sitesVisible && shouldSubdivide) ? 1 : 0);
    });
    
    // Update structures visibility - show if level is visible
    gSelection.selectAll("rect.structure-marker").each(function(d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      rect.style("opacity", (structuresVisible && shouldSubdivide) ? 1 : 0);
    });
    gSelection.selectAll("text.structure-label").each(function(d) {
      const text = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      text.style("opacity", (structuresVisible && shouldSubdivide) ? 1 : 0);
    });
    
    // Update figures visibility
    gSelection.selectAll("rect.figure-marker").each(function(d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      rect.style("opacity", (figuresVisible && shouldSubdivide) ? 1 : 0);
    });
    gSelection.selectAll("text.figure-label").each(function(d) {
      const text = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      text.style("opacity", (figuresVisible && shouldSubdivide) ? 1 : 0);
    });
    
    // Update underground regions visibility
    gSelection.selectAll("rect.underground-region-marker").each(function(d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      rect.style("opacity", (undergroundRegionsVisible && shouldSubdivide) ? 1 : 0);
    });
    
    // Update cell figures visibility
    gSelection.selectAll("rect.cell-figure-marker").each(function(d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      rect.style("opacity", (cellFiguresVisible && shouldSubdivide) ? 1 : 0);
    });
    
    // Update written contents visibility
    gSelection.selectAll("rect.written-content-marker").each(function(d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      rect.style("opacity", (writtenContentsVisible && shouldSubdivide) ? 1 : 0);
    });
    
    // Update cell appearance - cell is ALWAYS visible, but becomes more transparent when subdivided
    gSelection.selectAll("rect.cell").each(function(d) {
      const rect = d3.select(this);
      const hasVisibleChildren = hasAnyVisibleChildren(d);
      
      // Cell is always visible, but opacity reduces as children appear
      if (hasVisibleChildren) {
        // Cell with visible children - reduce opacity so children show through
        // More children = more transparent
        const childCount = [
          (d.sites && sitesVisible ? d.sites.length : 0),
          (d.undergroundRegions && undergroundRegionsVisible ? d.undergroundRegions.length : 0),
          (d.historical_figures && cellFiguresVisible ? d.historical_figures.length : 0),
          (d.written_contents && writtenContentsVisible ? d.written_contents.length : 0)
        ].reduce((a, b) => a + b, 0);
        
        const opacity = Math.max(0.2, 1 - (childCount * 0.1)); // More children = more transparent
        rect.style("opacity", opacity);
        rect.style("stroke", "rgba(255,255,255,0.5)").style("stroke-width", 0.5);
      } else {
        // No visible children - show full cell
        rect.style("opacity", 1);
        rect.style("stroke", null).style("stroke-width", 0);
      }
    });
    
    // Update site appearance - sites become transparent when structures appear
    gSelection.selectAll("rect.site-marker").each(function(d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      if (!shouldSubdivide) return;
      
      const structures = normalizeToArray(d.site?.structures?.structure || d.site?.data?.structures?.structure);
      const hasStructures = structures.length > 0;
      const shouldShowStructures = hasStructures && structuresVisible;
      
      if (shouldShowStructures) {
        // Structures are visible - make site semi-transparent so structures show through
        rect.style("opacity", 0.4);
        rect.style("stroke", "rgba(0,255,0,0.6)").style("stroke-width", 0.4);
      } else {
        // No structures visible - show full site
        rect.style("opacity", 1);
      }
    });
    
    // Update structure appearance - structures become transparent when figures appear
    gSelection.selectAll("rect.structure-marker").each(function(d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      if (!shouldSubdivide) return;
      
      const hasInhabitants = d.structure?.inhabitants && d.structure.inhabitants.length > 0;
      const shouldShowFigures = hasInhabitants && figuresVisible;
      
      if (shouldShowFigures) {
        // Figures are visible - make structure semi-transparent so figures show through
        rect.style("opacity", 0.4);
        rect.style("stroke", "rgba(255,192,203,0.6)").style("stroke-width", 0.4);
      } else {
        // No figures visible - show full structure
        rect.style("opacity", 1);
      }
    });
  };

  const zoomToPoint = (x, y, targetK = 8, duration = 200) => {
    const svgNode = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgNode || !zoomBehavior) return;

    const width = mapWidthRef.current || svgNode.viewBox.baseVal.width || 1;
    const height = mapHeightRef.current || svgNode.viewBox.baseVal.height || 1;

    const current = d3.zoomTransform(svgNode);
    const k = targetK ?? current.k;

    const next = d3.zoomIdentity
      .translate(width / 2, height / 2) // center of viewport
      .scale(k) // desired zoom
      .translate(-x, -y); // bring world point (x,y) to center

    d3.select(svgNode)
      .transition()
      .duration(duration)
      .call(zoomBehavior.transform, next);
  };

  // Create or get pattern for a specific cell/texture key
  const getOrCreatePattern = (defsSelection, patternKey, textureUrl) => {
    if (!defsSelection || defsSelection.empty()) {
      console.warn("getOrCreatePattern: defsSelection is empty");
      return null;
    }
    
    if (!textureUrl) {
      console.warn("getOrCreatePattern: textureUrl is missing for patternKey:", patternKey);
      return null;
    }
    
    const pid = sanitizeForSelector(`pattern-${patternKey}`);
    
    // Check if pattern already exists
    let pattern = defsSelection.select(`#${pid}`);
    if (!pattern.empty()) {
      return pid; // Pattern already exists
    }
    
    // Create new pattern
    try {
      pattern = defsSelection
        .append("pattern")
        .attr("id", pid)
        .attr("patternUnits", "objectBoundingBox")
        .attr("patternContentUnits", "objectBoundingBox")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 1)
        .attr("height", 1);

      pattern
        .append("image")
        .attr("href", textureUrl)
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 1)
        .attr("height", 1)
        .attr("preserveAspectRatio", "none"); // Stretch to fill - no aspect ratio preservation
      
      return pid;
    } catch (error) {
      console.error("getOrCreatePattern: Error creating pattern:", error, "patternKey:", patternKey);
      return null;
    }
  };

  // Recursive function to render a cell and its children
  const renderRecursiveCell = (cell, parentBbox, gSelection, xScale, yScale, level = 0) => {
    // Calculate this cell's position
    const cellX = level === 0 ? xScale(cell.y) : (parentBbox.x + (cell.bbox?.x || 0));
    const cellY = level === 0 ? yScale(cell.x) : (parentBbox.y + (cell.bbox?.y || 0));
    const cellWidth = level === 0 ? CELL_SIZE : (cell.bbox?.width || CELL_SIZE);
    const cellHeight = level === 0 ? CELL_SIZE : (cell.bbox?.height || CELL_SIZE);
    
    const cellBbox = { x: cellX, y: cellY, width: cellWidth, height: cellHeight };
    
    // If level 0 has children, the original cell is now one of the children
    // So we only render children, not the original cell itself
    // Each child should be rendered as a separate cell with its own texture
    if (level === 0 && cell.children && cell.children.length > 0) {
      // Render children directly - they fill the entire cell space
      // Each child is a separate rect with its own texture, tiling the parent space
      cell.children.forEach((child, idx) => {
        // Ensure each child has a unique key for proper rendering
        if (!child.key) {
          child.key = `${cell.key}-child-${idx}`;
        }
        // Render each child with its own texture - they tile the parent space
        renderRecursiveCell(child, cellBbox, gSelection, xScale, yScale, 1);
      });
      return; // Don't render the original cell, only its children
    }
    
    // Create rect for this cell - sanitize key for CSS selector
    // Use a more unique key that includes level and position to avoid conflicts
    const rawCellKey = cell.key || `cell-${level}-${cellX}-${cellY}`;
    // Sanitize coordinates to avoid decimal points in selectors
    const sanitizedX = Math.round(cellX * 100) / 100; // Round to 2 decimals
    const sanitizedY = Math.round(cellY * 100) / 100;
    const uniqueKeyRaw = `${rawCellKey}-${level}-${sanitizedX}-${sanitizedY}`;
    const uniqueKey = sanitizeForSelector(uniqueKeyRaw); // Fully sanitize the key
    const cellRect = gSelection.selectAll(`rect.cell-${uniqueKey}`)
      .data([{ ...cell, cellKey: uniqueKey, cellBbox }], d => d.cellKey || uniqueKey);
    
    const cellEnter = cellRect.enter()
      .append("rect")
      .attr("class", `cell cell-level-${level} cell-${uniqueKey}`)
      .attr("x", cellX)
      .attr("y", cellY)
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .style("cursor", "pointer")
      .style("pointer-events", "auto") // Ensure cells are clickable
      .style("z-index", 10); // Ensure cells are above other elements
    
    cellEnter.merge(cellRect)
      .attr("x", cellX)
      .attr("y", cellY)
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .style("cursor", "pointer")
      .style("pointer-events", "auto") // Ensure cells are clickable
      .each(function(d) {
        const rect = d3.select(this);
        const svg = d3.select(svgRef.current);
        const defs = svg.select("defs");
        
        // Skip ocean cells - don't render them
        if (level === 0 && d.region?.type === "Ocean") {
          rect.style("display", "none");
          return;
        }
        
        // Get cell key for procedural texture generation - ensure we always have a valid key
        const cellKeyForTexture = d.key || d.originalCell?.key || d.cellKey || `cell-${level}-${cellX}-${cellY}`;
        
        // Determine texture based on cell type - use procedural generation
        let texUrl = null;
        let patternKey = null;
        
        if (level === 0) {
          // Original cell - use region texture (skip if ocean)
          if (d.region?.type !== "Ocean") {
            texUrl = getRegionTex(d.region?.type, cellKeyForTexture);
            patternKey = `region-${sanitizeForSelector(cellKeyForTexture)}`;
          }
        } else if (d.isOriginalCell || d.childType === "region") {
          // This is the original cell texture in a subdivision - use region texture
          const regionType = d.childData?.type || d.originalCell?.region?.type;
          texUrl = getRegionTex(regionType, cellKeyForTexture);
          patternKey = `region-${sanitizeForSelector(cellKeyForTexture)}`;
        } else if (d.childType === "site") {
          const siteType = d.childData?.fromFile2?.type || d.childData?.fromFile1?.type || d.childData?.type || "default";
          texUrl = getSiteTex(siteType, cellKeyForTexture);
          patternKey = `site-${sanitizeForSelector(cellKeyForTexture)}-${sanitizeForSelector(siteType)}`;
        } else if (d.childType === "structure") {
          // Structures get procedural textures - use neutral palette
          const structId = d.childData?.id || d.childData?.local_id || 'default';
          texUrl = getRegionTex(null, `${cellKeyForTexture}-struct-${structId}`); // null type = default palette
          patternKey = `structure-${sanitizeForSelector(cellKeyForTexture)}-${sanitizeForSelector(String(structId))}`;
        } else if (d.childType === "figure" || d.childType === "cellFigure") {
          texUrl = getFigureTex(d.childData, cellKeyForTexture);
          patternKey = `fig-${sanitizeForSelector(cellKeyForTexture)}-${sanitizeForSelector(String(d.childData?.id || 'default'))}`;
        } else if (d.childType === "undergroundRegion") {
          // Underground regions get procedural textures - use cavern palette
          const ugId = d.childData?.id || 'default';
          texUrl = getRegionTex("cavern", `${cellKeyForTexture}-ug-${ugId}`); // Use cavern palette
          patternKey = `underground-${sanitizeForSelector(cellKeyForTexture)}-${sanitizeForSelector(String(ugId))}`;
        } else if (d.childType === "writtenContent") {
          // Written contents get procedural textures - use neutral palette
          const wcId = d.childData?.id || d.childData?.title || 'default';
          texUrl = getRegionTex(null, `${cellKeyForTexture}-wc-${wcId}`); // null type = default palette
          patternKey = `written-${sanitizeForSelector(cellKeyForTexture)}-${sanitizeForSelector(String(wcId))}`;
        } else {
          // Fallback: generate a default texture for any unknown type
          texUrl = getRegionTex(null, cellKeyForTexture);
          patternKey = `default-${sanitizeForSelector(cellKeyForTexture)}`;
        }
        
        // Apply procedural texture - ensure we always have a texture
        // This is critical: every cell MUST have a texture
        let appliedTexture = false;
        if (texUrl && patternKey) {
          const pid = getOrCreatePattern(defs, patternKey, texUrl);
          if (pid) {
            rect.style("fill", `url(#${pid})`).style("opacity", 1);
            appliedTexture = true;
          }
        }
        
        // Fallback: if texture wasn't applied, generate a default one
        if (!appliedTexture) {
          // Generate a fallback texture using the cell key
          const fallbackTexUrl = getRegionTex(null, cellKeyForTexture);
          const fallbackPatternKey = `fallback-${sanitizeForSelector(cellKeyForTexture)}`;
          const fallbackPid = getOrCreatePattern(defs, fallbackPatternKey, fallbackTexUrl);
          if (fallbackPid) {
            rect.style("fill", `url(#${fallbackPid})`).style("opacity", 1);
          } else {
            // Last resort: solid color (should never happen)
            rect.style("fill", "#f0f0f0").style("opacity", 1);
            console.warn("Failed to create texture for cell:", cellKeyForTexture);
          }
        }
        
        // Always set opacity to 1 (opaque) - no transparency
        rect.style("opacity", 1);
        
        // Optional: add subtle stroke for cells with children
        const hasVisibleChildren = d.children && d.children.length > 0;
        if (hasVisibleChildren) {
          rect.style("stroke", "rgba(255,255,255,0.3)").style("stroke-width", 0.5);
        } else {
          rect.style("stroke", null).style("stroke-width", 0);
        }
      });
    
    // Add click handler - make child cells selectable and show JSON info in right panel
    // Apply to both new and existing elements
    // Allow panning even when clicking on cells - detect drag vs click
    const cellDragState = cellDragStateRef.current;
    
    const handleCellMouseDown = (event, d) => {
      // Start tracking drag
      cellDragState.isDragging = false;
      cellDragState.startX = event.clientX;
      cellDragState.startY = event.clientY;
      
      // Clear any pending timeout
      if (cellDragState.timeoutId) {
        clearTimeout(cellDragState.timeoutId);
        cellDragState.timeoutId = null;
      }
      
      // Don't stop propagation - allow zoom to handle panning
      // We'll check in click handler if it was a drag or click
    };
    
    const handleCellMouseMove = (event) => {
      // Check if user is dragging
      if (cellDragState.startX !== 0 || cellDragState.startY !== 0) {
        const dx = Math.abs(event.clientX - cellDragState.startX);
        const dy = Math.abs(event.clientY - cellDragState.startY);
        if (dx > cellDragState.threshold || dy > cellDragState.threshold) {
          cellDragState.isDragging = true;
        }
      }
    };
    
    const handleCellClick = (event, d) => {
      // Check if user was dragging
      const wasDragging = cellDragState.isDragging;
      
      // Reset drag state after a short delay
      if (cellDragState.timeoutId) {
        clearTimeout(cellDragState.timeoutId);
      }
      cellDragState.timeoutId = setTimeout(() => {
        cellDragState.isDragging = false;
        cellDragState.startX = 0;
        cellDragState.startY = 0;
        cellDragState.timeoutId = null;
      }, 150);
      
      // If user was dragging, don't treat as click - let pan happen
      if (wasDragging) {
        event.stopPropagation();
        return; // Let pan happen, don't show info
      }
      
      event.stopPropagation();
      
      console.log("Cell clicked:", d); // Debug log
      
      // Compose entity for click - include all JSON data for display
      const originalCell = d.originalCell || d;
      
      // Ensure we have valid data
      if (!originalCell) {
        console.warn("No originalCell found in clicked cell:", d);
        return;
      }

      let composed = null;
      
      if (level === 0) {
        // Original cell - show cell information
        composed = {
          kind: "cell",
          name: `Cell (${originalCell.x}, ${originalCell.y})`,
          type: originalCell.region?.type || null,
          cellCoords: { x: originalCell.x, y: originalCell.y },
          cell: originalCell,
          region: originalCell.region,
          sites: originalCell.sites || [],
          undergroundRegions: originalCell.undergroundRegions || [],
          historical_figures: originalCell.historical_figures || [],
          written_contents: originalCell.written_contents || [],
        };
      } else {
        // Child cell - show specific child data
        if (d.childType === "site") {
          const site = d.childData;
          const siteType = site?.fromFile2?.type || site?.fromFile1?.type || site?.type || "default";
          const siteName = site?.fromFile2?.name || site?.fromFile1?.name || site?.name || "Unknown site";
          
          composed = {
            kind: "site",
            name: siteName,
            type: siteType,
            textureUrl: getSiteTex(siteType),
            regionTextureUrl: getRegionTex(originalCell.region?.type),
            cellCoords: { x: originalCell.x, y: originalCell.y },
            site: site,
            cell: originalCell,
            region: originalCell.region,
            undergroundRegions: originalCell.undergroundRegions || [],
            historical_figures: site.historical_figures || [],
            inhabitants: site.inhabitants || [],
            written_contents: site.written_contents || [],
          };
        } else if (d.childType === "structure") {
          const structure = d.childData;
          const name = structure.name || structure.type || "Structure";
          
          composed = {
            kind: "structure",
            name: name,
            type: structure.type || null,
            cellCoords: { x: originalCell.x, y: originalCell.y },
            structure: structure,
            cell: originalCell,
            region: originalCell.region,
          };
        } else if (d.childType === "figure" || d.childType === "cellFigure") {
          const hf = d.childData;
          const hfName = hf.name || hf.id || "Unknown figure";
          
          composed = {
            kind: "figure",
            name: hfName,
            textureUrl: getFigureTex(hf),
            cellCoords: { x: originalCell.x, y: originalCell.y },
            figure: hf,
            cell: originalCell,
            region: originalCell.region,
          };
        } else if (d.childType === "undergroundRegion") {
          const ug = d.childData;
          
          composed = {
            kind: "undergroundRegion",
            name: ug.name || "Underground Region",
            type: ug.type || null,
            cellCoords: { x: originalCell.x, y: originalCell.y },
            undergroundRegion: ug,
            cell: originalCell,
            region: originalCell.region,
          };
        } else if (d.childType === "writtenContent") {
          const wc = d.childData;
          
          composed = {
            kind: "writtenContent",
            name: wc.title || "Written Content",
            cellCoords: { x: originalCell.x, y: originalCell.y },
            writtenContent: wc,
            cell: originalCell,
            region: originalCell.region,
          };
        } else if (d.childType === "region") {
          // Region subdivision
          const region = d.childData || originalCell.region;
          
          composed = {
            kind: "cell",
            name: `Region: ${region?.type || "Unknown"}`,
            type: region?.type || null,
            cellCoords: { x: originalCell.x, y: originalCell.y },
            cell: originalCell,
            region: region,
            sites: originalCell.sites || [],
            undergroundRegions: originalCell.undergroundRegions || [],
            historical_figures: originalCell.historical_figures || [],
            written_contents: originalCell.written_contents || [],
          };
        }
      }
      
      console.log("Composed entity:", composed); // Debug log
      
      if (composed) {
        // Call onEntityClick to show info in EntityDetailsView
        if (onEntityClick) {
          console.log("Calling onEntityClick with:", composed);
          onEntityClick(composed);
        } else {
          console.warn("onEntityClick is not defined!");
        }
      } else {
        console.warn("No composed entity created for click");
      }
      
      // Also call onCellClick for cell selection
      if (onCellClick) {
        onCellClick(d);
      }
      
      // REMOVED: Auto-zoom on click - user should manually zoom if they want
      // This was causing unwanted camera movement when clicking on cells
    };
    
    // Apply click and drag handlers to both new and existing elements
    const mergedCells = cellEnter.merge(cellRect);
    
    // Handle mousedown to track drag start
    mergedCells.on("mousedown", handleCellMouseDown);
    
    // Handle mousemove to detect dragging
    mergedCells.on("mousemove", handleCellMouseMove);
    
    // Handle click - only show info if not dragging
    mergedCells.on("click", handleCellClick);
    
    // Reset drag state on mouseup (global to catch mouseup even if outside cell)
    // This ensures we can detect drags even if mouse leaves the cell
    d3.select(window).on("mouseup.cellDrag", () => {
      // The click handler will check drag state and reset it
      // This is just a backup reset
    });
    
    // Recursively render children
    if (cell.children && cell.children.length > 0) {
      cell.children.forEach(child => {
        renderRecursiveCell(child, cellBbox, gSelection, xScale, yScale, level + 1);
      });
    }
    
    cellRect.exit().remove();
  };

  // Calculate how many children to show progressively based on zoom
  // Dynamic Fibonacci subdivision: start with 1, then 2, 3, 4, etc. as zoom increases
  // Smooth progression: +1 child for every few zoom levels (one by one)
  const getVisibleChildCount = (totalChildren, zoom, level = 0) => {
    if (totalChildren === 0) return 0;
    if (totalChildren === 1) return 1; // Always show if only 1
    
    // Progressive formula: show children one by one as zoom increases
    // Base: 1 child at zoom 1
    // Add 1 child smoothly as zoom increases (1 by 1)
    // Level 0 (cells): +1 every 2 zoom levels (zoom 1->2, 3->4, 5->6, etc.)
    // Level 1 (sites/regions): +1 every 3 zoom levels
    // Level 2+ (deeper): +1 every 4 zoom levels
    const zoomFactor = level === 0 ? 2 : (level === 1 ? 3 : 4);
    const baseCount = 1; // Start with 1, not 2
    const additionalCount = Math.floor((zoom - 1) / zoomFactor);
    const visibleCount = Math.min(totalChildren, baseCount + additionalCount);
    
    // Ensure we show at least 1 (unless total is 0), but not more than total
    return Math.max(1, Math.min(visibleCount, totalChildren));
  };

  // Build recursive cell structure for a cell (works for both original cells and child cells)
  // Subdivision stops when there are no more children (leaf nodes)
  // Ocean cells are not rendered and don't subdivide
  const buildCellChildren = (cell, zoom, parentBbox, isChildCell = false, xScale = null, yScale = null, transform = null, svgNode = null) => {
    // Skip ocean cells - don't render or subdivide them
    if (!isChildCell && cell.region?.type === "Ocean") {
      return []; // Ocean cells are empty - no texture, no subdivision
    }
    
    // For original cells, check if they should subdivide based on visibility and zoom
    // For child cells, check if they have children and zoom level is sufficient
    if (!isChildCell && xScale && yScale && transform && svgNode) {
      if (!shouldCellSubdivide(cell, zoom, xScale, yScale, transform, svgNode)) {
        return []; // Don't subdivide this cell if not visible or too far
      }
    } else if (!isChildCell) {
      // Fallback: if we don't have transform info, use old logic
      const focused = focusedCellRef.current;
      if (focused) {
        const dx = Math.abs(cell.x - focused.x);
        const dy = Math.abs(cell.y - focused.y);
        const distance = Math.max(dx, dy);
        const maxDistance = Math.floor((zoom - 1) / 10);
        if (distance > maxDistance) {
          return [];
        }
      } else {
        return []; // No focus, don't subdivide
      }
    }
    
    const children = [];
    const allChildData = [];
    
    // For original cells, include the original cell texture as the first child
    // This makes the original cell texture part of the subdivision, not just background
    if (!isChildCell) {
      // Only add region if it's not ocean (ocean cells are skipped entirely)
      if (cell.region && cell.region.type !== "Ocean") {
        allChildData.push({ 
          type: "region", 
          data: cell.region,
          isOriginalCell: true 
        });
      }
      
      // Then collect all other child data (only if they exist)
      // Show elements one by one, not all at once when threshold is reached
      if (cell.sites && cell.sites.length > 0 && isLevelVisible("site")) {
        // Calculate how many sites to show progressively (one by one)
        const siteLevel = HIERARCHY_LEVELS.find(l => l.name === "site");
        const siteZoomFactor = 3; // +1 site every 3 zoom levels
        const siteBaseCount = 1; // Start with 1 site
        const siteAdditionalCount = Math.floor((zoom - (siteLevel?.minZoom || 5)) / siteZoomFactor);
        const visibleSiteCount = Math.min(cell.sites.length, siteBaseCount + Math.max(0, siteAdditionalCount));
        cell.sites.slice(0, visibleSiteCount).forEach(site => allChildData.push({ type: "site", data: site }));
      }
      if (cell.undergroundRegions && cell.undergroundRegions.length > 0 && isLevelVisible("undergroundRegion")) {
        // Calculate how many underground regions to show progressively
        const ugLevel = HIERARCHY_LEVELS.find(l => l.name === "undergroundRegion");
        const ugZoomFactor = 3;
        const ugBaseCount = 1;
        const ugAdditionalCount = Math.floor((zoom - (ugLevel?.minZoom || 3)) / ugZoomFactor);
        const visibleUgCount = Math.min(cell.undergroundRegions.length, ugBaseCount + Math.max(0, ugAdditionalCount));
        cell.undergroundRegions.slice(0, visibleUgCount).forEach(ug => allChildData.push({ type: "undergroundRegion", data: ug }));
      }
      if (cell.historical_figures && cell.historical_figures.length > 0 && isLevelVisible("cellFigure")) {
        // Calculate how many cell figures to show progressively
        const cfLevel = HIERARCHY_LEVELS.find(l => l.name === "cellFigure");
        const cfZoomFactor = 3;
        const cfBaseCount = 1;
        const cfAdditionalCount = Math.floor((zoom - (cfLevel?.minZoom || 8)) / cfZoomFactor);
        const visibleCfCount = Math.min(cell.historical_figures.length, cfBaseCount + Math.max(0, cfAdditionalCount));
        cell.historical_figures.slice(0, visibleCfCount).forEach(hf => allChildData.push({ type: "cellFigure", data: hf }));
      }
      if (cell.written_contents && cell.written_contents.length > 0 && isLevelVisible("writtenContent")) {
        // Calculate how many written contents to show progressively
        const wcLevel = HIERARCHY_LEVELS.find(l => l.name === "writtenContent");
        const wcZoomFactor = 3;
        const wcBaseCount = 1;
        const wcAdditionalCount = Math.floor((zoom - (wcLevel?.minZoom || 10)) / wcZoomFactor);
        const visibleWcCount = Math.min(cell.written_contents.length, wcBaseCount + Math.max(0, wcAdditionalCount));
        cell.written_contents.slice(0, visibleWcCount).forEach(wc => allChildData.push({ type: "writtenContent", data: wc }));
      }
    } else {
      // Child cell - check its type and collect children accordingly
      // Subdivision continues only if this child has its own children
      // Show elements one by one, not all at once
      if (cell.childType === "site" && cell.childData) {
        const structures = normalizeToArray(cell.childData.structures?.structure);
        if (structures.length > 0 && isLevelVisible("structure")) {
          // Calculate how many structures to show progressively (one by one)
          const structLevel = HIERARCHY_LEVELS.find(l => l.name === "structure");
          const structZoomFactor = 4; // +1 structure every 4 zoom levels
          const structBaseCount = 1; // Start with 1 structure
          const structAdditionalCount = Math.floor((zoom - (structLevel?.minZoom || 15)) / structZoomFactor);
          const visibleStructCount = Math.min(structures.length, structBaseCount + Math.max(0, structAdditionalCount));
          structures.slice(0, visibleStructCount).forEach(struct => allChildData.push({ type: "structure", data: struct }));
        }
        // If no structures, this site is a leaf - subdivision stops here
      } else if (cell.childType === "structure" && cell.childData) {
        // Structures can have figures as children
        if (cell.childData.inhabitants && cell.childData.inhabitants.length > 0 && isLevelVisible("figure")) {
          // Calculate how many figures to show progressively (one by one)
          const figLevel = HIERARCHY_LEVELS.find(l => l.name === "figure");
          const figZoomFactor = 4; // +1 figure every 4 zoom levels
          const figBaseCount = 1; // Start with 1 figure
          const figAdditionalCount = Math.floor((zoom - (figLevel?.minZoom || 40)) / figZoomFactor);
          const visibleFigCount = Math.min(cell.childData.inhabitants.length, figBaseCount + Math.max(0, figAdditionalCount));
          cell.childData.inhabitants.slice(0, visibleFigCount).forEach(hf => allChildData.push({ type: "figure", data: hf }));
        }
        // If no inhabitants, this structure is a leaf - subdivision stops here
      }
      // For other types (region, undergroundRegion, writtenContent, figure, cellFigure):
      // They are leaf nodes - no further subdivision
    }
    
    // Stop subdivision if no children - this is a leaf node
    if (allChildData.length === 0) return [];
    
    // Progressive subdivision: show more children as zoom increases
    // Start with 2, then 3, 4, 5, etc. - smooth progression
    const totalChildren = allChildData.length;
    const currentLevel = isChildCell ? (cell.level || 1) : 0;
    const visibleCount = getVisibleChildCount(totalChildren, zoom, currentLevel);
    
    // Show only the first N children (progressive reveal)
    // Each child represents an object from JSON with its own texture
    const visibleChildData = allChildData.slice(0, visibleCount);
    
    // Create child cells for visible children - each is an object with its own texture
    visibleChildData.forEach((childData, idx) => {
      // Calculate grid positions based on visible count - children fill entire parent space
      const gridPos = calculateGridPositions(
        idx,
        visibleCount, // Use visible count for grid - ensures proper tiling
        parentBbox.width,
        parentBbox.height
      );
      
      const childCell = {
        key: `${cell.key}-child-${childData.type}-${idx}`,
        level: (isChildCell ? cell.level + 1 : 1),
        parent: cell,
        originalCell: cell.originalCell || cell,
        childType: childData.type,
        childData: childData.data,
        isOriginalCell: childData.isOriginalCell || false,
        bbox: {
          x: gridPos.x,
          y: gridPos.y,
          width: gridPos.width,
          height: gridPos.height,
        },
        children: [],
      };
      
      // Recursively build children for this child cell ONLY if it has children
      // Subdivision stops when there are no more children (leaf node)
      // Each child represents an object from JSON - if it has no children, it's a leaf
      const childBbox = {
        x: 0,
        y: 0,
        width: gridPos.width,
        height: gridPos.height,
      };
      
      // Try to build children for this child cell
      // buildCellChildren will return [] if this child has no children (leaf node)
      // This ensures subdivision stops naturally when there are no more objects
      const grandChildren = buildCellChildren(childCell, zoom, childBbox, true);
      childCell.children = grandChildren; // Will be [] if no children (leaf node)
      
      children.push(childCell);
    });
    
    return children;
  };

  // 1) build map & markers
  useEffect(() => {
    if (!worldData || !worldData.cells?.length) return;

    // All rendering is done through renderRecursiveCell - no old marker system needed

    const cells = worldData.cells;

    const minX = d3.min(cells, (d) => d.x) ?? 0;
    const maxX = d3.max(cells, (d) => d.x) ?? 0;
    const minY = d3.min(cells, (d) => d.y) ?? 0;
    const maxY = d3.max(cells, (d) => d.y) ?? 0;

    const nRows = maxX - minX + 1;
    const nCols = maxY - minY + 1;

    const width = nCols * (CELL_SIZE + CELL_GAP) + CELL_GAP;
    const height = nRows * (CELL_SIZE + CELL_GAP) + CELL_GAP;

    mapWidthRef.current = width;
    mapHeightRef.current = height;

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", "100%");

    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    const g = svg.append("g");

    const xScale = d3
      .scaleLinear()
      .domain([minY, maxY])
      .range([CELL_GAP, width - CELL_GAP - CELL_SIZE]);

    const yScale = d3
      .scaleLinear()
      .domain([minX, maxX])
      .range([CELL_GAP, height - CELL_GAP - CELL_SIZE]);

    // Store scales for use in zoom handler
    xScaleRef.current = xScale;
    yScaleRef.current = yScale;

    const regionTypesWithTextures = Array.from(
      new Set(
        cells.map((c) => c.region?.type).filter((t) => t && getRegionTex(t))
      )
    );

    const siteTypesWithTextures = [];
    cells.forEach((cell) => {
      (cell.sites || []).forEach((site) => {
        const siteType =
          site?.fromFile2?.type ||
          site?.fromFile1?.type ||
          site?.type ||
          "default";
        if (getSiteTex(siteType)) siteTypesWithTextures.push(siteType);
      });
    });
    const uniqueSiteTypesWithTextures = Array.from(
      new Set(siteTypesWithTextures)
    );

    regionTypesRef.current = regionTypesWithTextures;
    siteTypesRef.current = uniqueSiteTypesWithTextures;
    figureKindsRef.current = ["default"];

    // Patterns are now created dynamically per cell - no need to pre-create them

    // Set initial zoom and clear focused cell
    currentZoomRef.current = 1;
    focusedCellRef.current = null;

    // Clear all existing cells
    g.selectAll("rect.cell").remove();

    // Get ONLY visible cells in viewport
    const currentTransform = d3.zoomTransform(svg.node());
    const visibleCells = cells.filter(cell => {
      if (!cell || cell.region?.type === "Ocean") return false;
      return isCellVisible(cell, xScale, yScale, currentTransform, svg.node());
    });
    
    // Optimize: combine some cells into blocks if too many visible
    const optimizedItems = optimizeVisibleCells(visibleCells, currentZoomRef.current);
    
    // Render items - respecting original cell coordinates
    optimizedItems.forEach(item => {
      if (item.type === 'individual') {
        // Render individual cell at its original coordinates
        const cell = item.cell;
        const cellBbox = {
          x: xScale(cell.y),  // cell.y -> x position
          y: yScale(cell.x),  // cell.x -> y position
          width: CELL_SIZE,
          height: CELL_SIZE,
        };
        
        // Build children for fractal subdivision
        const cellWithChildren = {
          ...cell,
          children: buildCellChildren(cell, currentZoomRef.current, cellBbox, false, xScale, yScale, currentTransform, svg.node()),
        };
        
        renderRecursiveCell(cellWithChildren, cellBbox, g, xScale, yScale, 0);
      } else if (item.type === 'block') {
        // Render block at correct coordinates
        renderSingleBlock(item.block, xScale, yScale, g);
      }
    });

    // Note: All rendering is now done through renderRecursiveCell - optimized, no labels
  }, [worldData]);

  // zoom
  useEffect(() => {
    if (!worldData || !worldData.cells?.length) return;

      const svg = d3.select(svgRef.current);
      const g = svg.select("g");
    const defs = svg.select("defs");

    if (g.empty()) return;

    const zoom = d3
      .zoom()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .filter((event) => {
        // Always allow wheel for zooming
        if (event.type === "wheel") return true;
        // Always allow touch events for pan/zoom
        if (event.type === "touchstart" || event.type === "touchmove")
          return true;
        // For mouse events: always allow panning with click and drag
        // Even on cells - we'll detect if it's a drag vs click in the cell handler
        if (event.type === "mousedown") {
          // Always allow panning with left mouse button (even on cells)
          // The cell click handler will check if it was a drag or click
          return event.button === 0;
        }
        return false;
      })
      .on("zoom", (event) => {
        const { x, y, k } = event.transform;
        g.attr("transform", `translate(${x},${y}) scale(${k})`);
        // Patterns are fixed size, no need to update them on zoom
        
        // Update zoom level
        const oldZoom = currentZoomRef.current;
        currentZoomRef.current = k;
        
        // Calculate which cell is at the viewport center (focused cell)
        const svgNode = svgRef.current;
        const xScale = xScaleRef.current;
        const yScale = yScaleRef.current;
        
        if (svgNode && worldData && worldData.cells && xScale && yScale) {
          const viewBox = svgNode.viewBox.baseVal;
          const viewportCenterX = viewBox.width / 2;
          const viewportCenterY = viewBox.height / 2;
          
          // Transform viewport coordinates to world coordinates
          const worldX = (viewportCenterX - x) / k;
          const worldY = (viewportCenterY - y) / k;
          
          // Find which cell contains this point
          const cells = worldData.cells;
          let focusedCell = null;
          
          for (const cell of cells) {
            const cellX = xScale(cell.y);
            const cellY = yScale(cell.x);
            if (
              worldX >= cellX &&
              worldX <= cellX + CELL_SIZE &&
              worldY >= cellY &&
              worldY <= cellY + CELL_SIZE
            ) {
              focusedCell = cell;
              break;
            }
          }
          
          // Update focused cell
          const oldFocused = focusedCellRef.current;
          focusedCellRef.current = focusedCell;
          
          // Check if we crossed any threshold that would change visibility
          const zoomChanged = HIERARCHY_LEVELS.some((level) => {
            const wasVisible = oldZoom >= level.minZoom;
            const isVisible = k >= level.minZoom;
            return wasVisible !== isVisible;
          });
          
          const focusChanged = !oldFocused || !focusedCell || oldFocused.key !== focusedCell.key;
          const transform = event.transform;
          
          // Throttle zoom updates for smoother performance
          // Only update if zoom changed significantly (to avoid excessive re-renders)
          const zoomDelta = Math.abs(k - lastRenderedZoomRef.current);
          const shouldUpdateBlocks = zoomDelta > 0.5 || zoomChanged; // Update on significant zoom change or hierarchy change
          
          // Clear any pending update
          if (zoomUpdateTimeoutRef.current) {
            clearTimeout(zoomUpdateTimeoutRef.current);
          }
          
          // Throttle updates - only update after zoom has settled
          zoomUpdateTimeoutRef.current = setTimeout(() => {
            // Only update if zoom changed significantly
            const currentZoomDelta = Math.abs(k - lastRenderedZoomRef.current);
            if (shouldUpdateBlocks || currentZoomDelta > 0.3) {
              lastRenderedZoomRef.current = k;
              
              // Use requestAnimationFrame for smooth rendering
              requestAnimationFrame(() => {
            // Rebuild based on current zoom and viewport
            const svgNode = svgRef.current;
            const allCells = worldData.cells;
            
            // Clear existing cells
            g.selectAll("rect.cell").remove();
            
            // Get ONLY visible cells in viewport
            const visibleCells = allCells.filter(cell => {
              if (!cell || cell.region?.type === "Ocean") return false;
              return isCellVisible(cell, xScale, yScale, transform, svgNode);
            });
            
            // Optimize: combine some cells into blocks if too many visible
            const optimizedItems = optimizeVisibleCells(visibleCells, k);
            
            // Render items - respecting original cell coordinates
            optimizedItems.forEach(item => {
              if (item.type === 'individual') {
                // Render individual cell at its original coordinates
                const cell = item.cell;
                const cellBbox = {
                  x: xScale(cell.y),  // cell.y -> x position
                  y: yScale(cell.x),  // cell.x -> y position
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                };
                
                // Build children for fractal subdivision
                const cellWithChildren = {
                  ...cell,
                  children: buildCellChildren(cell, k, cellBbox, false, xScale, yScale, transform, svgNode),
                };
                
                renderRecursiveCell(cellWithChildren, cellBbox, g, xScale, yScale, 0);
              } else if (item.type === 'block') {
                // Render block at correct coordinates
                renderSingleBlock(item.block, xScale, yScale, g);
              }
            });
              });
            }
          }, LOD_CONFIG.zoomUpdateThrottle);
        }
      });

    // Enable pan with click and drag (left mouse button)
    svg.call(zoom);
    zoomBehaviorRef.current = zoom;
    svg.on("dblclick.zoom", null);
    
    // Enable panning: click and drag to move the map
    // D3 zoom already handles this, but we ensure it works smoothly

    const initialTransform = d3.zoomIdentity.translate(0, 0).scale(1);
    svg.call(zoom.transform, initialTransform);

    return () => {
      svg.on(".zoom", null);
    };
  }, [worldData]);

  // highlight selected entity - optimized for recursive cells only
  useEffect(() => {
    if (!selectedEntity) return;
    
    const svg = d3.select(svgRef.current);
    if (svg.empty()) return;

    // Highlight based on selected entity - works with recursive cell system
    const allCellRects = svg.selectAll("rect.cell");
    
    allCellRects.each(function (d) {
      const rect = d3.select(this);
      let isSelected = false;
      
      // Check if this cell matches the selected entity
      if (selectedEntity.kind === "cell" && d.originalCell && 
          selectedEntity.cell && selectedEntity.cell.key === d.originalCell.key) {
        isSelected = true;
      } else if (selectedEntity.kind === d.childType && d.childData) {
        // Check if child data matches
        if (selectedEntity.childData && d.childData.id === selectedEntity.childData.id) {
          isSelected = true;
        }
      }

      if (isSelected) {
        rect.style("stroke", "#f97316").style("stroke-width", 2);
      } else {
        rect.style("stroke", null).style("stroke-width", 0);
      }
    });
  }, [selectedEntity]);

  return (
    <div className="map-wrapper">
      <svg ref={svgRef} />
    </div>
  );
}

export default WorldMap;

// src/WorldMap.jsx
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { getRegionTex, getSiteTex, getFigureTex } from "./proceduralTextures";
import Minimap from "./Minimap";

const regionColor = "yellow";
const siteColor = "blue";
const structureColor = "green";
const figureColor = "pink";
const bookColor = "white";

const CELL_SIZE = 30;
const CELL_GAP = 0;

// zoom limits
// MIN_ZOOM will be calculated dynamically based on manageable cell count
let MIN_ZOOM = 1; // Will be calculated
const MAX_ZOOM = 9000;

// Performance: Maximum cells visible at minimum zoom (zoom out limit)
const MAX_VISIBLE_CELLS_AT_MIN_ZOOM = 650; // Adjust this for performance

// LOD Configuration - for optimizing large maps
const LOD_CONFIG = {
  maxCellsToRender: 400, // Maximum individual cells/blocks to render at once (performance limit)
  minCellsToCombine: 300, // Only combine cells if more than this many visible
  maxCellsPerBlock: 40, // Maximum cells per block
  zoomUpdateThrottle: 0, // No throttling - update constantly for smooth transitions
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
      if (cell.sites && cell.sites.length > 0)
        children.push(...cell.sites.map((s) => ({ type: "site", data: s })));
      if (cell.undergroundRegions && cell.undergroundRegions.length > 0) {
        children.push(
          ...cell.undergroundRegions.map((ug) => ({
            type: "undergroundRegion",
            data: ug,
          }))
        );
      }
      if (cell.historical_figures && cell.historical_figures.length > 0) {
        children.push(
          ...cell.historical_figures.map((hf) => ({
            type: "cellFigure",
            data: hf,
          }))
        );
      }
      if (cell.written_contents && cell.written_contents.length > 0) {
        children.push(
          ...cell.written_contents.map((wc) => ({
            type: "writtenContent",
            data: wc,
          }))
        );
      }
      return children;
    },
    sizeRatio: 1.0, // Full cell size
  },
  {
    name: "undergroundRegion",
    minZoom: 2, // Show underground regions when zoom >= 20 (much higher zoom)
    getChildren: () => [], // Leaf nodes
    sizeRatio: 1.0,
  },
  {
    name: "site",
    minZoom: 3, // Show sites when zoom >= 30 - they subdivide the cell (much higher zoom)
    getChildren: (site) => {
      const structures =
        site.data?.structures?.structure || site.structures?.structure;
      if (!structures) return [];
      return Array.isArray(structures) ? structures : [structures];
    },
    sizeRatio: 1.0, // Sites fill the entire cell when visible (fractal subdivision)
  },
  {
    name: "structure",
    minZoom: 4, // Show structures when zoom >= 50 - they subdivide the site (much higher zoom)
    getChildren: (structure) => {
      // Structures contain inhabitants (historical figures)
      return structure.inhabitants || [];
    },
    sizeRatio: 1.0, // Structures fill the entire site when visible (fractal subdivision)
  },
  {
    name: "figure",
    minZoom: 5, // Show figures when zoom >= 80 - they subdivide the structure (much higher zoom)
    getChildren: () => [], // Figures are leaf nodes
    sizeRatio: 1.0, // Figures fill the entire structure when visible (fractal subdivision)
  },
  {
    name: "cellFigure",
    minZoom: 5, // Show cell-level figures when zoom >= 25 (much higher zoom)
    getChildren: () => [], // Leaf nodes
    sizeRatio: 1.0,
  },
  {
    name: "writtenContent",
    minZoom: 6, // Show written contents (books) when zoom >= 35 (much higher zoom)
    getChildren: () => [], // Leaf nodes
    sizeRatio: 1.0,
  },
];

const getSiteStructures = (site) => {
  if (!site) return [];

  let structures = [];

  // console.log("WHAT SITE AM I LOOKING FOR STRUCTURES IN???", site);

  // Preferred: already flattened on the site
  if (Array.isArray(site.structures)) {
    structures = site.structures;
    return structures;
  }
  if (site.structure) {
    structures = site.structure;

    return structures;
  }

  // DF style: site.structures.structure
  // if (site.structures?.structure) {
  //   structures = normalizeToArray(site.structures.structure);
  // }

  // // Legends / extra files
  // if (site.fromFile2?.structures?.structure) {
  //   structures = normalizeToArray(site.fromFile2.structures.structure);
  // }

  // if (site.fromFile1?.structures?.structure) {
  //   structures = normalizeToArray(site.fromFile1.structures.structure);
  // }

  return structures;
};

const getStructureInhabitants = (structure) => {
  if (!structure) return [];

  let inhabitants = [];

  // You might add structure.inhabitants later
  if (Array.isArray(structure.inhabitants)) inhabitants = structure.inhabitants;

  // In your sample, it's "inhabitant"
  if (Array.isArray(structure.inhabitant)) inhabitants = structure.inhabitant;
  if (structure.inhabitant) inhabitants = [structure.inhabitant];

  return inhabitants;
};

const getInhabitantBooks = (hf) => {
  if (!hf) return [];

  console.log("LOOKS for books", hf);
  const raw =
    hf.books ||
    hf.book ||
    hf.written_contents ||
    hf.written_content ||
    hf.book_list;

  if (raw) {
    console.log("LOOKS for books", raw);
  }

  return normalizeToArray(raw);
};

// helper: accept single object or array and always return array
const normalizeToArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

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
      height: boundingBoxHeight,
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
        height: boundingBoxHeight,
      };
    } else {
      // Horizontal split: top half (creates a square-like top portion)
      return {
        x: offsetX,
        y: offsetY,
        width: boundingBoxWidth,
        height: boundingBoxHeight / 2,
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

  // State for minimap
  const [mainTransform, setMainTransform] = useState(null);
  const [mainViewBox, setMainViewBox] = useState(null);

  const sanitizeKey = (val) => String(val || "Unknown").replace(/\s+/g, "");

  // Sanitize for CSS selector - remove invalid characters (commas, dots, etc.)
  const sanitizeForSelector = (val) => {
    return String(val || "unknown")
      .replace(/[^a-zA-Z0-9_-]/g, "_") // Replace invalid chars with underscore
      .replace(/_+/g, "_") // Collapse multiple underscores
      .replace(/^_|_$/g, ""); // Remove leading/trailing underscores
  };

  // Check if a hierarchy level should be visible at current zoom
  const isLevelVisible = (levelName) => {
    const level = HIERARCHY_LEVELS.find((l) => l.name === levelName);
    if (!level) return false;
    return currentZoomRef.current >= level.minZoom;
  };

  // Simple: just return all visible cells individually - no block combining
  // All cells will be rendered with their fractal subdivision logic
  const optimizeVisibleCells = (visibleCells, zoom) => {
    if (!visibleCells || visibleCells.length === 0) return [];

    // Filter out ocean cells
    const validCells = visibleCells.filter(
      (c) => c && c.region?.type !== "Ocean"
    );
    if (validCells.length === 0) return [];

    // Always return individual cells - no block combining
    // Fractal subdivision logic will handle the zoom detail
    return validCells.map((cell) => ({ type: "individual", cell }));
  };

  // Get representative cell for a block (for texture/color)
  const getBlockRepresentativeCell = (block) => {
    if (!block || !block.cells || block.cells.length === 0) return null;

    // Use the cell closest to the center of the block
    const centerX = Math.floor((block.minX + block.maxX) / 2);
    const centerY = Math.floor((block.minY + block.maxY) / 2);

    let closestCell = block.cells[0];
    let minDistance = Infinity;

    block.cells.forEach((cell) => {
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

  // Get combined texture for a block - procedurally combines multiple cell textures
  // Uses the most common region type in the block for the texture
  const getBlockTexture = (block, xScale, yScale) => {
    if (!block || !block.cells || block.cells.length === 0) return null;

    // Find the most common region type in the block
    const regionCounts = new Map();
    block.cells.forEach((cell) => {
      const regionType = cell.region?.type || "Unknown";
      regionCounts.set(regionType, (regionCounts.get(regionType) || 0) + 1);
    });

    // Get most common region type
    let mostCommonType = null;
    let maxCount = 0;
    regionCounts.forEach((count, type) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonType = type;
      }
    });

    // Use the cell closest to block center with the most common region type
    let representativeCell =
      block.cells.find((c) => c.region?.type === mostCommonType) ||
      block.cells[0];

    // Find cell closest to center with most common type
    const centerX = block.centerX || (block.minX + block.maxX) / 2;
    const centerY = block.centerY || (block.minY + block.maxY) / 2;

    let minDistance = Infinity;
    block.cells.forEach((cell) => {
      if (cell.region?.type === mostCommonType) {
        const dx = cell.x - centerX;
        const dy = cell.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance) {
          minDistance = distance;
          representativeCell = cell;
        }
      }
    });

    if (!representativeCell) return null;

    // Use unique key based on block bounds for consistent texture
    const blockKey = `block-${block.minX}-${block.minY}-${block.maxX}-${block.maxY}`;
    const cellKey = representativeCell.key || blockKey;
    return getRegionTex(representativeCell.region?.type, cellKey);
  };

  // Render a single block - procedurally combined cells, respects original positions
  // const renderSingleBlock = (block, xScale, yScale, g) => {
  //   if (!block || !block.cells || block.cells.length === 0) return;

  //   // Calculate block bounds in screen space using actual cell positions
  //   // This ensures the block covers exactly the area of its cells (no overlaps)
  //   const blockMinX = Math.min(...block.cells.map((c) => xScale(c.y)));
  //   const blockMaxX = Math.max(...block.cells.map((c) => xScale(c.y + 1)));
  //   const blockMinY = Math.min(...block.cells.map((c) => yScale(c.x)));
  //   const blockMaxY = Math.max(...block.cells.map((c) => yScale(c.x + 1)));

  //   const blockBbox = {
  //     x: blockMinX,
  //     y: blockMinY,
  //     width: blockMaxX - blockMinX,
  //     height: blockMaxY - blockMinY,
  //   };

  //   // Get representative cell for texture and interaction
  //   const representativeCell = getBlockRepresentativeCell(block);
  //   if (!representativeCell) return;

  //   // Use unique block key based on actual cell bounds
  //   const blockKey = `block-${block.minX}-${block.minY}-${block.maxX}-${block.maxY}`;
  //   const texUrl = getBlockTexture(block, xScale, yScale);
  //   const patternKey = `block-${sanitizeForSelector(blockKey)}`;

  //   // Create rect for block - covers exactly the cells in the block
  //   // This maintains the original map structure
  //   const rect = g
  //     .append("rect")
  //     .attr("class", `cell block`)
  //     .attr("x", blockMinX)
  //     .attr("y", blockMinY)
  //     .attr("width", blockBbox.width)
  //     .attr("height", blockBbox.height)
  //     .style("cursor", "pointer")
  //     .style("pointer-events", "auto");

  //   // Apply texture - procedurally combined from block cells
  //   if (texUrl) {
  //     const defs = d3.select(svgRef.current).select("defs");
  //     const pid = getOrCreatePattern(defs, patternKey, texUrl);
  //     if (pid) {
  //       rect.style("fill", `url(#${pid})`).style("opacity", 1);
  //     }
  //   } else {
  //     // Fallback: use representative cell's texture
  //     const fallbackTex = getRegionTex(
  //       representativeCell.region?.type,
  //       blockKey
  //     );
  //     const defs = d3.select(svgRef.current).select("defs");
  //     const pid = getOrCreatePattern(
  //       defs,
  //       `fallback-${patternKey}`,
  //       fallbackTex
  //     );
  //     if (pid) {
  //       rect.style("fill", `url(#${pid})`).style("opacity", 1);
  //     }
  //   }

  //   // Add click handler for blocks
  //   const blockCell = {
  //     key: blockKey,
  //     x: block.minX,
  //     y: block.minY,
  //     isBlock: true,
  //     block: block,
  //     region: representativeCell.region,
  //   };

  //   rect.on("click", (event) => {
  //     event.stopPropagation();
  //     const composed = {
  //       kind: "cell",
  //       name: `Block (${block.cells.length} cells: ${block.minX},${block.minY} to ${block.maxX},${block.maxY})`,
  //       type: representativeCell.region?.type || null,
  //       cellCoords: { x: block.minX, y: block.minY },
  //       cell: blockCell,
  //       region: representativeCell.region,
  //       block: block,
  //     };

  //     if (onEntityClick) {
  //       onEntityClick(composed);
  //     }
  //     if (onCellClick) {
  //       onCellClick(blockCell);
  //     }
  //   });
  // };

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

    return !(
      cellRight < -padding ||
      cellLeft > viewportRight ||
      cellBottom < -padding ||
      cellTop > viewportBottom
    );
  };

  // Check if a cell should subdivide based on visibility and zoom
  // Only subdivide cells that are visible in viewport (dynamic and logical)
  const shouldCellSubdivide = (
    cell,
    zoom,
    xScale,
    yScale,
    transform,
    svgNode
  ) => {
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
    // Start subdividing from zoom 1+ for smooth progression
    // Radius grows gradually as you zoom in
    const baseRadius = CELL_SIZE * 1.5; // Base radius (smaller for more gradual start)
    const zoomFactor = 1.15; // How much radius increases per zoom level
    const minZoomForSubdivision = 1; // Start subdividing from zoom 1
    const effectiveZoom = Math.max(0, zoom - minZoomForSubdivision);
    // Smooth growth: start small, grow gradually
    const maxRadius = baseRadius * Math.pow(zoomFactor, effectiveZoom / 2);

    // Cells closer to center and within radius should subdivide
    // Add a small minimum radius so cells at center always subdivide when zoom > 1
    const minRadius = zoom > 1 ? CELL_SIZE * 0.5 : 0;
    return distance <= Math.max(maxRadius, minRadius);
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
      return (
        (cell.sites && cell.sites.length > 0 && sitesVisible) ||
        (cell.undergroundRegions &&
          cell.undergroundRegions.length > 0 &&
          undergroundRegionsVisible) ||
        (cell.historical_figures &&
          cell.historical_figures.length > 0 &&
          cellFiguresVisible) ||
        (cell.written_contents &&
          cell.written_contents.length > 0 &&
          writtenContentsVisible)
      );
    };

    // Update sites visibility - show if level is visible and cell subdivides
    gSelection.selectAll("rect.site-marker").each(function (d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      rect.style("opacity", sitesVisible && shouldSubdivide ? 1 : 0);
    });
    gSelection.selectAll("text.site-label").each(function (d) {
      const text = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      text.style("opacity", sitesVisible && shouldSubdivide ? 1 : 0);
    });

    // Update structures visibility - show if level is visible
    gSelection.selectAll("rect.structure-marker").each(function (d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      rect.style("opacity", structuresVisible && shouldSubdivide ? 1 : 0);
    });
    gSelection.selectAll("text.structure-label").each(function (d) {
      const text = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      text.style("opacity", structuresVisible && shouldSubdivide ? 1 : 0);
    });

    // Update figures visibility
    gSelection.selectAll("rect.figure-marker").each(function (d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      rect.style("opacity", figuresVisible && shouldSubdivide ? 1 : 0);
    });
    gSelection.selectAll("text.figure-label").each(function (d) {
      const text = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      text.style("opacity", figuresVisible && shouldSubdivide ? 1 : 0);
    });

    // Update underground regions visibility
    gSelection.selectAll("rect.underground-region-marker").each(function (d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      rect.style(
        "opacity",
        undergroundRegionsVisible && shouldSubdivide ? 1 : 0
      );
    });

    // Update cell figures visibility
    gSelection.selectAll("rect.cell-figure-marker").each(function (d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      rect.style("opacity", cellFiguresVisible && shouldSubdivide ? 1 : 0);
    });

    // Update written contents visibility
    gSelection.selectAll("rect.written-content-marker").each(function (d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      rect.style("opacity", writtenContentsVisible && shouldSubdivide ? 1 : 0);
    });

    // Update cell appearance - cell is ALWAYS visible, but becomes more transparent when subdivided
    gSelection.selectAll("rect.cell").each(function (d) {
      const rect = d3.select(this);
      const hasVisibleChildren = hasAnyVisibleChildren(d);

      // Cell is always visible, but opacity reduces as children appear
      if (hasVisibleChildren) {
        // Cell with visible children - reduce opacity so children show through
        // More children = more transparent
        const childCount = [
          d.sites && sitesVisible ? d.sites.length : 0,
          d.undergroundRegions && undergroundRegionsVisible
            ? d.undergroundRegions.length
            : 0,
          d.historical_figures && cellFiguresVisible
            ? d.historical_figures.length
            : 0,
          d.written_contents && writtenContentsVisible
            ? d.written_contents.length
            : 0,
        ].reduce((a, b) => a + b, 0);

        const opacity = Math.max(0.2, 1 - childCount * 0.1); // More children = more transparent
        rect.style("opacity", opacity);
        rect
          .style("stroke", "rgba(255,255,255,0.5)")
          .style("stroke-width", 0.5);
      } else {
        // No visible children - show full cell
        rect.style("opacity", 1);
        rect.style("stroke", null).style("stroke-width", 0);
      }
    });

    // Update site appearance - sites become transparent when structures appear
    gSelection.selectAll("rect.site-marker").each(function (d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      if (!shouldSubdivide) return;

      const structures = normalizeToArray(
        d.site?.structures?.structure || d.site?.data?.structures?.structure
      );
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
    gSelection.selectAll("rect.structure-marker").each(function (d) {
      const rect = d3.select(this);
      const shouldSubdivide = belongsToSubdividingCell(d.cell, zoom);
      if (!shouldSubdivide) return;

      const hasInhabitants =
        d.structure?.inhabitants && d.structure.inhabitants.length > 0;
      const shouldShowFigures = hasInhabitants && figuresVisible;

      if (shouldShowFigures) {
        // Figures are visible - make structure semi-transparent so figures show through
        rect.style("opacity", 0.4);
        rect
          .style("stroke", "rgba(255,192,203,0.6)")
          .style("stroke-width", 0.4);
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
      console.warn(
        "getOrCreatePattern: textureUrl is missing for patternKey:",
        patternKey
      );
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
      console.error(
        "getOrCreatePattern: Error creating pattern:",
        error,
        "patternKey:",
        patternKey
      );
      return null;
    }
  };

  // Recursive function to render a cell and its children
  const renderRecursiveCell = (
    cell,
    parentBbox,
    gSelection,
    xScale,
    yScale,
    level = 0
  ) => {
    // Calculate this cell's position
    const cellX =
      level === 0 ? xScale(cell.y) : parentBbox.x + (cell.bbox?.x || 0);
    const cellY =
      level === 0 ? yScale(cell.x) : parentBbox.y + (cell.bbox?.y || 0);
    const cellWidth = level === 0 ? CELL_SIZE : cell.bbox?.width || CELL_SIZE;
    const cellHeight = level === 0 ? CELL_SIZE : cell.bbox?.height || CELL_SIZE;

    const cellBbox = {
      x: cellX,
      y: cellY,
      width: cellWidth,
      height: cellHeight,
    };

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
    const cellRect = gSelection
      .selectAll(`rect.cell-${uniqueKey}`)
      .data(
        [{ ...cell, cellKey: uniqueKey, cellBbox }],
        (d) => d.cellKey || uniqueKey
      );

    const cellEnter = cellRect
      .enter()
      .append("rect")

      .attr("class", `cell cell-level-${level} cell-${uniqueKey}  `)
      .attr("x", cellX)
      .attr("y", cellY)
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .style("cursor", "pointer")
      .style("pointer-events", "auto") // Ensure cells are clickable
      .style("z-index", 10); // Ensure cells are above other elements

    cellEnter
      .merge(cellRect)
      .attr("x", cellX)
      .attr("y", cellY)
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .attr("class", (d) => {
        // Decide semantic type for styling
        let type;

        if (level === 0) {
          // top-level cell
          type = "region"; // or "ocean" if you want separate styling
          if (d.region?.type === "Ocean") type = "ocean";
        } else {
          // children created in buildCellChildren
          type = d.childType || d.nodeType || "generic";
        }

        const typeClass = `cell-type-${sanitizeForSelector(type)}`;

        // keep your old classes + new type class
        return `cell cell-level-${level} cell-${uniqueKey} ${typeClass}`;
      })
      .style("cursor", "pointer")
      .style("pointer-events", "auto") // Ensure cells are clickable
      .each(function (d) {
        const rect = d3.select(this);
        const svg = d3.select(svgRef.current);
        const defs = svg.select("defs");

        // Skip ocean cells - don't render them
        if (level === 0 && d.region?.type === "Ocean") {
          rect.style("display", "none");
          return;
        }

        // Get cell key for procedural texture generation - ensure we always have a valid key
        const cellKeyForTexture =
          d.key ||
          d.originalCell?.key ||
          d.cellKey ||
          `cell-${level}-${cellX}-${cellY}`;

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
        } else if (d.kind === "site") {
          const siteType =
            d.childData?.fromFile2?.type ||
            d.childData?.fromFile1?.type ||
            d.childData?.type ||
            "default";
          texUrl = getSiteTex(siteType, cellKeyForTexture);
          patternKey = `site-${sanitizeForSelector(
            cellKeyForTexture
          )}-${sanitizeForSelector(siteType)}`;
        } else if (d.kind === "structure") {
          // Structures get procedural textures - use neutral palette
          const structId =
            d.childData?.id || d.childData?.local_id || "default";
          texUrl = getRegionTex(
            null,
            `${cellKeyForTexture}-struct-${structId}`
          ); // null type = default palette
          patternKey = `structure-${sanitizeForSelector(
            cellKeyForTexture
          )}-${sanitizeForSelector(String(structId))}`;
        } else if (d.kind === "figure" || d.kind === "cellFigure") {
          texUrl = getFigureTex(d.childData, cellKeyForTexture);
          patternKey = `fig-${sanitizeForSelector(
            cellKeyForTexture
          )}-${sanitizeForSelector(String(d.childData?.id || "default"))}`;
        } else if (d.childType === "undergroundRegion") {
          // Underground regions get procedural textures - use cavern palette
          const ugId = d.childData?.id || "default";
          texUrl = getRegionTex("cavern", `${cellKeyForTexture}-ug-${ugId}`); // Use cavern palette
          patternKey = `underground-${sanitizeForSelector(
            cellKeyForTexture
          )}-${sanitizeForSelector(String(ugId))}`;
        } else if (d.kind === "writtenContent") {
          // Written contents get procedural textures - use neutral palette
          const wcId = d.childData?.id || d.childData?.title || "default";
          texUrl = getRegionTex(null, `${cellKeyForTexture}-wc-${wcId}`); // null type = default palette
          patternKey = `written-${sanitizeForSelector(
            cellKeyForTexture
          )}-${sanitizeForSelector(String(wcId))}`;
        } else {
          // Fallback: generate a default texture for any unknown type
          texUrl = getRegionTex(null, cellKeyForTexture);
          patternKey = `default-${sanitizeForSelector(cellKeyForTexture)}`;
        }

        // Apply procedural texture - ensure we always have a texture
        // This is critical: every cell MUST have a texture
        // let appliedTexture = false;
        // if (texUrl && patternKey) {
        //   const pid = getOrCreatePattern(defs, patternKey, texUrl);
        //   if (pid) {
        //     rect.style("fill", `url(#${pid})`).style("opacity", 1);
        //     appliedTexture = true;
        //   }
        // }

        // // Fallback: if texture wasn't applied, generate a default one
        // if (!appliedTexture) {
        //   // Generate a fallback texture using the cell key
        //   const fallbackTexUrl = getRegionTex(null, cellKeyForTexture);
        //   const fallbackPatternKey = `fallback-${sanitizeForSelector(
        //     cellKeyForTexture
        //   )}`;
        //   const fallbackPid = getOrCreatePattern(
        //     defs,
        //     fallbackPatternKey,
        //     fallbackTexUrl
        //   );
        //   if (fallbackPid) {

        //     rect.style("fill", `url(#${fallbackPid})`).style("opacity", 1);

        //   } else {
        //     // Last resort: solid color (should never happen)
        //     rect.style("fill", "#f0f0f0").style("opacity", 1);
        //     console.warn(
        //       "Failed to create texture for cell:",
        //       cellKeyForTexture
        //     );
        //   }
        // }

        // Always set opacity to 1 (opaque) - no transparency
        rect.style("opacity", 1);

        // Optional: add subtle stroke for cells with children
        const hasVisibleChildren = d.children && d.children.length > 0;
        if (hasVisibleChildren) {
          rect.style("stroke", "blue").style("stroke-width", 0.1);
        } else {
          rect.style("stroke", "black").style("stroke-width", 0);
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
          const siteType =
            site?.fromFile2?.type ||
            site?.fromFile1?.type ||
            site?.type ||
            "default";
          const siteName =
            site?.fromFile2?.name ||
            site?.fromFile1?.name ||
            site?.name ||
            "Unknown site";

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
          console.log("has figure on click", d);
          const hf = d.childData[0] || d.childData;
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
          onEntityClick(composed);
        } else {
          console.warn("onEntityClick is not defined!");
        }
      } else {
        console.warn("No composed entity created for click");
      }

      // Also call onCellClick for cell selection
      // if (onCellClick) {
      //   onCellClick(d);
      // }

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
      cell.children.forEach((child) => {
        renderRecursiveCell(
          child,
          cellBbox,
          gSelection,
          xScale,
          yScale,
          level + 1
        );
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
    // Smooth progression: 1 -> 2 -> 3 -> 4 -> ... as zoom increases
    // Level 0 (cells): very smooth - +1 child every 1.5 zoom levels
    // Level 1 (sites/regions): +1 every 2 zoom levels
    // Level 2+ (deeper): +1 every 2.5 zoom levels
    const zoomFactor = level === 0 ? 1.5 : level === 1 ? 2 : 2.5;
    const baseCount = 1; // Always start with 1
    // At zoom 1: show 1 child
    // At zoom 2-3: show 2 children
    // At zoom 4-5: show 3 children
    // etc.
    const additionalCount = Math.floor((zoom - 1) / zoomFactor);
    const visibleCount = Math.min(
      totalChildren,
      baseCount + Math.max(0, additionalCount)
    );

    // Ensure we show at least 1 (unless total is 0), but not more than total
    return Math.max(1, Math.min(visibleCount, totalChildren));
  };

  // Build recursive cell structure for a cell (works for both original cells and child cells)
  // Subdivision stops when there are no more children (leaf nodes)
  // Ocean cells are not rendered and don't subdivide
  const buildCellChildren = (
    cell,
    zoom,
    parentBbox,
    isChildCell = false,
    xScale = null,
    yScale = null,
    transform = null,
    svgNode = null
  ) => {
    // Skip ocean cells - don't render or subdivide them
    if (!isChildCell && cell.region?.type === "Ocean") {
      return []; // Ocean cells are empty - no texture, no subdivision
    }

    // For original cells, check if they should subdivide based on visibility and zoom
    if (!isChildCell && xScale && yScale && transform && svgNode) {
      if (
        !shouldCellSubdivide(cell, zoom, xScale, yScale, transform, svgNode)
      ) {
        return []; // Don't subdivide this cell if not visible or too far
      }
    } else if (!isChildCell) {
      // Fallback if we don't have transform info
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

    // ---------- CELL-LEVEL ONLY EXTRAS (region, underground, cell figs, cell written) ----------
    if (!isChildCell) {
      // Only add region if it's not ocean (ocean cells are skipped entirely)
      if (cell.region && cell.region.type !== "Ocean") {
        allChildData.push({
          kind: "region",
          data: cell.region,
          isOriginalCell: true,
        });
      }

      // Underground regions
      if (
        cell.undergroundRegions &&
        cell.undergroundRegions.length > 0 &&
        isLevelVisible("undergroundRegion")
      ) {
        const ugLevel = HIERARCHY_LEVELS.find(
          (l) => l.name === "undergroundRegion"
        );
        const ugZoomFactor = 3;
        const ugBaseCount = 1;
        const ugAdditionalCount = Math.floor(
          (zoom - (ugLevel?.minZoom || 3)) / ugZoomFactor
        );
        const visibleUgCount = Math.min(
          cell.undergroundRegions.length,
          ugBaseCount + Math.max(0, ugAdditionalCount)
        );
        cell.undergroundRegions
          .slice(0, visibleUgCount)
          .forEach((ug) =>
            allChildData.push({ kind: "undergroundRegion", data: ug })
          );
      }

      // Cell-level historical figures
      if (
        cell.historical_figures &&
        cell.historical_figures.length > 0 &&
        isLevelVisible("cellFigure")
      ) {
        const cfLevel = HIERARCHY_LEVELS.find((l) => l.name === "cellFigure");
        const cfZoomFactor = 3;
        const cfBaseCount = 1;
        const cfAdditionalCount = Math.floor(
          (zoom - (cfLevel?.minZoom || 8)) / cfZoomFactor
        );
        const visibleCfCount = Math.min(
          cell.historical_figures.length,
          cfBaseCount + Math.max(0, cfAdditionalCount)
        );
        cell.historical_figures
          .slice(0, visibleCfCount)
          .forEach((hf) => allChildData.push({ kind: "cellFigure", data: hf }));
      }

      // Cell-level written contents
      if (
        cell.written_contents &&
        cell.written_contents.length > 0 &&
        isLevelVisible("writtenContent")
      ) {
        const wcLevel = HIERARCHY_LEVELS.find(
          (l) => l.name === "writtenContent"
        );
        const wcZoomFactor = 3;
        const wcBaseCount = 1;
        const wcAdditionalCount = Math.floor(
          (zoom - (wcLevel?.minZoom || 10)) / wcZoomFactor
        );
        const visibleWcCount = Math.min(
          cell.written_contents.length,
          wcBaseCount + Math.max(0, wcAdditionalCount)
        );
        cell.written_contents
          .slice(0, visibleWcCount)
          .forEach((wc) =>
            allChildData.push({ kind: "writtenContent", data: wc })
          );
      }
    }

    // ---------- HIERARCHY: CELL → SITES ----------
    if (cell.sites && cell.sites.length > 0 && isLevelVisible("site")) {
      const sites = cell.sites;
      const siteLevel = HIERARCHY_LEVELS.find((l) => l.name === "site");
      const siteZoomFactor = 3; // +1 site every 3 zoom levels
      const siteBaseCount = 1;
      const siteAdditionalCount = Math.floor(
        (zoom - (siteLevel?.minZoom || 5)) / siteZoomFactor
      );
      const visibleSiteCount = Math.min(
        sites.length,
        siteBaseCount + Math.max(0, siteAdditionalCount)
      );

      sites.slice(0, visibleSiteCount).forEach((site) => {
        allChildData.push({ kind: "site", data: site });
      });

      sites.forEach((s) => {
        const siteStructures = getSiteStructures(s);

        if (siteStructures.length > 0 && isLevelVisible("structure")) {
          const structLevel = HIERARCHY_LEVELS.find(
            (l) => l.name === "structure"
          );
          const structZoomFactor = 4; // +1 structure every 4 zoom levels
          const structBaseCount = 1;
          const structAdditionalCount = Math.floor(
            (zoom - (structLevel?.minZoom || 15)) / structZoomFactor
          );
          const visibleStructCount = Math.min(
            siteStructures.length,
            structBaseCount + Math.max(0, structAdditionalCount)
          );

          siteStructures.slice(0, visibleStructCount).forEach((struct) => {
            allChildData.push({ kind: "structure", data: struct });
          });

          siteStructures.forEach((ss) => {
            const inhabitants = getStructureInhabitants(ss);

            if (inhabitants.length > 0 && isLevelVisible("figure")) {
              const figLevel = HIERARCHY_LEVELS.find(
                (l) => l.name === "figure"
              );
              const figZoomFactor = 4; // +1 figure every 4 zoom levels
              const figBaseCount = 1;
              const figAdditionalCount = Math.floor(
                (zoom - (figLevel?.minZoom || 40)) / figZoomFactor
              );
              const visibleFigCount = Math.min(
                inhabitants.length,
                figBaseCount + Math.max(0, figAdditionalCount)
              );

              inhabitants.slice(0, visibleFigCount).forEach((hf) => {
                allChildData.push({ kind: "figure", data: hf });
              });

              inhabitants.forEach((inh) => {
                const hfBooks = getInhabitantBooks(inh);
                if (hfBooks.length > 0 && isLevelVisible("writtenContent")) {
                  const wcLevel = HIERARCHY_LEVELS.find(
                    (l) => l.name === "writtenContent"
                  );
                  const wcZoomFactor = 3;
                  const wcBaseCount = 1;
                  const wcAdditionalCount = Math.floor(
                    (zoom - (wcLevel?.minZoom || 35)) / wcZoomFactor
                  );
                  const visibleWcCount = Math.min(
                    hfBooks.length,
                    wcBaseCount + Math.max(0, wcAdditionalCount)
                  );

                  hfBooks.slice(0, visibleWcCount).forEach((wc) => {
                    allChildData.push({ kind: "writtenContent", data: wc });
                  });
                }
              });
            }
          });
        }
      });
    }

    // ---------- HIERARCHY: SITE → STRUCTURES ----------
    // const siteStructures = getSiteStructures(payload);
    // if (siteStructures.length > 0 && isLevelVisible("structure")) {
    //   const structLevel = HIERARCHY_LEVELS.find((l) => l.name === "structure");
    //   const structZoomFactor = 4; // +1 structure every 4 zoom levels
    //   const structBaseCount = 1;
    //   const structAdditionalCount = Math.floor(
    //     (zoom - (structLevel?.minZoom || 15)) / structZoomFactor
    //   );
    //   const visibleStructCount = Math.min(
    //     siteStructures.length,
    //     structBaseCount + Math.max(0, structAdditionalCount)
    //   );

    //   siteStructures.slice(0, visibleStructCount).forEach((struct) => {
    //     allChildData.push({ kind: "structure", data: struct });
    //   });
    // }

    // ---------- HIERARCHY: STRUCTURE → INHABITANTS (FIGURES) ----------
    // const inhabitants = getStructureInhabitants(payload);
    // if (inhabitants.length > 0 && isLevelVisible("figure")) {
    //   const figLevel = HIERARCHY_LEVELS.find((l) => l.name === "figure");
    //   const figZoomFactor = 4; // +1 figure every 4 zoom levels
    //   const figBaseCount = 1;
    //   const figAdditionalCount = Math.floor(
    //     (zoom - (figLevel?.minZoom || 40)) / figZoomFactor
    //   );
    //   const visibleFigCount = Math.min(
    //     inhabitants.length,
    //     figBaseCount + Math.max(0, figAdditionalCount)
    //   );

    //   inhabitants.slice(0, visibleFigCount).forEach((hf) => {
    //     allChildData.push({ kind: "figure", data: hf });
    //   });
    // }

    // ---------- HIERARCHY: FIGURE → BOOKS / WRITTEN CONTENT ----------
    // const hfBooks = getInhabitantBooks(payload);
    // if (hfBooks.length > 0 && isLevelVisible("writtenContent")) {
    //   const wcLevel = HIERARCHY_LEVELS.find((l) => l.name === "writtenContent");
    //   const wcZoomFactor = 3;
    //   const wcBaseCount = 1;
    //   const wcAdditionalCount = Math.floor(
    //     (zoom - (wcLevel?.minZoom || 35)) / wcZoomFactor
    //   );
    //   const visibleWcCount = Math.min(
    //     hfBooks.length,
    //     wcBaseCount + Math.max(0, wcAdditionalCount)
    //   );

    //   hfBooks.slice(0, visibleWcCount).forEach((wc) => {
    //     allChildData.push({ kind: "writtenContent", data: wc });
    //   });
    // }

    // ---------- END: if no children, this node is a leaf ----------
    if (allChildData.length === 0) return [];

    // Progressive subdivision: show more children as zoom increases
    const totalChildren = allChildData.length;
    const currentLevel = isChildCell ? cell.level || 1 : 0;
    const visibleCount = getVisibleChildCount(
      totalChildren,
      zoom,
      currentLevel
    );

    const visibleChildData = allChildData.slice(0, visibleCount);

    // Create child cells for visible children - each is an object with its own texture
    visibleChildData.forEach((childData, idx) => {
      const gridPos = calculateGridPositions(
        idx,
        visibleCount,
        parentBbox.width,
        parentBbox.height
      );

      const childCell = {
        key: `${cell.key}-child-${childData.kind}-${idx}`,
        level: isChildCell ? cell.level + 1 : 1,
        parent: cell,
        originalCell: cell.originalCell || cell,
        childType: childData.kind, // for textures / clicks
        nodeType: childData.kind, // extra clarity if needed later
        childData: childData.data, // the real payload (site / structure / hf / book / etc.)
        isOriginalCell: childData.isOriginalCell || false,
        bbox: {
          x: gridPos.x,
          y: gridPos.y,
          width: gridPos.width,
          height: gridPos.height,
        },
        children: [],
      };

      // Recursively build children for this child cell (if any)
      const childBbox = {
        x: 0,
        y: 0,
        width: gridPos.width,
        height: gridPos.height,
      };

      const grandChildren = buildCellChildren(childCell, zoom, childBbox, true);
      childCell.children = grandChildren; // [] if leaf

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
    svg
      .append("g")
      .on("mouseover", function () {
        d3.select(this).classed("hover", true);
      })
      .on("mouseout", function () {
        d3.select(this).classed("hover", false);
      });

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

    // Calculate initial zoom that shows manageable number of cells
    // Goal: MAX_VISIBLE_CELLS_AT_MIN_ZOOM cells visible at minimum zoom
    const viewBox = svg.node().viewBox.baseVal;
    const viewportWidth = viewBox.width;
    const viewportHeight = viewBox.height;

    // Calculate how many cells fit in viewport at different zoom levels
    // Cell size in viewport = CELL_SIZE * zoom
    // Visible cells = (viewportWidth / (CELL_SIZE * zoom)) * (viewportHeight / (CELL_SIZE * zoom))

    // Calculate zoom needed to show approximately MAX_VISIBLE_CELLS_AT_MIN_ZOOM cells
    const cellsPerViewportAxis = Math.sqrt(MAX_VISIBLE_CELLS_AT_MIN_ZOOM);
    const requiredZoomX = viewportWidth / (cellsPerViewportAxis * CELL_SIZE);
    const requiredZoomY = viewportHeight / (cellsPerViewportAxis * CELL_SIZE);
    const calculatedMinZoom = Math.max(requiredZoomX, requiredZoomY, 0.5); // At least 0.5 zoom

    // Update MIN_ZOOM to prevent zooming out further
    MIN_ZOOM = calculatedMinZoom;

    // Set initial zoom to MIN_ZOOM (maximum zoom out - shows manageable area)
    currentZoomRef.current = MIN_ZOOM;
    focusedCellRef.current = null;

    // Set initial transform to center of map at calculated zoom
    const centerX = width / 2;
    const centerY = height / 2;
    const initialTransform = d3.zoomIdentity
      .translate(
        viewportWidth / 2 - centerX * MIN_ZOOM,
        viewportHeight / 2 - centerY * MIN_ZOOM
      )
      .scale(MIN_ZOOM);

    g.attr("transform", initialTransform);

    // Clear all existing cells
    g.selectAll("rect.cell").remove();

    // Get ONLY visible cells in viewport
    const visibleCells = cells.filter((cell) => {
      if (!cell || cell.region?.type === "Ocean") return false;
      return isCellVisible(cell, xScale, yScale, initialTransform, svg.node());
    });

    // Get individual cells - no block combining, just render all cells with fractal logic
    const cellsToRender = optimizeVisibleCells(
      visibleCells,
      currentZoomRef.current
    );

    // Render all cells individually with fractal subdivision
    cellsToRender.forEach((item) => {
      // All items are individual cells now
      const cell = item.cell;
      const cellBbox = {
        x: xScale(cell.y), // cell.y -> x position
        y: yScale(cell.x), // cell.x -> y position
        width: CELL_SIZE,
        height: CELL_SIZE,
      };

      // Build children for fractal subdivision
      const cellWithChildren = {
        ...cell,
        children: buildCellChildren(
          cell,
          currentZoomRef.current,
          cellBbox,
          false,
          xScale,
          yScale,
          initialTransform,
          svg.node()
        ),
      };

      renderRecursiveCell(cellWithChildren, cellBbox, g, xScale, yScale, 0);
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

        // Clamp zoom to prevent zooming out beyond MIN_ZOOM
        if (k < MIN_ZOOM) {
          const clampedTransform = d3.zoomIdentity
            .translate(event.transform.x, event.transform.y)
            .scale(MIN_ZOOM);
          svg.call(zoom.transform, clampedTransform);
          return;
        }

        g.attr("transform", `translate(${x},${y}) scale(${k})`);
        // Patterns are fixed size, no need to update them on zoom

        // Update zoom level
        const oldZoom = currentZoomRef.current;
        currentZoomRef.current = k;

        // Calculate which cell is at the viewport center (focused cell)
        const svgNode = svgRef.current;
        const xScale = xScaleRef.current;
        const yScale = yScaleRef.current;

        // Update transform state for minimap
        if (svgNode && worldData && worldData.cells && xScale && yScale) {
          const viewBox = svgNode.viewBox.baseVal;
          setMainTransform(event.transform);
          setMainViewBox({ width: viewBox.width, height: viewBox.height });
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

          const focusChanged =
            !oldFocused || !focusedCell || oldFocused.key !== focusedCell.key;
          const transform = event.transform;

          // Update constantly for smooth transitions - no throttling
          // Use requestAnimationFrame for smooth rendering
          requestAnimationFrame(() => {
            lastRenderedZoomRef.current = k;

            // Rebuild based on current zoom and viewport
            const svgNode = svgRef.current;
            const allCells = worldData.cells;

            // Clear existing cells
            g.selectAll("rect.cell").remove();

            // Get ONLY visible cells in viewport
            const visibleCells = allCells.filter((cell) => {
              if (!cell || cell.region?.type === "Ocean") return false;
              return isCellVisible(cell, xScale, yScale, transform, svgNode);
            });

            // Get individual cells - no block combining, just render all cells with fractal logic
            const cellsToRender = optimizeVisibleCells(visibleCells, k);

            // Render all cells individually with fractal subdivision
            cellsToRender.forEach((item) => {
              // All items are individual cells now
              const cell = item.cell;
              const cellBbox = {
                x: xScale(cell.y), // cell.y -> x position
                y: yScale(cell.x), // cell.x -> y position
                width: CELL_SIZE,
                height: CELL_SIZE,
              };

              // Build children for fractal subdivision
              const cellWithChildren = {
                ...cell,
                children: buildCellChildren(
                  cell,
                  k,
                  cellBbox,
                  false,
                  xScale,
                  yScale,
                  transform,
                  svgNode
                ),
              };

              renderRecursiveCell(
                cellWithChildren,
                cellBbox,
                g,
                xScale,
                yScale,
                0
              );
            });
          });
        }
      });

    // Enable pan with click and drag (left mouse button)
    svg.call(zoom);
    zoomBehaviorRef.current = zoom;
    svg.on("dblclick.zoom", null);

    // Calculate initial transform to show manageable number of cells
    const viewBox = svg.node().viewBox.baseVal;
    const mapWidth = mapWidthRef.current;
    const mapHeight = mapHeightRef.current;
    const viewportWidth = viewBox.width;
    const viewportHeight = viewBox.height;

    if (mapWidth > 0 && mapHeight > 0) {
      const centerX = mapWidth / 2;
      const centerY = mapHeight / 2;
      const initialTransform = d3.zoomIdentity
        .translate(
          viewportWidth / 2 - centerX * MIN_ZOOM,
          viewportHeight / 2 - centerY * MIN_ZOOM
        )
        .scale(MIN_ZOOM);

      // Set initial transform
      svg.call(zoom.transform, initialTransform);

      // Update transform state for minimap
      setMainTransform(initialTransform);
      setMainViewBox({ width: viewBox.width, height: viewBox.height });
    } else {
      // Fallback: use default transform
      const defaultTransform = d3.zoomIdentity.translate(0, 0).scale(MIN_ZOOM);
      svg.call(zoom.transform, defaultTransform);
      setMainTransform(defaultTransform);
      setMainViewBox({ width: viewBox.width, height: viewBox.height });
    }

    return () => {
      svg.on(".zoom", null);
    };
  }, [worldData]);

  // highlight selected entity - optimized for recursive cells only
  // highlight selected entity - optimized for recursive cells only
  useEffect(() => {
    const svgNode = svgRef.current;
    if (!svgNode) return;

    const svg = d3.select(svgNode);
    if (svg.empty()) return;

    const cellRects = svg.selectAll("rect.cell");

    // Nothing selected: clear highlight & bail
    if (!selectedEntity) {
      cellRects.style("stroke", null).style("stroke-width", 0);
      return;
    }

    // --- zoom helper: compute zoom from rect size ---
    const zoomOnRect = (rectSelection) => {
      if (!rectSelection || rectSelection.empty()) return;
      const zoomBehavior = zoomBehaviorRef.current;
      if (!zoomBehavior) return;

      const viewBox = svgNode.viewBox.baseVal;
      const vw = viewBox.width || 1;
      const vh = viewBox.height || 1;

      const x = parseFloat(rectSelection.attr("x")) || 0;
      const y = parseFloat(rectSelection.attr("y")) || 0;
      const w = parseFloat(rectSelection.attr("width")) || CELL_SIZE;
      const h = parseFloat(rectSelection.attr("height")) || CELL_SIZE;

      const cx = x + w / 2;
      const cy = y + h / 2;

      // How much of the viewport should the rect occupy?
      // paddingFactor = 2 → ~50% of viewport
      // paddingFactor = 3 → ~33% of viewport
      const paddingFactor = 3;

      const kx = vw / (w * paddingFactor);
      const ky = vh / (h * paddingFactor);
      let targetK = Math.min(kx, ky);

      // Clamp to your zoom limits
      targetK = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetK));

      zoomToPoint(cx, cy, targetK, 750);
    };

    // Helper: describe what we’re selecting
    const getSelectedDescriptor = (entity) => {
      const kind = entity.kind;

      const cellCoords =
        entity.cellCoords ||
        (entity.cell && { x: entity.cell.x, y: entity.cell.y }) ||
        null;

      let id = null;

      if (kind === "site" && entity.site) {
        id = entity.site.id;
      } else if (kind === "structure" && entity.structure) {
        id = entity.structure.id ?? entity.structure.local_id;
      } else if (kind === "figure" && entity.figure) {
        id = entity.figure.id;
      } else if (kind === "writtenContent" && entity.writtenContent) {
        id = entity.writtenContent.id ?? entity.writtenContent.title;
      } else if (kind === "undergroundRegion" && entity.undergroundRegion) {
        id = entity.undergroundRegion.id;
      } else if (entity.childData && entity.childData.id) {
        id = entity.childData.id;
      }

      return {
        kind,
        id: id != null ? String(id) : null,
        cellCoords,
      };
    };

    const {
      kind: selectedKind,
      id: selectedId,
      cellCoords,
    } = getSelectedDescriptor(selectedEntity);

    let didZoom = false;

    cellRects.each(function (d) {
      const rect = d3.select(this);

      const baseCell = d.originalCell || d;

      let isSelected = false;

      // 1) Cell selection – match by base cell coords
      if (selectedEntity.kind === "cell" && cellCoords) {
        if (baseCell.x === cellCoords.x && baseCell.y === cellCoords.y) {
          isSelected = true;
        }
      } else if (selectedId && selectedKind) {
        // 2) Child selection – match by kind + id + base cell
        const child = d.childData || d;

        const childIdRaw = child?.id ?? child?.local_id ?? null;
        const childId = childIdRaw != null ? String(childIdRaw) : null;

        const sameKind = d.childType === selectedKind;
        const sameId = childId && childId === selectedId;

        const sameBaseCell =
          !cellCoords ||
          (baseCell.x === cellCoords.x && baseCell.y === cellCoords.y);

        if (sameKind && sameId && sameBaseCell) {
          isSelected = true;
        }
      }

      if (isSelected) {
        rect.style("stroke", "#f97316").style("stroke-width", 2);

        if (!didZoom) {
          didZoom = true;
          zoomOnRect(rect);
        }
      } else {
        rect.style("stroke", null).style("stroke-width", 0);
      }
    });
  }, [selectedEntity]);

  // Handle minimap click - move main viewport to clicked position
  const handleMinimapClick = (worldX, worldY) => {
    const svg = d3.select(svgRef.current);
    const zoom = zoomBehaviorRef.current;
    if (!zoom || !svgRef.current) return;

    const viewBox = svgRef.current.viewBox.baseVal;
    const currentZoom = currentZoomRef.current || MIN_ZOOM;

    // Calculate transform to center on clicked position
    const newTransform = d3.zoomIdentity
      .translate(
        viewBox.width / 2 - worldX * currentZoom,
        viewBox.height / 2 - worldY * currentZoom
      )
      .scale(currentZoom);

    // Animate to new position
    svg.transition().duration(300).call(zoom.transform, newTransform);
  };

  return (
    <div
      className="map-wrapper"
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <svg ref={svgRef} />
      {worldData &&
        worldData.cells &&
        xScaleRef.current &&
        yScaleRef.current && (
          <Minimap
            worldData={worldData}
            mainTransform={mainTransform}
            mainViewBox={mainViewBox}
            xScale={xScaleRef.current}
            yScale={yScaleRef.current}
            onMinimapClick={handleMinimapClick}
          />
        )}
    </div>
  );
}

export default WorldMap;

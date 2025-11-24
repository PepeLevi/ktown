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
let MIN_ZOOM = 1; // Will be calculated dynamically
const MAX_ZOOM = 160;

// Performance: Maximum cells visible at minimum zoom (zoom out limit)
const MAX_VISIBLE_CELLS_AT_MIN_ZOOM = 650;

// LOD Configuration - not really used now but kept for future tuning
const LOD_CONFIG = {
  maxCellsToRender: 400,
  minCellsToCombine: 300,
  maxCellsPerBlock: 40,
  zoomUpdateThrottle: 0,
};

// Hierarchical zoom thresholds
const HIERARCHY_LEVELS = [
  {
    name: "cell",
    minZoom: 1,
    getChildren: (cell) => {
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
    sizeRatio: 1.0,
  },
  {
    name: "undergroundRegion",
    minZoom: 20,
    getChildren: () => [],
    sizeRatio: 1.0,
  },
  {
    name: "site",
    minZoom: 30,
    getChildren: (site) => {
      const structures =
        site.data?.structures?.structure || site.structures?.structure;
      if (!structures) return [];
      return Array.isArray(structures) ? structures : [structures];
    },
    sizeRatio: 1.0,
  },
  {
    name: "structure",
    minZoom: 50,
    getChildren: (structure) => {
      return structure.inhabitants || structure.inhabitant || [];
    },
    sizeRatio: 1.0,
  },
  {
    name: "figure",
    minZoom: 80,
    getChildren: () => [],
    sizeRatio: 1.0,
  },
  {
    name: "cellFigure",
    minZoom: 25,
    getChildren: () => [],
    sizeRatio: 1.0,
  },
  {
    name: "writtenContent",
    minZoom: 35,
    getChildren: () => [],
    sizeRatio: 1.0,
  },
];

// Calculate Fibonacci-style fractal subdivision in a square
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
    return {
      x: offsetX,
      y: offsetY,
      width: boundingBoxWidth,
      height: boundingBoxHeight,
    };
  }

  const isWide = boundingBoxWidth >= boundingBoxHeight;

  if (index === 0) {
    if (isWide) {
      return {
        x: offsetX,
        y: offsetY,
        width: boundingBoxWidth / 2,
        height: boundingBoxHeight,
      };
    } else {
      return {
        x: offsetX,
        y: offsetY,
        width: boundingBoxWidth,
        height: boundingBoxHeight / 2,
      };
    }
  }

  const remainingCount = count - 1;
  const remainingIndex = index - 1;

  if (isWide) {
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

// ===== Generic helpers / hierarchy helpers =====

const sanitizeKey = (val) => String(val || "Unknown").replace(/\s+/g, "");

const sanitizeForSelector = (val) => {
  return String(val || "unknown")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
};

// Always return array
const normalizeToArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

// CELL → SITES
const getCellSites = (cell) => normalizeToArray(cell.sites);

// CELL → UNDERGROUND REGIONS
const getCellUndergroundRegions = (cell) =>
  normalizeToArray(cell.undergroundRegions);

// CELL → CELL-LEVEL FIGURES
const getCellFigures = (cell) => normalizeToArray(cell.historical_figures);

// CELL → CELL-LEVEL WRITTEN CONTENT
const getCellWrittenContents = (cell) =>
  normalizeToArray(cell.written_contents);

// SITE → STRUCTURES
const getSiteStructures = (site) => {
  if (!site) return [];

  if (Array.isArray(site.structures)) return site.structures;

  const sNested = site.structures?.structure;
  if (sNested) return normalizeToArray(sNested);

  const f2 = site.fromFile2?.structures?.structure;
  if (f2) return normalizeToArray(f2);

  const f1 = site.fromFile1?.structures?.structure;
  if (f1) return normalizeToArray(f1);

  return [];
};

// STRUCTURE → FIGURES (inhabitants)
const getStructureFigures = (structure) => {
  if (!structure) return [];
  const raw = structure.inhabitants || structure.inhabitant;
  const arr = normalizeToArray(raw);
  return arr.filter((hf) => hf && typeof hf === "object");
};

// FIGURE → BOOKS
const getFigureBooks = (hf) => {
  if (!hf) return [];
  return normalizeToArray(hf.books)
    .map((book, idx) => {
      if (!book) return null;
      const raw = book.raw || {};
      return {
        id: raw.written_content_id || `${hf.id || "hf"}-${idx}`,
        title: book.title || raw.title || "Untitled work",
        author_hfid: hf.id,
        author: hf,
        raw,
      };
    })
    .filter(Boolean);
};

// Count descendants recursively (for density-aware subdivision)
const countDescendantsForNode = (node) => {
  const type = node.childType || "cell";
  const data = node.childData || node;

  let directChildrenCount = 0;
  let nestedCount = 0;

  if (type === "cell") {
    const sites = getCellSites(data);
    const ugs = getCellUndergroundRegions(data);
    const cellFigs = getCellFigures(data);
    const cellWc = getCellWrittenContents(data);

    directChildrenCount +=
      sites.length + ugs.length + cellFigs.length + cellWc.length;

    sites.forEach((site) => {
      nestedCount += countDescendantsForNode({
        childType: "site",
        childData: site,
        originalCell: data,
      });
    });
  } else if (type === "site") {
    const structs = getSiteStructures(data);
    directChildrenCount += structs.length;
    structs.forEach((s) => {
      nestedCount += countDescendantsForNode({
        childType: "structure",
        childData: s,
        originalCell: node.originalCell,
      });
    });
  } else if (type === "structure") {
    const figs = getStructureFigures(data);
    directChildrenCount += figs.length;
    figs.forEach((hf) => {
      nestedCount += countDescendantsForNode({
        childType: "figure",
        childData: hf,
        originalCell: node.originalCell,
      });
    });
  } else if (type === "figure") {
    const books = getFigureBooks(data);
    directChildrenCount += books.length;
  } else {
    // leaf types: undergroundRegion, writtenContent, cellFigure
  }

  return directChildrenCount + nestedCount;
};

// How many direct children of this node should be visible at this zoom?
const getVisibleChildCountForNode = (
  node,
  allDirectChildren,
  zoom,
  level = 0
) => {
  if (allDirectChildren.length === 0) return 0;
  if (allDirectChildren.length === 1) return 1;

  const totalDescendants = countDescendantsForNode(node);

  const zoomFactor = level === 0 ? 1.5 : level === 1 ? 2 : 2.5;
  const baseCount = 1;

  const densityBoost = Math.log10(totalDescendants + 1); // 0..~3
  const effectiveZoom = Math.max(0, zoom - 1) * (1 + densityBoost * 0.3);

  const additionalCount = Math.floor(effectiveZoom / zoomFactor);
  const wanted = baseCount + Math.max(0, additionalCount);

  return Math.min(allDirectChildren.length, wanted);
};

function WorldMap({
  worldData,
  onCellClick,
  onEntityClick,
  selectedCell,
  selectedEntity,
}) {
  const svgRef = useRef(null);

  const zoomBehaviorRef = useRef(null);
  const mapWidthRef = useRef(0);
  const mapHeightRef = useRef(0);
  const currentZoomRef = useRef(1);
  const focusedCellRef = useRef(null);
  const xScaleRef = useRef(null);
  const yScaleRef = useRef(null);
  const zoomUpdateTimeoutRef = useRef(null);
  const lastRenderedZoomRef = useRef(1);

  const regionTypesRef = useRef([]);
  const siteTypesRef = useRef([]);
  const figureKindsRef = useRef(["default"]);

  const cellDragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    threshold: 5,
    timeoutId: null,
  });

  const [mainTransform, setMainTransform] = useState(null);
  const [mainViewBox, setMainViewBox] = useState(null);

  const isLevelVisible = (levelName) => {
    const level = HIERARCHY_LEVELS.find((l) => l.name === levelName);
    if (!level) return false;
    return currentZoomRef.current >= level.minZoom;
  };

  const optimizeVisibleCells = (visibleCells, zoom) => {
    if (!visibleCells || visibleCells.length === 0) return [];

    const validCells = visibleCells.filter(
      (c) => c && c.region?.type !== "Ocean"
    );
    if (validCells.length === 0) return [];

    return validCells.map((cell) => ({ type: "individual", cell }));
  };

  // Check if a cell is visible in the viewport
  const isCellVisible = (cell, xScale, yScale, transform, svgNode) => {
    if (!cell || !xScale || !yScale || !transform || !svgNode) return false;

    const viewBox = svgNode.viewBox.baseVal;
    const { x, y, k } = transform;

    const cellX = xScale(cell.y);
    const cellY = yScale(cell.x);
    const cellWidth = CELL_SIZE;
    const cellHeight = CELL_SIZE;

    const cellLeft = cellX * k + x;
    const cellRight = (cellX + cellWidth) * k + x;
    const cellTop = cellY * k + y;
    const cellBottom = (cellY + cellHeight) * k + y;

    const padding = CELL_SIZE * k;
    const viewportRight = viewBox.width + padding;
    const viewportBottom = viewBox.height + padding;

    return !(
      cellRight < -padding ||
      cellLeft > viewportRight ||
      cellBottom < -padding ||
      cellTop > viewportBottom
    );
  };

  const belongsToSubdividingCell = (cell, zoom) => {
    const focused = focusedCellRef.current;
    if (!focused || !cell) return false;
    const dx = Math.abs(cell.x - focused.x);
    const dy = Math.abs(cell.y - focused.y);
    const distance = Math.max(dx, dy);
    const maxDistance = Math.floor((zoom - 1) / 10);
    return distance <= maxDistance;
  };

  const handleLabelClick = (d) => {
    console.log("clicks label", d);
  };

  const getPatternId = (kind, key) => `pattern-${kind}-${sanitizeKey(key)}`;

  const zoomToPoint = (x, y, targetK = 8, duration = 200) => {
    const svgNode = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgNode || !zoomBehavior) return;

    const width = mapWidthRef.current || svgNode.viewBox.baseVal.width || 1;
    const height = mapHeightRef.current || svgNode.viewBox.baseVal.height || 1;

    const current = d3.zoomTransform(svgNode);
    const k = targetK ?? current.k;

    const next = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(k)
      .translate(-x, -y);

    d3.select(svgNode)
      .transition()
      .duration(duration)
      .call(zoomBehavior.transform, next);
  };

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

    let pattern = defsSelection.select(`#${pid}`);
    if (!pattern.empty()) {
      return pid;
    }

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
        .attr("preserveAspectRatio", "none");

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

  // ===== New hierarchy-preserving builder =====
  const buildCellChildren = (node, zoom, parentBbox, level = 0) => {
    const type = node.childType || "cell";
    const data = node.childData || node;

    const allChildData = [];

    if (type === "cell") {
      if (isLevelVisible("site")) {
        getCellSites(data).forEach((site) => {
          allChildData.push({ type: "site", data: site });
        });
      }
      if (isLevelVisible("undergroundRegion")) {
        getCellUndergroundRegions(data).forEach((ug) => {
          allChildData.push({ type: "undergroundRegion", data: ug });
        });
      }
      if (isLevelVisible("cellFigure")) {
        getCellFigures(data).forEach((hf) => {
          allChildData.push({ type: "cellFigure", data: hf });
        });
      }
      if (isLevelVisible("writtenContent")) {
        getCellWrittenContents(data).forEach((wc) => {
          allChildData.push({ type: "writtenContent", data: wc });
        });
      }
    } else if (type === "site") {
      if (isLevelVisible("structure")) {
        getSiteStructures(data).forEach((struct) => {
          allChildData.push({ type: "structure", data: struct });
        });
      }
    } else if (type === "structure") {
      if (isLevelVisible("figure")) {
        getStructureFigures(data).forEach((hf) => {
          allChildData.push({ type: "figure", data: hf });
        });
      }
    } else if (type === "figure") {
      if (isLevelVisible("writtenContent")) {
        getFigureBooks(data).forEach((book) => {
          allChildData.push({ type: "writtenContent", data: book });
        });
      }
    } else {
      // undergroundRegion, writtenContent, cellFigure are leaves
    }

    if (allChildData.length === 0) return [];

    const visibleCount = getVisibleChildCountForNode(
      node,
      allChildData,
      zoom,
      level
    );
    const visibleChildData = allChildData.slice(0, visibleCount);

    const children = [];

    visibleChildData.forEach((childInfo, idx) => {
      const gridPos = calculateGridPositions(
        idx,
        visibleCount,
        parentBbox.width,
        parentBbox.height
      );

      const cellData = node.originalCell || node.cell || node.childData || node;

      const childCell = {
        key: `${
          data.key ||
          cellData.key ||
          `${type}-${cellData.x ?? "?"}-${cellData.y ?? "?"}`
        }-child-${childInfo.type}-${idx}`,
        level: level + 1,
        parent: node,
        originalCell: node.originalCell || cellData || node, // bubble original map cell through
        childType: childInfo.type,
        childData: childInfo.data,
        bbox: {
          x: gridPos.x,
          y: gridPos.y,
          width: gridPos.width,
          height: gridPos.height,
        },
        children: [],
      };

      const childInnerBbox = {
        x: 0,
        y: 0,
        width: gridPos.width,
        height: gridPos.height,
      };

      childCell.children = buildCellChildren(
        childCell,
        zoom,
        childInnerBbox,
        level + 1
      );

      children.push(childCell);
    });

    return children;
  };

  // Recursive rendering for a cell (and its children)
  const renderRecursiveCell = (
    cell,
    parentBbox,
    gSelection,
    xScale,
    yScale,
    level = 0
  ) => {
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

    const rawCellKey = cell.key || `cell-${level}-${cellX}-${cellY}`;
    const sanitizedX = Math.round(cellX * 100) / 100;
    const sanitizedY = Math.round(cellY * 100) / 100;
    const uniqueKeyRaw = `${rawCellKey}-${level}-${sanitizedX}-${sanitizedY}`;
    const uniqueKey = sanitizeForSelector(uniqueKeyRaw);

    const cellRect = gSelection
      .selectAll(`rect.cell-${uniqueKey}`)
      .data(
        [{ ...cell, cellKey: uniqueKey, cellBbox }],
        (d) => d.cellKey || uniqueKey
      );

    const cellEnter = cellRect
      .enter()
      .append("rect")
      .attr("class", `cell cell-level-${level} cell-${uniqueKey}`)
      .attr("x", cellX)
      .attr("y", cellY)
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .style("cursor", "pointer")
      .style("pointer-events", "auto")
      .style("z-index", 10);

    const merged = cellEnter
      .merge(cellRect)
      .attr("x", cellX)
      .attr("y", cellY)
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .style("cursor", "pointer")
      .style("pointer-events", "auto")
      .each(function (d) {
        const rect = d3.select(this);
        const svg = d3.select(svgRef.current);
        const defs = svg.select("defs");

        if (level === 0 && d.region?.type === "Ocean") {
          rect.style("display", "none");
          return;
        }

        const cellKeyForTexture =
          d.key ||
          d.originalCell?.key ||
          d.cellKey ||
          `cell-${level}-${cellX}-${cellY}`;

        let texUrl = null;
        let patternKey = null;

        console.log("cell data sample", d);

        if (level === 0) {
          if (d.region?.type !== "Ocean") {
            texUrl = getRegionTex(d.region?.type, cellKeyForTexture);
            patternKey = `region-${sanitizeForSelector(cellKeyForTexture)}`;
          }
        } else if (d.isOriginalCell || d.childType === "region") {
          const regionType = d.childData?.type || d.originalCell?.region?.type;
          texUrl = getRegionTex(regionType, cellKeyForTexture);
          patternKey = `region-${sanitizeForSelector(cellKeyForTexture)}`;
        } else if (d.childType === "site") {
          const site = d.childData;
          const siteType =
            site?.fromFile2?.type ||
            site?.fromFile1?.type ||
            site?.type ||
            "default";
          texUrl = getSiteTex(siteType, cellKeyForTexture);
          patternKey = `site-${sanitizeForSelector(
            cellKeyForTexture
          )}-${sanitizeForSelector(siteType)}`;
        } else if (d.childType === "structure") {
          const structId =
            d.childData?.id || d.childData?.local_id || "default";
          texUrl = getRegionTex(
            null,
            `${cellKeyForTexture}-struct-${structId}`
          );

          console.log("renders child type structure", d);

          patternKey = `structure-${sanitizeForSelector(
            cellKeyForTexture
          )}-${sanitizeForSelector(String(structId))}`;
        } else if (d.childType === "figure" || d.childType === "cellFigure") {
          texUrl = getFigureTex(d.childData, cellKeyForTexture);
          patternKey = `fig-${sanitizeForSelector(
            cellKeyForTexture
          )}-${sanitizeForSelector(String(d.childData?.id || "default"))}`;
        } else if (d.childType === "undergroundRegion") {
          const ugId = d.childData?.id || "default";
          texUrl = getRegionTex("cavern", `${cellKeyForTexture}-ug-${ugId}`);
          patternKey = `underground-${sanitizeForSelector(
            cellKeyForTexture
          )}-${sanitizeForSelector(String(ugId))}`;
        } else if (d.childType === "writtenContent") {
          const wcId = d.childData?.id || d.childData?.title || "default";
          texUrl = getRegionTex(null, `${cellKeyForTexture}-wc-${wcId}`);
          patternKey = `written-${sanitizeForSelector(
            cellKeyForTexture
          )}-${sanitizeForSelector(String(wcId))}`;
        } else {
          texUrl = getRegionTex(null, cellKeyForTexture);
          patternKey = `default-${sanitizeForSelector(cellKeyForTexture)}`;
        }

        let appliedTexture = false;
        if (texUrl && patternKey) {
          const pid = getOrCreatePattern(defs, patternKey, texUrl);
          if (pid) {
            rect.style("fill", `url(#${pid})`).style("opacity", 1);
            appliedTexture = true;
          }
        }

        if (!appliedTexture) {
          const fallbackTexUrl = getRegionTex(null, cellKeyForTexture);
          const fallbackPatternKey = `fallback-${sanitizeForSelector(
            cellKeyForTexture
          )}`;
          const fallbackPid = getOrCreatePattern(
            defs,
            fallbackPatternKey,
            fallbackTexUrl
          );
          if (fallbackPid) {
            rect.style("fill", `url(#${fallbackPid})`).style("opacity", 1);
          } else {
            rect.style("fill", "#f0f0f0").style("opacity", 1);
            console.warn(
              "Failed to create texture for cell:",
              cellKeyForTexture
            );
          }
        }

        rect.style("opacity", 1);

        const hasVisibleChildren = d.children && d.children.length > 0;

        if (hasVisibleChildren) {
          rect
            .style("stroke", "rgba(255,255,255,0.3)")
            .style("stroke-width", 0.5);
        } else {
          rect.style("stroke", null).style("stroke-width", 0);
        }
      });

    const cellDragState = cellDragStateRef.current;

    const handleCellMouseDown = (event, d) => {
      cellDragState.isDragging = false;
      cellDragState.startX = event.clientX;
      cellDragState.startY = event.clientY;

      if (cellDragState.timeoutId) {
        clearTimeout(cellDragState.timeoutId);
        cellDragState.timeoutId = null;
      }
    };

    const handleCellMouseMove = (event) => {
      if (cellDragState.startX !== 0 || cellDragState.startY !== 0) {
        const dx = Math.abs(event.clientX - cellDragState.startX);
        const dy = Math.abs(event.clientY - cellDragState.startY);
        if (dx > cellDragState.threshold || dy > cellDragState.threshold) {
          cellDragState.isDragging = true;
        }
      }
    };

    const handleCellClick = (event, d) => {
      const wasDragging = cellDragState.isDragging;

      if (cellDragState.timeoutId) {
        clearTimeout(cellDragState.timeoutId);
      }
      cellDragState.timeoutId = setTimeout(() => {
        cellDragState.isDragging = false;
        cellDragState.startX = 0;
        cellDragState.startY = 0;
        cellDragState.timeoutId = null;
      }, 150);

      if (wasDragging) {
        event.stopPropagation();
        return;
      }

      event.stopPropagation();

      const originalCell = d.originalCell || d;

      if (!originalCell) {
        console.warn("No originalCell found in clicked cell:", d);
        return;
      }

      let composed = null;

      if (level === 0) {
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
            site,
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
            name,
            type: structure.type || null,
            cellCoords: { x: originalCell.x, y: originalCell.y },
            structure,
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
          const region = d.childData || originalCell.region;

          composed = {
            kind: "cell",
            name: `Region: ${region?.type || "Unknown"}`,
            type: region?.type || null,
            cellCoords: { x: originalCell.x, y: originalCell.y },
            cell: originalCell,
            region,
            sites: originalCell.sites || [],
            undergroundRegions: originalCell.undergroundRegions || [],
            historical_figures: originalCell.historical_figures || [],
            written_contents: originalCell.written_contents || [],
          };
        }
      }

      if (composed) {
        if (onEntityClick) {
          onEntityClick(composed);
        }
      }

      if (onCellClick) {
        onCellClick(d);
      }
    };

    merged.on("mousedown", handleCellMouseDown);
    merged.on("mousemove", handleCellMouseMove);
    merged.on("click", handleCellClick);

    d3.select(window).on("mouseup.cellDrag", () => {});

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

  // Initial render
  useEffect(() => {
    if (!worldData || !worldData.cells?.length) return;

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

    const viewBox = svg.node().viewBox.baseVal;
    const viewportWidth = viewBox.width;
    const viewportHeight = viewBox.height;

    const cellsPerViewportAxis = Math.sqrt(MAX_VISIBLE_CELLS_AT_MIN_ZOOM);
    const requiredZoomX = viewportWidth / (cellsPerViewportAxis * CELL_SIZE);
    const requiredZoomY = viewportHeight / (cellsPerViewportAxis * CELL_SIZE);
    const calculatedMinZoom = Math.max(requiredZoomX, requiredZoomY, 0.5);

    MIN_ZOOM = calculatedMinZoom;

    currentZoomRef.current = MIN_ZOOM;
    focusedCellRef.current = null;

    const centerX = width / 2;
    const centerY = height / 2;
    const initialTransform = d3.zoomIdentity
      .translate(
        viewportWidth / 2 - centerX * MIN_ZOOM,
        viewportHeight / 2 - centerY * MIN_ZOOM
      )
      .scale(MIN_ZOOM);

    g.attr("transform", initialTransform);

    g.selectAll("rect.cell").remove();

    const visibleCells = cells.filter((cell) => {
      if (!cell || cell.region?.type === "Ocean") return false;
      return isCellVisible(cell, xScale, yScale, initialTransform, svg.node());
    });

    const cellsToRender = optimizeVisibleCells(
      visibleCells,
      currentZoomRef.current
    );

    cellsToRender.forEach((item) => {
      const cell = item.cell;
      const cellBbox = {
        x: xScale(cell.y),
        y: yScale(cell.x),
        width: CELL_SIZE,
        height: CELL_SIZE,
      };

      const cellNode = {
        childType: "cell",
        childData: cell,
        originalCell: cell,
        key: cell.key,
      };

      const cellWithChildren = {
        ...cell,
        children: buildCellChildren(
          cellNode,
          currentZoomRef.current,
          { x: 0, y: 0, width: CELL_SIZE, height: CELL_SIZE },
          0
        ),
      };

      renderRecursiveCell(cellWithChildren, cellBbox, g, xScale, yScale, 0);
    });
  }, [worldData]);

  // Zoom / re-render on zoom
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
        if (event.type === "wheel") return true;
        if (event.type === "touchstart" || event.type === "touchmove")
          return true;
        if (event.type === "mousedown") {
          return event.button === 0;
        }
        return false;
      })
      .on("zoom", (event) => {
        const { x, y, k } = event.transform;

        if (k < MIN_ZOOM) {
          const clampedTransform = d3.zoomIdentity
            .translate(event.transform.x, event.transform.y)
            .scale(MIN_ZOOM);
          svg.call(zoom.transform, clampedTransform);
          return;
        }

        g.attr("transform", `translate(${x},${y}) scale(${k})`);

        const oldZoom = currentZoomRef.current;
        currentZoomRef.current = k;

        const svgNode = svgRef.current;
        const xScale = xScaleRef.current;
        const yScale = yScaleRef.current;

        if (svgNode && worldData && worldData.cells && xScale && yScale) {
          const viewBox = svgNode.viewBox.baseVal;
          setMainTransform(event.transform);
          setMainViewBox({ width: viewBox.width, height: viewBox.height });
          const viewportCenterX = viewBox.width / 2;
          const viewportCenterY = viewBox.height / 2;

          const worldX = (viewportCenterX - x) / k;
          const worldY = (viewportCenterY - y) / k;

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

          const oldFocused = focusedCellRef.current;
          focusedCellRef.current = focusedCell;

          const transform = event.transform;

          requestAnimationFrame(() => {
            lastRenderedZoomRef.current = k;

            const svgNode = svgRef.current;
            const allCells = worldData.cells;

            g.selectAll("rect.cell").remove();

            const visibleCells = allCells.filter((cell) => {
              if (!cell || cell.region?.type === "Ocean") return false;
              return isCellVisible(cell, xScale, yScale, transform, svgNode);
            });

            const cellsToRender = optimizeVisibleCells(visibleCells, k);

            cellsToRender.forEach((item) => {
              const cell = item.cell;
              const cellBbox = {
                x: xScale(cell.y),
                y: yScale(cell.x),
                width: CELL_SIZE,
                height: CELL_SIZE,
              };

              const cellNode = {
                childType: "cell",
                childData: cell,
                originalCell: cell,
                key: cell.key,
              };

              const cellWithChildren = {
                ...cell,
                children: buildCellChildren(
                  cellNode,
                  k,
                  { x: 0, y: 0, width: CELL_SIZE, height: CELL_SIZE },
                  0
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

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;
    svg.on("dblclick.zoom", null);

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

      svg.call(zoom.transform, initialTransform);

      setMainTransform(initialTransform);
      setMainViewBox({ width: viewBox.width, height: viewBox.height });
    } else {
      const defaultTransform = d3.zoomIdentity.translate(0, 0).scale(MIN_ZOOM);
      svg.call(zoom.transform, defaultTransform);
      setMainTransform(defaultTransform);
      setMainViewBox({ width: viewBox.width, height: viewBox.height });
    }

    return () => {
      svg.on(".zoom", null);
    };
  }, [worldData]);

  // highlight selected entity
  useEffect(() => {
    if (!selectedEntity) return;

    const svg = d3.select(svgRef.current);
    if (svg.empty()) return;

    const allCellRects = svg.selectAll("rect.cell");

    allCellRects.each(function (d) {
      const rect = d3.select(this);
      let isSelected = false;

      if (
        selectedEntity.kind === "cell" &&
        d.originalCell &&
        selectedEntity.cell &&
        selectedEntity.cell.key === d.originalCell.key
      ) {
        isSelected = true;
      } else if (selectedEntity.kind === d.childType && d.childData) {
        if (
          selectedEntity.childData &&
          d.childData.id === selectedEntity.childData.id
        ) {
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

  const handleMinimapClick = (worldX, worldY) => {
    const svg = d3.select(svgRef.current);
    const zoom = zoomBehaviorRef.current;
    if (!zoom || !svgRef.current) return;

    const viewBox = svgRef.current.viewBox.baseVal;
    const currentZoom = currentZoomRef.current || MIN_ZOOM;

    const newTransform = d3.zoomIdentity
      .translate(
        viewBox.width / 2 - worldX * currentZoom,
        viewBox.height / 2 - worldY * currentZoom
      )
      .scale(currentZoom);

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

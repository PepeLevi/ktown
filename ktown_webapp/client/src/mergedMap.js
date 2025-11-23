// src/WorldMap.jsx
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import {
  getRegionTex as proceduralRegionTex,
  getSiteTex as proceduralSiteTex,
  getFigureTex as proceduralFigureTex,
} from "./proceduralTextures";

const regionColor = "yellow";
const siteColor = "var(--primary-color)";
const structureColor = "var(--primary-color)";
const figureColor = "var(--primary-color)";
const bookColor = "var(--primary-color)";

const CELL_SIZE = 60;
const CELL_GAP = 0;

// zoom limits
const MIN_ZOOM = 5;
const MAX_ZOOM = 3500;

const MAX_RENDERED_CELLS = 10000; // tweak as you like

const ZOOM_BY_KIND = {
  cell: 20,
  site: 20,
  structure: 50,
  figure: 80,
  book: 120,
};

// when each level starts to appear (tweak as you like)
const HIERARCHY_VISIBILITY = {
  site: 20,
  structure: 80,
  figure: 200,
  book: 350,
};

function calculateGridPositions(
  index,
  count,
  entitySize,
  boundingBoxWidth,
  boundingBoxHeight
) {
  if (count === 1) {
    const x = boundingBoxWidth / 2 - entitySize / 2;
    const y = boundingBoxHeight / 2 - entitySize / 2;
    return { x, y };
  }

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  const col = index % cols;
  const row = Math.floor(index / cols);

  const totalGridWidth = cols * entitySize;
  const totalGridHeight = rows * entitySize;

  const startX = (boundingBoxWidth - totalGridWidth) / 2;
  const startY = (boundingBoxHeight - totalGridHeight) / 2;

  const x = startX + col * entitySize;
  const y = startY + row * entitySize;

  return { x, y };
}

function computeChildSize(
  parentWidth,
  parentHeight,
  count,
  paddingFactor = 0.8
) {
  if (!count || count <= 0) return 0;

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  const maxWidth = (parentWidth * paddingFactor) / cols;
  const maxHeight = (parentHeight * paddingFactor) / rows;

  return Math.min(maxWidth, maxHeight);
}

function WorldMap({
  worldData,
  onCellClick,
  onEntityClick,
  selectedCell,
  selectedEntity,
}) {
  const svgRef = useRef(null);

  const zoomBehaviorRef = useRef(null); // store d3.zoom()
  const mapWidthRef = useRef(0); // store map width
  const mapHeightRef = useRef(0); // store map height

  const zoomStateRef = useRef({ x: 0, y: 0, k: 10 });
  const currentZoomRef = useRef(10);

  const sanitizeKey = (val) => String(val || "Unknown").replace(/\s+/g, "");

  const sanitizeForSelector = (val) =>
    String(val || "unknown")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

  // wrappers so we can still call getRegionTex/type-only in other places
  const getRegionTex = (type, key) => proceduralRegionTex?.(type, key) ?? null;
  const getSiteTex = (type, key) => proceduralSiteTex?.(type, key) ?? null;
  const getFigureTex = (hf, key) => proceduralFigureTex?.(hf, key) ?? null;

  const getPatternId = (kind, key) =>
    `pattern-${kind}-${sanitizeForSelector(`${kind}-${key}`)}`;

  const getOrCreatePattern = (defsSelection, patternKey, textureUrl) => {
    if (!defsSelection || defsSelection.empty() || !textureUrl) return null;

    const pid = sanitizeForSelector(`pattern-${patternKey}`);
    let pattern = defsSelection.select(`#${pid}`);
    if (!pattern.empty()) return pid;

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
  };

  // helper: accept single object or array and always return array
  const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  // ----- name helpers -----
  const getCellName = (cell) =>
    cell?.region?.name || `(${cell?.x}, ${cell?.y})`;

  const getSiteName = (site) =>
    site?.fromFile2?.name || site?.fromFile1?.name || site?.name || null;

  const getStructureName = (structure) =>
    structure?.name || structure?.type || null;

  const getFigureName = (hf) => hf?.name || hf?.id || null;

  const getBookTitle = (book) => book?.title || null;

  // case-insensitive, trimmed name equality
  const namesEqual = (a, b) => {
    if (!a || !b) return false;
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  };
  // -------------------------

  const handleLabelClick = (d) => {
    console.log("clicks label", d);
  };

  const zoomToPoint = (x, y, targetK = 8, duration = 750) => {
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

  const getAutoZoomForBox = (boxWidth, boxHeight) => {
    const svgNode = svgRef.current;
    if (!svgNode) return ZOOM_BY_KIND.cell; // fallback

    const width = mapWidthRef.current || svgNode.viewBox.baseVal.width || 1;
    const height = mapHeightRef.current || svgNode.viewBox.baseVal.height || 1;

    // we want the entity to roughly occupy ~1/4 of viewport
    const targetFraction = 1;

    const scaleX = (width * targetFraction) / Math.max(boxWidth, 1);
    const scaleY = (height * targetFraction) / Math.max(boxHeight, 1);

    const k = Math.min(scaleX, scaleY);

    // clamp to global limits
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, k));
  };

  // approximate multi-line word-wrap for SVG text
  // returns { lines: string[], truncated: boolean }
  function wrapLabelLines(text, maxWidth, fontSize, maxHeight) {
    if (!text) return { lines: [], truncated: false };

    const words = String(text).split(/\s+/);
    const lines = [];
    const charWidth = fontSize * 0.6; // heuristic
    const maxCharsPerLine = Math.max(
      1,
      Math.floor(maxWidth / Math.max(charWidth, 0.1))
    );

    const lineHeight = fontSize * 1.1;
    const maxLines = Math.max(
      1,
      Math.floor(maxHeight / Math.max(lineHeight, 0.1))
    );

    let currentLine = "";

    words.forEach((word) => {
      if (!currentLine.length) {
        currentLine = word;
        return;
      }

      const next = currentLine + " " + word;
      if (next.length <= maxCharsPerLine) {
        currentLine = next;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) lines.push(currentLine);

    let truncated = false;

    if (lines.length > maxLines) {
      truncated = true;
      const trimmed = lines.slice(0, maxLines);
      const last = trimmed[trimmed.length - 1];
      if (last && last.length > 1) {
        trimmed[trimmed.length - 1] =
          last.slice(0, Math.max(1, last.length - 1)) + "…";
      } else if (trimmed.length) {
        trimmed[trimmed.length - 1] = "…";
      }
      return { lines: trimmed, truncated };
    }

    return { lines, truncated };
  }

  const updateVisibility = (k) => {
    const svg = d3.select(svgRef.current);
    const g = svg.select("g");
    if (g.empty()) return;

    const showSites = k >= HIERARCHY_VISIBILITY.site;
    const showStructures = k >= HIERARCHY_VISIBILITY.structure;
    const showFigures = k >= HIERARCHY_VISIBILITY.figure;
    const showBooks = k >= HIERARCHY_VISIBILITY.book;

    // sites
    g.selectAll("rect.site-marker").style("opacity", showSites ? 1 : 0);
    g.selectAll("text.site-label").style("opacity", showSites ? 1 : 0);

    // structures
    g.selectAll("rect.structure-marker").style(
      "opacity",
      showStructures ? 1 : 0
    );
    g.selectAll("text.structure-label").style(
      "opacity",
      showStructures ? 1 : 0
    );

    // figures
    g.selectAll("rect.figure-marker").style("opacity", showFigures ? 1 : 0);
    g.selectAll("text.figure-label").style("opacity", showFigures ? 1 : 0);

    // books
    g.selectAll("foreignObject.book-fo").style("opacity", showBooks ? 1 : 0);

    // make parents more transparent as deeper levels appear
    let cellOpacity = 1;
    if (showSites) cellOpacity *= 0.85;
    if (showStructures) cellOpacity *= 0.75;
    if (showFigures) cellOpacity *= 0.65;

    g.selectAll("rect.cell").style("opacity", cellOpacity);

    let siteOpacity = showSites ? 1 : 0;
    if (showStructures) siteOpacity *= 0.8;
    if (showFigures) siteOpacity *= 0.6;
    g.selectAll("rect.site-marker").style("opacity", siteOpacity);
  };

  // 1) build map & markers
  useEffect(() => {
    if (!worldData || !worldData.cells?.length) return;

    // apply cap
    const allCells = worldData.cells;
    const cells =
      MAX_RENDERED_CELLS && allCells.length > MAX_RENDERED_CELLS
        ? allCells.slice(0, MAX_RENDERED_CELLS)
        : allCells;

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

    // --- NEW LAYOUT HELPERS: children fill parent with margin ---

    const getCellBox = (cell) => ({
      x: xScale(cell.y),
      y: yScale(cell.x),
      width: CELL_SIZE,
      height: CELL_SIZE,
    });

    function getChildBox(parentBox, index, count) {
      if (!parentBox || count <= 0) {
        return {
          x: parentBox?.x ?? 0,
          y: parentBox?.y ?? 0,
          width: 0,
          height: 0,
        };
      }

      const margin = parentBox.width * 0.05;
      const innerX = parentBox.x + margin;
      const innerY = parentBox.y + margin;
      const innerW = Math.max(parentBox.width - margin * 2, 0);
      const innerH = Math.max(parentBox.height - margin * 2, 0);

      if (count === 1) {
        return {
          x: innerX,
          y: innerY,
          width: innerW,
          height: innerH,
        };
      }

      const horizontalStrips = innerW >= innerH;

      if (horizontalStrips) {
        const childW = innerW / count;
        return {
          x: innerX + index * childW,
          y: innerY,
          width: childW,
          height: innerH,
        };
      } else {
        const childH = innerH / count;
        return {
          x: innerX,
          y: innerY + index * childH,
          width: innerW,
          height: childH,
        };
      }
    }

    const getSiteBox = (cell, siteIdx, siteCount) => {
      const cellBox = getCellBox(cell);
      return getChildBox(cellBox, siteIdx, siteCount || 1);
    };

    const getStructureBox = (
      cell,
      siteIdx,
      siteCount,
      structIdx,
      structCount
    ) => {
      const siteBox = getSiteBox(cell, siteIdx, siteCount || 1);
      return getChildBox(siteBox, structIdx, structCount || 1);
    };

    const getFigureParentBox = (
      cell,
      siteIdx,
      siteCount,
      structIdx,
      structCount
    ) => {
      if (structIdx != null && structCount > 0) {
        return getStructureBox(
          cell,
          siteIdx,
          siteCount || 1,
          structIdx,
          structCount
        );
      }
      return getSiteBox(cell, siteIdx, siteCount || 1);
    };

    const getFigureBox = (
      cell,
      siteIdx,
      siteCount,
      structIdx,
      structCount,
      figIdx,
      figCount
    ) => {
      const parentBox = getFigureParentBox(
        cell,
        siteIdx,
        siteCount,
        structIdx,
        structCount
      );
      return getChildBox(parentBox, figIdx, figCount || 1);
    };

    const getBookBox = (
      cell,
      siteIdx,
      siteCount,
      structIdx,
      structCount,
      figIdx,
      figCount,
      bookIdx,
      bookCount
    ) => {
      const figureBox = getFigureBox(
        cell,
        siteIdx,
        siteCount,
        structIdx,
        structCount,
        figIdx,
        figCount
      );
      return getChildBox(figureBox, bookIdx, bookCount || 1);
    };

    // --- generic renderer for sites / structures / figures ---
    function drawEntityLayer({
      markers,
      rectClass,
      labelClass,
      size, // can be number or (d, parentBBox) => number
      keyFn,
      getFill,
      baseStroke,
      baseStrokeWidth,
      labelFontSize, // can be number or (renderSize, d, parentBBox) => number
      labelFill,
      getLabelText,
      getTitleText,
      composeEntity,
      getZoomParams,
      getBoundingBox, // optional (d) => { x, y, width, height }
      layoutChildBox, // optional (d, parentBox) => { x, y, width, height }
    }) {
      if (!markers || !markers.length) {
        g.selectAll(`rect.${rectClass}`).remove();
        g.selectAll(`text.${labelClass}`).remove();
        return;
      }

      const resolveParentBox = (d) =>
        (getBoundingBox && getBoundingBox(d)) || {
          x: xScale(d.cell.y),
          y: yScale(d.cell.x),
          width: CELL_SIZE,
          height: CELL_SIZE,
        };

      const resolveSize = (d, parentBox) =>
        typeof size === "function" ? size(d, parentBox) : size;

      const resolveFontSize = (renderSize, d, parentBox) =>
        typeof labelFontSize === "function"
          ? labelFontSize(renderSize, d, parentBox)
          : labelFontSize;

      const hasCustomLayout = typeof layoutChildBox === "function";

      // --- rects ---
      const rectSel = g.selectAll(`rect.${rectClass}`).data(markers, keyFn);

      const rectEnter = rectSel
        .enter()
        .append("rect")
        .attr("class", rectClass)
        .style("cursor", "pointer");

      const rectUpdate = rectEnter.merge(rectSel);

      rectUpdate.each(function (d) {
        if (hasCustomLayout) {
          const parentBox = resolveParentBox(d);
          const childBox = layoutChildBox(d, parentBox);
          d._bbox = { ...childBox };
          d._renderSize = Math.min(childBox.width, childBox.height);
        }
      });

      rectUpdate
        .attr("x", (d) => {
          if (hasCustomLayout && d._bbox) return d._bbox.x;

          const parentBox = resolveParentBox(d);
          const s = resolveSize(d, parentBox);
          const { x } = calculateGridPositions(
            d.idx,
            d.count,
            s,
            parentBox.width,
            parentBox.height
          );
          const finalX = parentBox.x + x;

          d._bbox = d._bbox || {};
          d._bbox.x = finalX;
          d._bbox.width = s;
          d._renderSize = s;

          return finalX;
        })
        .attr("y", (d) => {
          if (hasCustomLayout && d._bbox) return d._bbox.y;

          const parentBox = resolveParentBox(d);
          const s = d._renderSize ?? resolveSize(d, parentBox);
          const { y } = calculateGridPositions(
            d.idx,
            d.count,
            s,
            parentBox.width,
            parentBox.height
          );
          const finalY = parentBox.y + y;

          d._bbox = d._bbox || {};
          d._bbox.y = finalY;
          d._bbox.height = s;
          d._renderSize = s;

          return finalY;
        })
        .attr("width", (d) =>
          hasCustomLayout && d._bbox
            ? d._bbox.width
            : d._renderSize || CELL_SIZE * 0.3
        )
        .attr("height", (d) =>
          hasCustomLayout && d._bbox
            ? d._bbox.height
            : d._renderSize || CELL_SIZE * 0.3
        )
        .each(function (d) {
          const rect = d3.select(this);
          const fill = getFill ? getFill(d) : "#9ca3af";
          rect.style("fill", fill);
          if (baseStroke != null) {
            rect
              .style("stroke", baseStroke)
              .style("stroke-width", baseStrokeWidth ?? 0.1);
          }
        });

      // tooltips (only added on enter)
      rectEnter
        .append("title")
        .text((d) => (getTitleText ? getTitleText(d) : ""));

      // --- labels ---
      const labelSel = g.selectAll(`text.${labelClass}`).data(markers, keyFn);

      const labelEnter = labelSel
        .enter()
        .append("text")
        .attr("class", labelClass)
        .attr("text-anchor", "start")
        .style("pointer-events", "auto");

      labelEnter.merge(labelSel).each(function (d) {
        const label = d3.select(this);

        const entityBox = d._bbox || resolveParentBox(d);

        const s = d._renderSize || resolveSize(d, entityBox);
        const rawText = getLabelText ? getLabelText(d) : "";

        const padding = entityBox.width * 0.01;
        const maxWidth = Math.max(1, entityBox.width - padding * 2);
        const maxHeight = Math.max(1, entityBox.height - padding * 2);

        const baseFs = resolveFontSize(s, d, entityBox);

        const len = rawText ? rawText.length : 0;
        const MIN_FS = 0.8;
        const MAX_FS = 8;

        let candidateFs = baseFs;
        if (len > 0) {
          const refLen = 12;
          const factor = Math.min(1, refLen / len);
          candidateFs = baseFs * factor;
        }

        candidateFs = Math.min(candidateFs, maxHeight / 1.1);
        candidateFs = Math.max(MIN_FS, Math.min(MAX_FS, candidateFs));

        let fs = candidateFs;
        let wrapped = wrapLabelLines(rawText, maxWidth, fs, maxHeight);

        let attempts = 0;
        const MAX_ATTEMPTS = 5;

        while (wrapped.truncated && fs > MIN_FS && attempts < MAX_ATTEMPTS) {
          fs *= 0.8;
          if (fs < MIN_FS) fs = MIN_FS;
          wrapped = wrapLabelLines(rawText, maxWidth, fs, maxHeight);
          attempts += 1;
        }

        const lines = wrapped.lines;

        const baseX = entityBox.x + padding;
        const baseY = entityBox.y + fs + padding;

        label
          .attr("x", baseX)
          .attr("y", baseY)
          .style("font-size", `${fs}px`)
          .style("fill", labelFill ?? "#fff");

        label.selectAll("tspan").remove();

        lines.forEach((line, i) => {
          label
            .append("tspan")
            .attr("x", baseX)
            .attr("dy", i === 0 ? 0 : fs * 1.1)
            .text(line);
        });
      });

      // --- shared click handler (rect + label) ---
      const handleClick = (event, d) => {
        event.stopPropagation();

        onCellClick?.(null);

        if (composeEntity) {
          const composed = composeEntity(d);
          if (composed) onEntityClick?.(composed);

          if (getZoomParams) {
            const { cx, cy, k } = getZoomParams(d) || {};
            if (cx != null && cy != null) {
              zoomToPoint(cx, cy, k);
            }
          }
        }
      };

      rectEnter.on("click", handleClick);
      labelEnter.on("click", handleClick);

      rectSel.exit().remove();
      labelSel.exit().remove();
    }

    // cells
    const cellsSelection = g.selectAll("rect.cell").data(cells, (d) => d.key);

    const cellsEnter = cellsSelection
      .enter()
      .append("rect")
      .attr("class", "cell")
      .attr("x", (d) => xScale(d.y))
      .attr("y", (d) => yScale(d.x))
      .attr("width", CELL_SIZE)
      .attr("height", CELL_SIZE)
      .style("cursor", "pointer");

    cellsEnter.merge(cellsSelection).each(function (d) {
      const rect = d3.select(this);
      const cellKey = d.key || `${d.x},${d.y}`;
      const texUrl = getRegionTex(d.region?.type, cellKey);

      if (texUrl) {
        const patternKey = `region-${d.region?.type || "default"}-${cellKey}`;
        const pid = getOrCreatePattern(defs, patternKey, texUrl);
        if (pid) {
          rect.style("fill", `url(#${pid})`);
          return;
        }
      }

      rect.style("fill", "#111827");
    });

    cellsEnter
      .append("title")
      .text(
        (d) =>
          `(${d.x}, ${d.y})` +
          (d.region?.type ? `\nRegion: ${d.region.type}` : "") +
          `\nSites: ${d.sites?.length || 0}` +
          `\nWritten contents: ${d.written_contents?.length || 0}`
      );

    cellsSelection.exit().remove();

    // sites
    const siteMarkers = [];
    cells.forEach((cell) => {
      if (cell.sites && cell.sites.length) {
        cell.sites.forEach((site, idx) => {
          siteMarkers.push({
            kind: "site",
            cell,
            site,
            idx,
            count: cell.sites.length,
          });
        });
      }
    });

    drawEntityLayer({
      markers: siteMarkers,
      rectClass: "site-marker",
      labelClass: "site-label",

      size: (d, parentBox) =>
        computeChildSize(parentBox.width, parentBox.height, d.count, 0.85),

      keyFn: (d) => `${d.cell.key}-site-${d.site.id || d.idx}`,

      getFill: (d) => {
        const type =
          d.site?.fromFile2?.type ||
          d.site?.fromFile1?.type ||
          d.site?.type ||
          "default";

        const key = `${d.cell.key || `${d.cell.x},${d.cell.y}`}-site-${
          d.site.id || d.idx
        }`;

        const texUrl = getSiteTex(type, key);
        if (!texUrl) return "#9ca3af";

        const patternKey = `site-${type}-${key}`;
        const pid = getOrCreatePattern(defs, patternKey, texUrl);
        return pid ? `url(#${pid})` : "#9ca3af";
      },

      baseStroke: siteColor,
      baseStrokeWidth: 0.1,

      labelFontSize: (s) => Math.max(2, s * 0.01),
      labelFill: siteColor,

      getLabelText: (d) => getSiteName(d.site) || "",

      getTitleText: (d) => {
        const name = getSiteName(d.site) || "Site";
        const type =
          d.site?.fromFile2?.type ||
          d.site?.fromFile1?.type ||
          d.site?.type ||
          "";
        return `${name}${type ? ` (${type})` : ""}`;
      },

      composeEntity: (d) => {
        const siteType =
          d.site?.fromFile2?.type ||
          d.site?.fromFile1?.type ||
          d.site?.type ||
          "default";

        const siteName = getSiteName(d.site) || "Unknown site";

        const siteTextureUrl = getSiteTex(siteType);
        const regionType = d.cell.region?.type || null;
        const regionTextureUrl = getRegionTex(regionType);

        return {
          kind: "site",
          name: siteName,
          type: siteType,
          textureUrl: siteTextureUrl,
          regionTextureUrl,
          cellCoords: { x: d.cell.x, y: d.cell.y },

          site: d.site,
          cell: d.cell,
          region: d.cell.region,
          undergroundRegions: d.cell.undergroundRegions || [],

          historical_figures: d.site.historical_figures || [],
          inhabitants: d.site.inhabitants || [],
          written_contents: d.site.written_contents || [],
        };
      },

      getZoomParams: (d) => {
        const cx = xScale(d.cell.y) + CELL_SIZE / 2;
        const cy = yScale(d.cell.x) + CELL_SIZE / 2;
        return { cx, cy, k: 20 };
      },

      layoutChildBox: (d, parentBox) => getChildBox(parentBox, d.idx, d.count),
    });

    // structures
    const structureMarkers = [];
    cells.forEach((cell) => {
      (cell.sites || []).forEach((site, siteIdx) => {
        const raw = site.structures;
        const structures = normalizeToArray(raw);
        structures.forEach((structure, idx) => {
          structureMarkers.push({
            kind: "structure",
            cell,
            site,
            structure,
            idx,
            count: structures.length,
            parentSiteIdx: siteIdx,
            parentSiteCount: (cell.sites || []).length,
          });
        });
      });
    });

    drawEntityLayer({
      markers: structureMarkers,
      rectClass: "structure-marker",
      labelClass: "structure-label",

      size: (d, parentBox) =>
        computeChildSize(parentBox.width, parentBox.height, d.count, 0.8),

      keyFn: (d) =>
        `${d.cell.key}-site-${d.site.id}-structure-${
          d.structure.id || d.structure.local_id || d.idx
        }`,

      getFill: () => "#6b7280",
      baseStroke: structureColor,
      baseStrokeWidth: 0.3,

      labelFontSize: (s) => Math.max(1.2, s * 0.1),
      labelFill: structureColor,

      getLabelText: (d) => getStructureName(d.structure) || "",
      getTitleText: (d) => getStructureName(d.structure) || "Structure",

      composeEntity: (d) => {
        const name = getStructureName(d.structure) || "Structure";

        const inhabitantIds = normalizeToArray(d.structure.inhabitant);
        const structureInhabitants = (d.site.historical_figures || []).filter(
          (hf) => inhabitantIds.includes(hf.id)
        );

        return {
          kind: "structure",
          name,
          type: d.structure.type || null,
          textureUrl: proceduralSiteTex?.("default"),
          cellCoords: { x: d.cell.x, y: d.cell.y },

          structure: d.structure,
          site: d.site,
          cell: d.cell,
          region: d.cell.region,
          undergroundRegions: d.cell.undergroundRegions || [],

          inhabitants: structureInhabitants,
          site_historical_figures: d.site.historical_figures || [],
          site_written_contents: d.site.written_contents || [],
        };
      },

      getZoomParams: (d) => {
        const bb = d._bbox;
        if (bb) {
          const cx = bb.x + bb.width / 2;
          const cy = bb.y + bb.height / 2;
          const k = getAutoZoomForBox(bb.width, bb.height);
          return { cx, cy, k };
        }

        const cx = xScale(d.cell.y) + CELL_SIZE / 2;
        const cy = yScale(d.cell.x) + CELL_SIZE / 2;
        return { cx, cy, k: ZOOM_BY_KIND.structure };
      },

      getBoundingBox: (d) => {
        return getSiteBox(d.cell, d.parentSiteIdx, d.parentSiteCount || 1);
      },

      layoutChildBox: (d, parentBox) => getChildBox(parentBox, d.idx, d.count),
    });

    // figures
    const figureMarkers = [];
    cells.forEach((cell) => {
      (cell.sites || []).forEach((site, siteIdx) => {
        const structures = normalizeToArray(site.structures);

        if (structures.length) {
          structures.forEach((structure, structIdx) => {
            const inhabitants = normalizeToArray(structure.inhabitant);

            inhabitants.forEach((hf, figIdx) => {
              figureMarkers.push({
                kind: "figure",
                cell,
                site,
                structure,
                hf,
                idx: figIdx,
                count: inhabitants.length,
                parentSiteIdx: siteIdx,
                parentSiteCount: (cell.sites || []).length,
                parentStructIdx: structIdx,
                parentStructCount: structures.length,
                parentFigureIdx: figIdx,
                parentFigureCount: inhabitants.length,
              });
            });
          });
        } else {
          const siteFigures = normalizeToArray(site.historical_figures);
          siteFigures.forEach((hf, figIdx) => {
            figureMarkers.push({
              kind: "figure",
              cell,
              site,
              structure: null,
              hf,
              idx: figIdx,
              count: siteFigures.length,
              parentSiteIdx: siteIdx,
              parentSiteCount: (cell.sites || []).length,
              parentStructIdx: null,
              parentStructCount: 0,
              parentFigureIdx: figIdx,
              parentFigureCount: siteFigures.length,
            });
          });
        }
      });
    });

    drawEntityLayer({
      markers: figureMarkers,
      rectClass: "figure-marker",
      labelClass: "figure-label",

      size: (d, parentBox) =>
        computeChildSize(
          parentBox.width,
          parentBox.height,
          d.count,
          0.9999999999
        ),

      keyFn: (d) =>
        `${d.cell.key}-hf-${d.hf.id || d.idx}-struct-${
          d.structure?.id || d.structure?.local_id || "none"
        }`,

      getFill: (d) => {
        const key =
          d.hf.id || `${d.cell.key || `${d.cell.x},${d.cell.y}`}-hf-${d.idx}`;
        const texUrl = getFigureTex(d.hf, key);
        if (!texUrl) return "#e5e7eb";

        const patternKey = `fig-${key}`;
        const pid = getOrCreatePattern(defs, patternKey, texUrl);
        return pid ? `url(#${pid})` : "#e5e7eb";
      },

      baseStroke: figureColor,
      baseStrokeWidth: 0.1,

      labelFontSize: 0.2,
      labelFill: figureColor,

      getLabelText: (d) => getFigureName(d.hf) || "",
      getTitleText: (d) => {
        const name = getFigureName(d.hf) || "Figure";
        const race = d.hf.race || "";
        return `${name}${race ? ` (${race})` : ""}`;
      },

      composeEntity: (d) => {
        const hfName = getFigureName(d.hf) || "Unknown figure";
        const figureTextureUrl = getFigureTex(d.hf);

        const siteType =
          d.site?.fromFile2?.type ||
          d.site?.fromFile1?.type ||
          d.site?.type ||
          "default";
        const siteTextureUrl = getSiteTex(siteType);
        const regionType = d.cell.region?.type || null;
        const regionTextureUrl = getRegionTex(regionType);

        return {
          kind: "figure",
          name: hfName,
          textureUrl: figureTextureUrl,
          siteTextureUrl,
          regionTextureUrl,
          cellCoords: { x: d.cell.x, y: d.cell.y },

          figure: d.hf,
          structure: d.structure,
          site: d.site,
          cell: d.cell,
          region: d.cell.region,
          undergroundRegions: d.cell.undergroundRegions || [],

          site_historical_figures: d.site.historical_figures || [],
          cell_historical_figures: d.cell.historical_figures || [],
          site_written_contents: d.site.written_contents || [],
          cell_written_contents: d.cell.written_contents || [],
        };
      },

      getZoomParams: (d) => {
        const bb = d._bbox;
        if (bb) {
          const cx = bb.x + bb.width / 2;
          const cy = bb.y + bb.height / 2;
          const k = getAutoZoomForBox(bb.width, bb.height);
          return { cx, cy, k };
        }

        const cx = xScale(d.cell.y) + CELL_SIZE / 2;
        const cy = yScale(d.cell.x) + CELL_SIZE / 2;
        return { cx, cy, k: ZOOM_BY_KIND.figure };
      },

      getBoundingBox: (d) =>
        getFigureParentBox(
          d.cell,
          d.parentSiteIdx,
          d.parentSiteCount,
          d.parentStructIdx,
          d.parentStructCount
        ),

      layoutChildBox: (d, parentBox) => getChildBox(parentBox, d.idx, d.count),
    });

    // books
    const bookMarkers = [];
    cells.forEach((cell) => {
      (cell.sites || []).forEach((site, siteIdx) => {
        const structures = normalizeToArray(site.structures);

        if (structures.length) {
          structures.forEach((structure, structIdx) => {
            const inhabitants = normalizeToArray(structure.inhabitant);

            inhabitants.forEach((inhabitant, figIdx) => {
              const books = normalizeToArray(inhabitant.books);

              inhabitant.books?.forEach((book, bookIdx) => {
                bookMarkers.push({
                  kind: "book",
                  cell,
                  site,
                  structure,
                  inhabitant,
                  book,
                  idx: bookIdx,
                  count: books.length,
                  parentSiteIdx: siteIdx,
                  parentSiteCount: (cell.sites || []).length,
                  parentStructIdx: structIdx,
                  parentStructCount: structures.length,
                  parentFigureIdx: figIdx,
                  parentFigureCount: inhabitants.length,
                });
              });
            });
          });
        } else {
          // optional: books from site-level figures if needed
        }
      });
    });

    function drawBookLayer() {
      const keyFn = (d) =>
        `${d.cell.key}-book-${d.book.id || d.book.title || d.idx}-inh-${
          d.inhabitant.id || d.parentFigureIdx
        }`;

      if (!bookMarkers.length) {
        g.selectAll("foreignObject.book-fo").remove();
        return;
      }

      const foSel = g
        .selectAll("foreignObject.book-fo")
        .data(bookMarkers, keyFn);

      const foEnter = foSel
        .enter()
        .append("foreignObject")
        .attr("class", "book-fo")
        .attr("requiredExtensions", "http://www.w3.org/1999/xhtml")
        .style("cursor", "pointer");

      foEnter
        .merge(foSel)
        .each(function (d) {
          const bookBox = getBookBox(
            d.cell,
            d.parentSiteIdx,
            d.parentSiteCount,
            d.parentStructIdx,
            d.parentStructCount,
            d.parentFigureIdx,
            d.parentFigureCount,
            d.idx,
            d.count
          );

          d._bookBox = { ...bookBox };

          d3.select(this)
            .attr("x", bookBox.x)
            .attr("y", bookBox.y)
            .attr("width", bookBox.width)
            .attr("height", bookBox.height);
        })
        .html((d) => {
          const book = d.book || {};
          const title = getBookTitle(book) || `Book ${d.idx + 1}`;
          const text_content =
            book.raw?.text_content || `book default content ${d.idx + 1}`;
          const html =
            book.html ||
            book.content_html ||
            book.text ||
            book.raw_html ||
            `<p>${title}</p><p>${text_content}</p>`;

          return `
        <div xmlns="http://www.w3.org/1999/xhtml"
             style="
               width: 100%;
               height: 100%;
               background-color: black;
               box-sizing: border-box;
               color: #e5e7eb;
               font-size: 1px;
               line-height: 1.2;
               overflow: hidden;
               text-overflow: ellipsis;
               display: -webkit-box;
               -webkit-line-clamp: 4;
               -webkit-box-orient: vertical;
             ">
             <div>
              ${html}
          </div>
        </div>
      `;
        });

      foEnter.on("click", function (event, d) {
        event.stopPropagation();
        onCellClick?.(null);

        const book = d.book || {};
        const bookTitle = getBookTitle(book) || "Book";
        const bookHtml = `<p>${bookTitle}</p><p>${book?.raw?.text_content}</p>`;

        const siteType =
          d.site?.fromFile2?.type ||
          d.site?.fromFile1?.type ||
          d.site?.type ||
          "default";
        const siteTextureUrl = getSiteTex(siteType);
        const regionType = d.cell.region?.type || null;
        const regionTextureUrl = getRegionTex(regionType);

        const composed = {
          kind: "book",
          name: bookTitle,
          html: bookHtml,
          book,
          inhabitant: d.inhabitant,
          structure: d.structure,
          site: d.site,
          cell: d.cell,
          region: d.cell.region,
          undergroundRegions: d.cell.undergroundRegions || [],

          siteTextureUrl,
          regionTextureUrl,
          cellCoords: { x: d.cell.x, y: d.cell.y },
        };

        onEntityClick?.(composed);

        const cx =
          (d._bookBox?.x || xScale(d.cell.y)) +
          (d._bookBox?.width || CELL_SIZE) / 2;
        const cy =
          (d._bookBox?.y || yScale(d.cell.x)) +
          (d._bookBox?.height || CELL_SIZE) / 2;

        const k = d._bookBox
          ? getAutoZoomForBox(d._bookBox.width, d._bookBox.height)
          : ZOOM_BY_KIND.book;

        zoomToPoint(cx, cy, k);
      });

      foSel.exit().remove();
    }

    drawBookLayer();

    // apply visibility based on current zoom
    const initialK = zoomStateRef.current?.k ?? 10;
    updateVisibility(initialK);
  }, [worldData]);

  // zoom
  useEffect(() => {
    if (!worldData || !worldData.cells?.length) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select("g");

    if (g.empty()) return;

    const zoom = d3
      .zoom()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .filter((event) => {
        if (event.type === "wheel") return true;
        if (event.type === "touchstart" || event.type === "touchmove")
          return true;
        if (event.type === "mousedown" && event.button === 0) return true;
        return false;
      })
      .on("zoom", (event) => {
        const { x, y, k } = event.transform;
        g.attr("transform", `translate(${x},${y}) scale(${k})`);

        zoomStateRef.current = { x, y, k };
        currentZoomRef.current = k;
        updateVisibility(k);
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;
    svg.on("dblclick.zoom", null);

    const initialTransform = d3.zoomIdentity.translate(0, 0).scale(10);
    svg.call(zoom.transform, initialTransform);

    zoomStateRef.current = {
      x: initialTransform.x,
      y: initialTransform.y,
      k: initialTransform.k,
    };
    currentZoomRef.current = initialTransform.k;
    updateVisibility(initialTransform.k);

    return () => {
      svg.on(".zoom", null);
    };
  }, [worldData]);

  // highlight + zoom to selected entity using NAME as the key
  useEffect(() => {
    const svgNode = svgRef.current;
    if (!svgNode) return;

    const svg = d3.select(svgNode);

    const currentTransform = d3.zoomTransform(svgNode);
    const currentK = currentTransform?.k || zoomStateRef.current?.k || 1;

    const cellRects = svg.selectAll("rect.cell");
    const siteRects = svg.selectAll("rect.site-marker");
    const structureRects = svg.selectAll("rect.structure-marker");
    const figureRects = svg.selectAll("rect.figure-marker");
    const bookFOs = svg.selectAll("foreignObject.book-fo");

    let didZoom = false;

    const zoomOnElementCenter = (el, kind) => {
      if (!el || didZoom || !selectedEntity) return;

      const x = parseFloat(el.attr("x")) || 0;
      const y = parseFloat(el.attr("y")) || 0;
      const w = parseFloat(el.attr("width")) || 0;
      const h = parseFloat(el.attr("height")) || 0;

      const cx = x + w / 2;
      const cy = y + h / 2;

      const k = getAutoZoomForBox(w || CELL_SIZE, h || CELL_SIZE);
      zoomToPoint(cx, cy, k);
      didZoom = true;
    };

    // cells (match by region/cell name)
    cellRects.each(function (d) {
      const rect = d3.select(this);

      const cellName = getCellName(d);
      const selectedCellName =
        selectedEntity?.name ||
        (selectedEntity?.cell && getCellName(selectedEntity.cell)) ||
        selectedEntity?.region?.name;

      const isSelected =
        selectedEntity &&
        selectedEntity.kind === "cell" &&
        namesEqual(selectedCellName, cellName);

      if (isSelected) {
        rect.style("stroke", "#f97316").style("stroke-width", 5 / currentK);
        zoomOnElementCenter(rect, "cell");
      } else {
        rect.style("stroke", "none").style("stroke-width", 1 / currentK);
      }
    });

    // sites (match by site name)
    siteRects.each(function (d) {
      const rect = d3.select(this);

      const siteName = getSiteName(d.site);
      const selectedSiteName =
        selectedEntity?.name ||
        (selectedEntity?.site && getSiteName(selectedEntity.site));

      const isSelected =
        selectedEntity &&
        selectedEntity.kind === "site" &&
        namesEqual(selectedSiteName, siteName);

      if (isSelected) {
        rect.style("stroke", "#f97316").style("stroke-width", 30 / currentK);
        zoomOnElementCenter(rect, "site");
      } else {
        rect.style("stroke", siteColor).style("stroke-width", 1 / currentK);
      }
    });

    // structures (match by structure name/type)
    structureRects.each(function (d) {
      const rect = d3.select(this);

      const structName = getStructureName(d.structure);
      const selectedStructName =
        selectedEntity?.name ||
        selectedEntity?.structure?.name ||
        selectedEntity?.structure?.type;

      const isSelected =
        selectedEntity &&
        selectedEntity.kind === "structure" &&
        namesEqual(selectedStructName, structName);

      if (isSelected) {
        rect.style("stroke", "#f97316").style("stroke-width", 20 / currentK);
        zoomOnElementCenter(rect, "structure");
      } else {
        rect
          .style("stroke", structureColor)
          .style("stroke-width", 1 / currentK);
      }
    });

    // figures (match by hf.name)
    figureRects.each(function (d) {
      const rect = d3.select(this);

      const figName = getFigureName(d.hf);
      const selectedFigName =
        selectedEntity?.name ||
        selectedEntity?.figure?.name ||
        selectedEntity?.figure?.id;

      const isSelected =
        selectedEntity &&
        selectedEntity.kind === "figure" &&
        namesEqual(selectedFigName, figName);

      if (isSelected) {
        rect.style("stroke", "#f97316").style("stroke-width", 10 / currentK);
        zoomOnElementCenter(rect, "figure");
      } else {
        rect.style("stroke", figureColor).style("stroke-width", 1 / currentK);
      }
    });

    // books (match by title)
    bookFOs.each(function (d) {
      const fo = d3.select(this);

      const bookTitle = getBookTitle(d.book);
      const selectedBookTitle =
        selectedEntity?.name || selectedEntity?.book?.title;

      const isSelected =
        selectedEntity &&
        selectedEntity.kind === "book" &&
        namesEqual(selectedBookTitle, bookTitle);

      if (isSelected) {
        fo.style("filter", "drop-shadow(1 1 1px var(--primary-color))");
        zoomOnElementCenter(fo, "book");
      } else {
        fo.style("filter", null);
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

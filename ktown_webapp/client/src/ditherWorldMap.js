// src/WorldMap.jsx
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import {
  REGION_TEXTURES,
  SITE_TEXTURES,
  FIGURE_TEXTURES,
  STRUCTURE_TEXTURES,
  DEFAULT_TEXTURE,
} from "./regionTextures";

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

  const zoomStateRef = useRef({ x: 0, y: 0, k: 10 }); // <-- NEW

  const regionTypesRef = useRef([]);
  const siteTypesRef = useRef([]);
  const figureKindsRef = useRef(["default"]);

  const sanitizeKey = (val) => String(val || "Unknown").replace(/\s+/g, "");

  // helper: accept single object or array and always return array
  const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  // ----- name helpers -----
  const getCellName = (cell) => `(${cell?.x}, ${cell?.y})`;

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

  const getRegionTex = (type) =>
    (type && REGION_TEXTURES[type]) || DEFAULT_TEXTURE;

  const getSiteTex = (type) => {
    if (!type) return SITE_TEXTURES.default || DEFAULT_TEXTURE;
    const key = String(type).toLowerCase();
    return SITE_TEXTURES[key] || SITE_TEXTURES.default || DEFAULT_TEXTURE;
  };

  const getFigureTex = (hf) => FIGURE_TEXTURES.default || DEFAULT_TEXTURE;

  const getPatternId = (kind, key) => `pattern-${kind}-${sanitizeKey(key)}`;

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

  const createOrUpdatePatterns = (defsSelection, k = 1) => {
    if (!defsSelection || defsSelection.empty()) return;

    defsSelection.selectAll("pattern").remove();

    const baseSize = CELL_SIZE;
    const patternSize = baseSize / k;

    // regions
    regionTypesRef.current.forEach((type) => {
      const texUrl = getRegionTex(type);
      if (!texUrl) return;
      const pid = getPatternId("region", type);

      const pattern = defsSelection
        .append("pattern")
        .attr("id", pid)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", patternSize)
        .attr("height", patternSize);

      pattern
        .append("image")
        .attr("href", texUrl)
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", patternSize)
        .attr("height", patternSize)
        .attr("preserveAspectRatio", "xMidYMid slice");
    });

    // sites
    const sitePatternSize = CELL_SIZE;

    siteTypesRef.current.forEach((type) => {
      const texUrl = getSiteTex(type);
      if (!texUrl) return;
      const pid = getPatternId("site", type);

      const pattern = defsSelection
        .append("pattern")
        .attr("id", pid)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", sitePatternSize)
        .attr("height", sitePatternSize);

      pattern
        .append("image")
        .attr("href", texUrl)
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", sitePatternSize)
        .attr("height", sitePatternSize)
        .attr("preserveAspectRatio", "xMidYMid slice");
    });

    // figures
    const figPatternSize = CELL_SIZE * 2;

    figureKindsRef.current.forEach((kind) => {
      const texUrl =
        kind === "default" ? FIGURE_TEXTURES.default || DEFAULT_TEXTURE : null;
      if (!texUrl) return;
      const pid = getPatternId("fig", kind);

      const pattern = defsSelection
        .append("pattern")
        .attr("id", pid)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", figPatternSize)
        .attr("height", figPatternSize);

      pattern
        .append("image")
        .attr("href", texUrl)
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", figPatternSize)
        .attr("height", figPatternSize)
        .attr("preserveAspectRatio", "xMidYMid slice");
    });
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

  // 1) build map & markers
  useEffect(() => {
    if (!worldData || !worldData.cells?.length) return;

    // apply cap
    const allCells = worldData.cells;
    const cells =
      MAX_RENDERED_CELLS && allCells.length > MAX_RENDERED_CELLS
        ? allCells.slice(0, MAX_RENDERED_CELLS)
        : allCells;

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

        // prefer this entity's bbox (site, structure, figure, etc.)
        const entityBox = d._bbox || resolveParentBox(d);

        const s = d._renderSize || resolveSize(d, entityBox);
        const rawText = getLabelText ? getLabelText(d) : "";

        const padding = entityBox.width * 0.01; // in map units (1% of width)
        const maxWidth = Math.max(1, entityBox.width - padding * 2);
        const maxHeight = Math.max(1, entityBox.height - padding * 2);

        // --- 1) base font size from existing logic ---
        const baseFs = resolveFontSize(s, d, entityBox);

        // --- 2) adjust based on text length ---
        const len = rawText ? rawText.length : 0;
        const MIN_FS = 0.8;
        const MAX_FS = 8; // safety cap

        // simple length-based scaling: longer text => smaller font
        let candidateFs = baseFs;
        if (len > 0) {
          const refLen = 12; // length that "fits" at full baseFs
          const factor = Math.min(1, refLen / len); // shrink if length > refLen
          candidateFs = baseFs * factor;
        }

        // also ensure it isn't taller than the box height
        candidateFs = Math.min(candidateFs, maxHeight / 1.1);
        candidateFs = Math.max(MIN_FS, Math.min(MAX_FS, candidateFs));

        // --- 3) iterative shrink if we still truncate ---
        let fs = candidateFs;
        let wrapped = wrapLabelLines(rawText, maxWidth, fs, maxHeight);

        // try a few times to make it fit
        let attempts = 0;
        const MAX_ATTEMPTS = 5;

        while (wrapped.truncated && fs > MIN_FS && attempts < MAX_ATTEMPTS) {
          fs *= 0.8; // shrink a bit
          if (fs < MIN_FS) {
            fs = MIN_FS;
          }
          wrapped = wrapLabelLines(rawText, maxWidth, fs, maxHeight);
          attempts += 1;
        }

        const lines = wrapped.lines;

        const baseX = entityBox.x + padding;
        const baseY = entityBox.y + fs + padding; // baseline of first line

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

    // --- NEW LAYOUT HELPERS: children fill parent with 1% margin ---

    const getCellBox = (cell) => ({
      x: xScale(cell.y),
      y: yScale(cell.x),
      width: CELL_SIZE,
      height: CELL_SIZE,
    });

    // generic: 1% margin, then either a single child or
    // horizontal/vertical strips depending on aspect ratio
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

      // only one child: it just becomes an inset version of the parent
      if (count === 1) {
        return {
          x: innerX,
          y: innerY,
          width: innerW,
          height: innerH,
        };
      }

      // more children: pick orientation by aspect ratio
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

    createOrUpdatePatterns(defs, 1);

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
      const texUrl = getRegionTex(d.region?.type);
      const rect = d3.select(this);

      const pid = getPatternId("region", d.region?.type);
      rect.style("fill", `url(#${pid})`);
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

    cellsEnter.on("click", (_, d) => {
      onCellClick?.(d);
      onCellClick?.(null);

      console.log("clicks celle", d);

      const regionType = d.region?.type || null;
      const regionTextureUrl = getRegionTex(regionType);

      const composed = {
        kind: "cell",
        name: getCellName(d),
        type: regionType,
        textureUrl: regionTextureUrl,
        cellCoords: { x: d.x, y: d.y },

        cell: d,
        region: d.region,

        historical_figures: d.historical_figures || [],
      };

      onEntityClick?.(composed);

      const svg = d3.select(svgRef.current);
      const g = svg.select("g");
      if (!g.empty()) {
        const cx = xScale(d.y) + CELL_SIZE / 2;
        const cy = yScale(d.x) + CELL_SIZE / 2;
        zoomToPoint(cx, cy, 20);
      }
    });
    cellsSelection.exit().remove();

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

      // size still used for label font heuristics
      size: (d, parentBox) =>
        computeChildSize(parentBox.width, parentBox.height, d.count, 0.85),

      keyFn: (d) => `${d.cell.key}-site-${d.site.id || d.idx}`,

      getFill: (d) => {
        const type =
          d.site?.fromFile2?.type ||
          d.site?.fromFile1?.type ||
          d.site?.type ||
          "default";
        const texUrl = getSiteTex(type);
        if (texUrl) {
          const pid = getPatternId("site", type);
          return `url(#${pid})`;
        }
        return "#9ca3af";
      },

      baseStroke: siteColor,
      baseStrokeWidth: 0.1,

      // font size depends on rendered rect size
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

      // NEW: sites fill their cell, sliced into strips
      layoutChildBox: (d, parentBox) => getChildBox(parentBox, d.idx, d.count),
    });

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

      // size mostly for label heuristics now
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
          textureUrl: SITE_TEXTURES.default || DEFAULT_TEXTURE,
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

        // fallback to cell center
        const cx = xScale(d.cell.y) + CELL_SIZE / 2;
        const cy = yScale(d.cell.x) + CELL_SIZE / 2;
        return { cx, cy, k: ZOOM_BY_KIND.structure };
      },

      // parent bbox = site box (inside cell)
      getBoundingBox: (d) => {
        return getSiteBox(d.cell, d.parentSiteIdx, d.parentSiteCount || 1);
      },

      // NEW: structures fill their site as strips
      layoutChildBox: (d, parentBox) => getChildBox(parentBox, d.idx, d.count),
    });

    // --- FIGURES: nested in structure.inhabitants (or in site if no structures) ---

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
          // fallback: figures directly in site if no structures
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

      // size only to seed label font sizing
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
        const texUrl = getFigureTex(d.hf);
        if (texUrl) {
          const pid = getPatternId("fig", "default");
          return `url(#${pid})`;
        }
        return "#e5e7eb";
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

        // hard fallback
        const cx = xScale(d.cell.y) + CELL_SIZE / 2;
        const cy = yScale(d.cell.x) + CELL_SIZE / 2;
        return { cx, cy, k: ZOOM_BY_KIND.figure };
      },

      // parent bbox = structure or site
      getBoundingBox: (d) =>
        getFigureParentBox(
          d.cell,
          d.parentSiteIdx,
          d.parentSiteCount,
          d.parentStructIdx,
          d.parentStructCount
        ),

      // NEW: figures fill their parent as strips
      layoutChildBox: (d, parentBox) => getChildBox(parentBox, d.idx, d.count),
    });

    // --- BOOKS: nested inside inhabitant.books, parent = figure box ---

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
                  count: books.length, // siblings per figure
                  parentSiteIdx: siteIdx,
                  parentSiteCount: (cell.sites || []).length,
                  parentStructIdx: structIdx,
                  parentStructCount: structures.length,
                  parentFigureIdx: figIdx,
                  parentFigureCount: inhabitants.length,
                });
                console.log("PLACES BOOK", inhabitant.books);
              });
            });
          });
        } else {
          // optional: books from site-level figures if you ever need it
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

          // small styled HTML card with links preserved
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

      // click handler: foreignObject itself
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

    // finally call it:
    drawBookLayer();
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
        if (event.type === "wheel") return true;
        if (event.type === "touchstart" || event.type === "touchmove")
          return true;
        if (event.type === "mousedown" && event.button === 0) return true;
        return false;
      })
      .on("zoom", (event) => {
        const { x, y, k } = event.transform;
        g.attr("transform", `translate(${x},${y}) scale(${k})`);
        createOrUpdatePatterns(defs, k);

        // NEW: keep zoom state in a ref
        zoomStateRef.current = { x, y, k };
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;
    svg.on("dblclick.zoom", null);

    const initialTransform = d3.zoomIdentity.translate(0, 0).scale(10);
    svg.call(zoom.transform, initialTransform);

    // NEW: initialize zoomStateRef with the starting transform
    zoomStateRef.current = {
      x: initialTransform.x,
      y: initialTransform.y,
      k: initialTransform.k,
    };

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

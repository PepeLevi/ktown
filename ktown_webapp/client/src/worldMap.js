// src/WorldMap.jsx
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import {
  REGION_TEXTURES,
  SITE_TEXTURES,
  FIGURE_TEXTURES,
  DEFAULT_TEXTURE,
} from "./regionTextures";

const regionColor = "yellow";
const siteColor = "var(--primary-color)";
const structureColor = "var(--primary-color)";
const figureColor = "var(--primary-color)";
const bookColor = "var(--primary-color)";

const CELL_SIZE = 30;
const CELL_GAP = 0;

// zoom limits
const MIN_ZOOM = 1;
const MAX_ZOOM = 500;

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

  const zoomBehaviorRef = useRef(null); // 🆕 store d3.zoom()
  const mapWidthRef = useRef(0); // 🆕 store map width
  const mapHeightRef = useRef(0); // 🆕 store map height

  const regionTypesRef = useRef([]);
  const siteTypesRef = useRef([]);
  const figureKindsRef = useRef(["default"]);

  const sanitizeKey = (val) => String(val || "Unknown").replace(/\s+/g, "");

  // helper: accept single object or array and always return array
  const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

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
    const figPatternSize = (CELL_SIZE * 0.6) / k;

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

  // 1) build map & markers
  useEffect(() => {
    if (!worldData || !worldData.cells?.length) return;

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

      // --- rects ---
      const rectSel = g.selectAll(`rect.${rectClass}`).data(markers, keyFn);

      const rectEnter = rectSel
        .enter()
        .append("rect")
        .attr("class", rectClass)
        .style("cursor", "pointer");

      rectEnter
        .merge(rectSel)
        .attr("x", (d) => {
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
        .attr("width", (d) => d._renderSize || CELL_SIZE * 0.3)
        .attr("height", (d) => d._renderSize || CELL_SIZE * 0.3)
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

      // tooltips
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

      labelEnter
        .merge(labelSel)
        .attr("x", (d) => {
          const bb = d._bbox || {
            x: xScale(d.cell.y),
            y: yScale(d.cell.x),
          };
          return bb.x;
        })
        .attr("y", (d) => {
          const bb = d._bbox || {
            x: xScale(d.cell.y),
            y: yScale(d.cell.x),
          };
          return bb.y;
        })
        .style("font-size", (d) => {
          const parentBox = resolveParentBox(d);
          const s = d._renderSize || resolveSize(d, parentBox);
          const fs = resolveFontSize(s, d, parentBox);
          return `${fs}px`;
        })
        .style("fill", labelFill ?? "#fff")
        .text((d) => (getLabelText ? getLabelText(d) : ""));

      // --- shared click handler (rect + label) ---
      const handleClick = (event, d) => {
        event.stopPropagation();
        onCellClick?.(null);

        if (composeEntity) {
          const composed = composeEntity(d);
          if (composed) onEntityClick?.(composed);
        }

        if (getZoomParams) {
          const { cx, cy, k } = getZoomParams(d) || {};
          if (cx != null && cy != null) {
            zoomToPoint(cx, cy, k);
          }
        }
      };

      rectEnter.on("click", handleClick);
      labelEnter.on("click", handleClick);

      rectSel.exit().remove();
      labelSel.exit().remove();
    }

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

    const getSiteBox = (cell, siteIdx, siteCount) => {
      const baseX = xScale(cell.y);
      const baseY = yScale(cell.x);

      const siteSize = computeChildSize(
        CELL_SIZE,
        CELL_SIZE,
        siteCount || 1,
        0.85
      );
      const pos = calculateGridPositions(
        siteIdx,
        siteCount || 1,
        siteSize,
        CELL_SIZE,
        CELL_SIZE
      );

      return {
        x: baseX + pos.x,
        y: baseY + pos.y,
        width: siteSize,
        height: siteSize,
      };
    };

    const getStructureBox = (
      cell,
      siteIdx,
      siteCount,
      structIdx,
      structCount
    ) => {
      const siteBox = getSiteBox(cell, siteIdx, siteCount);
      const structSize = computeChildSize(
        siteBox.width,
        siteBox.height,
        structCount || 1,
        0.8
      );
      const pos = calculateGridPositions(
        structIdx,
        structCount || 1,
        structSize,
        siteBox.width,
        siteBox.height
      );

      return {
        x: siteBox.x + pos.x,
        y: siteBox.y + pos.y,
        width: structSize,
        height: structSize,
      };
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
      // if no structure, figures live directly in the site box
      if (structIdx == null || structCount === 0) {
        const siteBox = getSiteBox(cell, siteIdx, siteCount);
        const figSize = computeChildSize(
          siteBox.width,
          siteBox.height,
          figCount || 1,
          0.8
        );
        const pos = calculateGridPositions(
          figIdx,
          figCount || 1,
          figSize,
          siteBox.width,
          siteBox.height
        );

        return {
          x: siteBox.x + pos.x,
          y: siteBox.y + pos.y,
          width: figSize,
          height: figSize,
        };
      }

      const structBox = getStructureBox(
        cell,
        siteIdx,
        siteCount,
        structIdx,
        structCount
      );
      const figSize = computeChildSize(
        structBox.width,
        structBox.height,
        figCount || 1,
        0.8
      );
      const pos = calculateGridPositions(
        figIdx,
        figCount || 1,
        figSize,
        structBox.width,
        structBox.height
      );

      return {
        x: structBox.x + pos.x,
        y: structBox.y + pos.y,
        width: figSize,
        height: figSize,
      };
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

      if (texUrl) {
        const pid = getPatternId("region", d.region?.type);
        rect.style("fill", `url(#${pid})`);
      } else {
        rect.style("fill", "#1f2933");
      }
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
        name: d.region?.name,
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
        // xScale/yScale are in scope in this effect
        const cx = xScale(d.y) + CELL_SIZE / 2;
        const cy = yScale(d.x) + CELL_SIZE / 2;
        zoomToPoint(cx, cy, 20); //
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

      // size based on CELL_SIZE & sites-in-cell
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

      getLabelText: (d) =>
        d.site?.fromFile2?.name ||
        d.site?.fromFile1?.name ||
        d.site?.name ||
        "",

      getTitleText: (d) => {
        const name =
          d.site?.fromFile2?.name ||
          d.site?.fromFile1?.name ||
          d.site?.name ||
          "Site";
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

        const siteName =
          d.site?.fromFile2?.name ||
          d.site?.fromFile1?.name ||
          d.site?.name ||
          "Unknown site";

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

      // parent box defaults to whole cell, so no getBoundingBox here
    });

    const structureMarkers = [];
    cells.forEach((cell) => {
      (cell.sites || []).forEach((site, siteIdx) => {
        const raw = site.structures?.structure;
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

      // size based on the *site* bbox and structures-in-site
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

      getLabelText: (d) => d.structure.name || d.structure.type || "",
      getTitleText: (d) => d.structure.name || d.structure.type || "Structure",

      composeEntity: (d) => {
        const name = d.structure.name || d.structure.type || "Structure";

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
        const cx = xScale(d.cell.y) + CELL_SIZE / 2;
        const cy = yScale(d.cell.x) + CELL_SIZE / 2;
        return { cx, cy, k: 50 };
      },

      // parent bbox = site bbox (inside cell)
      getBoundingBox: (d) => {
        const baseX = xScale(d.cell.y);
        const baseY = yScale(d.cell.x);

        const siteIdx = d.parentSiteIdx;
        const siteCount = d.parentSiteCount || 1;

        const siteSize = computeChildSize(
          CELL_SIZE,
          CELL_SIZE,
          siteCount,
          0.85
        );
        const sitePos = calculateGridPositions(
          siteIdx,
          siteCount,
          siteSize,
          CELL_SIZE,
          CELL_SIZE
        );

        return {
          x: baseX + sitePos.x,
          y: baseY + sitePos.y,
          width: siteSize,
          height: siteSize,
        };
      },
    });

    // figures

    // --- FIGURES: use structure rect as parent bbox ---
    // --- FIGURES: nested in structure.inhabitants (or in site if no structures) ---

    const figureMarkers = [];
    cells.forEach((cell) => {
      (cell.sites || []).forEach((site, siteIdx) => {
        const structures = normalizeToArray(site.structures?.structure);

        if (structures.length) {
          structures.forEach((structure, structIdx) => {
            const inhabitants = normalizeToArray(structure.inhabitants);

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

      // size based on the *structure* or *site* bbox and figures-in-parent
      size: (d, parentBox) =>
        computeChildSize(parentBox.width, parentBox.height, d.count, 0.8),

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

      getLabelText: (d) => d.hf.name || "",
      getTitleText: (d) => {
        const name = d.hf.name || d.hf.id || "Figure";
        const race = d.hf.race || "";
        return `${name}${race ? ` (${race})` : ""}`;
      },

      composeEntity: (d) => {
        const hfName = d.hf.name || d.hf.id || "Unknown figure";
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
        const cx = xScale(d.cell.y) + CELL_SIZE / 2;
        const cy = yScale(d.cell.x) + CELL_SIZE / 2;
        return { cx, cy, k: 80 };
      },

      // parent bbox = figure's parent (structure or site)
      getBoundingBox: (d) =>
        getFigureBox(
          d.cell,
          d.parentSiteIdx,
          d.parentSiteCount,
          d.parentStructIdx,
          d.parentStructCount,
          d.parentFigureIdx,
          d.parentFigureCount
        ),
    });

    // --- BOOKS: nested inside inhabitant.books, parent = figure box ---

    const bookMarkers = [];
    cells.forEach((cell) => {
      (cell.sites || []).forEach((site, siteIdx) => {
        const structures = normalizeToArray(site.structures?.structure);

        if (structures.length) {
          structures.forEach((structure, structIdx) => {
            const inhabitants = normalizeToArray(structure.inhabitants);

            inhabitants.forEach((inhabitant, figIdx) => {
              const books = normalizeToArray(inhabitant.books);
              books.forEach((book, bookIdx) => {
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
          // parent = figure box
          const figBox = getFigureBox(
            d.cell,
            d.parentSiteIdx,
            d.parentSiteCount,
            d.parentStructIdx,
            d.parentStructCount,
            d.parentFigureIdx,
            d.parentFigureCount
          );

          // size of each book inside the figure
          const bookSize = computeChildSize(
            figBox.width,
            figBox.height,
            d.count,
            0.4
          );
          const pos = calculateGridPositions(
            d.idx,
            d.count,
            bookSize,
            figBox.width,
            figBox.height
          );

          const x = figBox.x + pos.x;
          const y = figBox.y + pos.y;

          d._bookBox = {
            x,
            y,
            width: bookSize,
            height: bookSize,
          };

          d3.select(this)
            .attr("x", x)
            .attr("y", y)
            .attr("width", bookSize)
            .attr("height", bookSize);
        })
        .html((d) => {
          const book = d.book || {};
          const title = book.title || `Book ${d.idx + 1}`;
          const text_content =
            book.raw.text_content || `book default content ${d.idx + 1}`;
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
               box-sizing: border-box;
       
              //  background: rgba(15,23,42,0.9);
              //  border: 0.5px solid ${bookColor};
               color: #e5e7eb;
               font-size: 1px;
               line-height: 1.2;
               overflow: hidden;
               overflow-y:
               text-overflow: ellipsis;
               display: -webkit-box;

               -webkit-line-clamp: 4;
               -webkit-box-orient: vertical;
             ">
          ${html}
        </div>
      `;
        });

      // click handler: foreignObject itself
      foEnter.on("click", function (event, d) {
        event.stopPropagation();
        onCellClick?.(null);

        const book = d.book || {};
        const bookTitle = book.title || "Book";
        const bookHtml =
          book.html ||
          book.content_html ||
          book.text ||
          book.raw_html ||
          `<p>${bookTitle}</p>`;

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

        const cx = xScale(d.cell.y) + CELL_SIZE / 2;
        const cy = yScale(d.cell.x) + CELL_SIZE / 2;
        zoomToPoint(cx, cy, 120);
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
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;
    svg.on("dblclick.zoom", null);

    const initialTransform = d3.zoomIdentity.translate(0, 0).scale(1);
    svg.call(zoom.transform, initialTransform);

    return () => {
      svg.on(".zoom", null);
    };
  }, [worldData]);

  // highlight selected entity (site / figure)
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    const celleRects = svg.selectAll("rect.cell");
    const siteRects = svg.selectAll("rect.site-marker");
    const structureRects = svg.selectAll("rect.structure-marker");
    const figureRects = svg.selectAll("rect.figure-marker");

    celleRects.each(function (d) {
      const rect = d3.select(this);

      const isSelected =
        selectedEntity &&
        selectedEntity.kind === "cell" &&
        selectedEntity.cell.region.id === d.region.id;

      if (isSelected) {
        rect.style("stroke", "#f97316").style("stroke-width", 5);
      } else {
        rect.style("stroke", celleRects).style("stroke-width", 0);
      }
    });
    // sites
    siteRects.each(function (d) {
      const rect = d3.select(this);
      const isSelected =
        selectedEntity &&
        selectedEntity.kind === "site" &&
        selectedEntity.site &&
        d.site &&
        selectedEntity.site.id === d.site.id;

      if (isSelected) {
        rect.style("stroke", "#f97316").style("stroke-width", 0.7);
      } else {
        rect.style("stroke", siteRects).style("stroke-width", 0.1);
      }
    });

    structureRects.each(function (d) {
      const rect = d3.select(this);
      const isSelected =
        selectedEntity &&
        selectedEntity.kind === "structure" &&
        selectedEntity.structure &&
        d.structure &&
        ((selectedEntity.structure.id &&
          selectedEntity.structure.id === d.structure.id) ||
          (selectedEntity.structure.local_id &&
            selectedEntity.structure.local_id === d.structure.local_id));

      if (isSelected) {
        rect.style("stroke", "#f97316").style("stroke-width", 0.7);
      } else {
        rect.style("stroke", structureColor).style("stroke-width", 0.1);
      }
    });

    // figures
    figureRects.each(function (d) {
      const rect = d3.select(this);
      const isSelected =
        selectedEntity &&
        selectedEntity.kind === "figure" &&
        selectedEntity.figure &&
        d.hf &&
        selectedEntity.figure.id === d.hf.id;

      if (isSelected) {
        rect.style("stroke", "#f97316").style("stroke-width", 0.7);
      } else {
        rect.style("stroke", figureColor).style("stroke-width", 0);
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

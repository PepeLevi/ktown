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
const siteColor = "blue";
const structureColor = "green";
const figureColor = "pink";
const bookColor = "white";

const CELL_SIZE = 30;
const CELL_GAP = 0;

// zoom limits
const MIN_ZOOM = 1;
const MAX_ZOOM = 160;

const zoomSpeed = 4;

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

    function drawEntityLayer({
      markers,
      rectClass,
      labelClass,
      size,
      keyFn,
      getFill, // (d) => fill string
      baseStroke,
      baseStrokeWidth,
      labelFontSize,
      labelFill,
      getLabelText, // (d) => string
      getTitleText, // (d) => string
      composeEntity, // (d) => composed object for onEntityClick
      getZoomParams, // (d) => { cx, cy, k }
    }) {
      if (!markers || !markers.length) {
        // Clean old layer if markers now empty
        g.selectAll(`rect.${rectClass}`).remove();
        g.selectAll(`text.${labelClass}`).remove();
        return;
      }

      // --- rects ---
      const rectSel = g.selectAll(`rect.${rectClass}`).data(markers, keyFn);

      const rectEnter = rectSel
        .enter()
        .append("rect")
        .attr("class", rectClass)
        .attr("width", size)
        .attr("height", size)
        .style("cursor", "pointer");

      rectEnter
        .merge(rectSel)
        .attr("x", (d) => {
          const baseX = xScale(d.cell.y);
          const { x } = calculateGridPositions(
            d.idx,
            d.count,
            size,
            CELL_SIZE,
            CELL_SIZE
          );
          return baseX + x;
        })
        .attr("y", (d) => {
          const baseY = yScale(d.cell.x);
          const { y } = calculateGridPositions(
            d.idx,
            d.count,
            size,
            CELL_SIZE,
            CELL_SIZE
          );
          return baseY + y;
        })
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
          const baseX = xScale(d.cell.y);
          const { x } = calculateGridPositions(
            d.idx,
            d.count,
            size,
            CELL_SIZE,
            CELL_SIZE
          );
          return baseX + x;
        })
        .attr("y", (d) => {
          const baseY = yScale(d.cell.x);
          const { y } = calculateGridPositions(
            d.idx,
            d.count,
            size,
            CELL_SIZE,
            CELL_SIZE
          );
          return baseY + y; // a bit down from top-left
        })
        .style("font-size", `${labelFontSize}px`)
        .style("fill", labelFill ?? "#fff")
        .text((d) => (getLabelText ? getLabelText(d) : ""));

      // --- shared click handler for rect + label ---
      const handleClick = (event, d) => {
        event.stopPropagation();
        onCellClick?.(null);

        if (composeEntity) {
          const composed = composeEntity(d);
          if (composed) onEntityClick?.(composed);
        }

        if (getZoomParams) {
          const { cx, cy, k } = getZoomParams(d);
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
        zoomToPoint(cx, cy, zoomSpeed); //
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

    const siteSize = CELL_SIZE * 0.4;

    drawEntityLayer({
      markers: siteMarkers,
      rectClass: "site-marker",
      labelClass: "site-label",
      size: siteSize,
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
      baseStroke: "yellow",
      baseStrokeWidth: 0.1,
      labelFontSize: 0.1,
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
    });

    const structureMarkers = [];
    cells.forEach((cell) => {
      (cell.sites || []).forEach((site) => {
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
          });
        });
      });
    });

    const structureSize = siteSize * 0.3;

    drawEntityLayer({
      markers: structureMarkers,
      rectClass: "structure-marker",
      labelClass: "structure-label",
      size: structureSize,
      keyFn: (d) =>
        `${d.cell.key}-site-${d.site.id}-structure-${
          d.structure.id || d.structure.local_id || d.idx
        }`,
      getFill: () => "#6b7280",
      baseStroke: "#fbbf24",
      baseStrokeWidth: 0.2,
      labelFontSize: 0.1,
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
    });

    // figures
    // --- FIGURES as a generic layer ---
    const figureMarkers = [];
    cells.forEach((cell) => {
      (cell.sites || []).forEach((site) => {
        const figures = site.historical_figures || [];
        figures.forEach((hf, idx) => {
          figureMarkers.push({
            kind: "figure",
            cell,
            site,
            hf,
            idx,
            count: figures.length,
          });
        });
      });
    });

    const figSize = structureSize * 0.4;

    drawEntityLayer({
      markers: figureMarkers,
      rectClass: "figure-marker",
      labelClass: "figure-label",
      size: figSize,
      keyFn: (d) => `${d.cell.key}-hf-${d.hf.id || d.idx}`,
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
      labelFontSize: 0.1,
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
        const cx = xScale(d.cell.y) + CELL_SIZE / 2 + figSize / 2;
        const cy = yScale(d.cell.x) + CELL_SIZE / 2 + figSize / 2;
        return { cx, cy, k: 60 };
      },
    });
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

  // highlight selected cell
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const rects = svg.selectAll("rect.cell");

    rects.each(function (d) {
      const rect = d3.select(this);
      if (selectedCell && selectedCell.key === d.key) {
        rect.style("stroke", "#f97316").style("stroke-width", 0.5);
      } else {
        rect.style("stroke", "#020617").style("stroke-width", 0);
      }
    });
  }, [selectedCell]);

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
        rect.style("stroke", "yellow").style("stroke-width", 0);
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
        rect.style("stroke", "yellow").style("stroke-width", 0.1);
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
        rect.style("stroke", "#fbbf24").style("stroke-width", 0.3);
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
        rect.style("stroke", "blue").style("stroke-width", 0.1);
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

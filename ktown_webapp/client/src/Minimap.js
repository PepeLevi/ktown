// Minimap component - shows simplified view of entire map with viewport indicator
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const MINIMAP_SIZE = 200; // Size of minimap in pixels (square)
const MINIMAP_CELL_SIZE = 2; // Size of each cell in minimap (much smaller)

const Minimap = ({
  worldData,
  mainTransform,
  mainViewBox,
  xScale,
  yScale,
  onMinimapClick,
}) => {
  const minimapRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    if (!worldData || !worldData.cells || !xScale || !yScale) return;

    const svg = d3.select(minimapRef.current);
    if (svg.empty()) return;

    // Clear previous content
    svg.selectAll("*").remove();

    // Get all cells (filter ocean)
    const cells = worldData.cells.filter(
      (c) => c && c.region?.type !== "Ocean"
    );
    if (cells.length === 0) return;

    // Calculate map bounds
    const minX = d3.min(cells, (d) => xScale(d.y)) ?? 0;
    const maxX = d3.max(cells, (d) => xScale(d.y + 1)) ?? 0;
    const minY = d3.min(cells, (d) => yScale(d.x)) ?? 0;
    const maxY = d3.max(cells, (d) => yScale(d.x + 1)) ?? 0;

    const mapWidth = maxX - minX;
    const mapHeight = maxY - minY;
    const mapAspect = mapWidth / mapHeight;

    // Scale to fit in minimap
    let scale, offsetX, offsetY;
    if (mapAspect > 1) {
      // Wider than tall
      scale = MINIMAP_SIZE / mapWidth;
      offsetX = 0;
      offsetY = (MINIMAP_SIZE - mapHeight * scale) / 2;
    } else {
      // Taller than wide
      scale = MINIMAP_SIZE / mapHeight;
      offsetX = (MINIMAP_SIZE - mapWidth * scale) / 2;
      offsetY = 0;
    }

    // Create minimap group
    const g = svg
      .append("g")
      .attr("transform", `translate(${offsetX}, ${offsetY}) scale(${scale})`);

    // Render simplified cells (just colors, no textures)
    cells.forEach((cell) => {
      if (!cell.region?.type || cell.region?.type === "Ocean") return;

      const x = xScale(cell.y) - minX;
      const y = yScale(cell.x) - minY;

      // Simple color based on region type
      const regionColors = {
        Grassland: "orange",
        Wetland: "#c8dc9f",
        Desert: "#faf0b4",
        Forest: "grey",
        Mountains: "lightgray",
        Hills: "#d2dc9f",
        Tundra: "#dce6c3",
        Lake: "#d2e6be",
      };

      const color = regionColors[cell.region?.type] || " var(--label-color)";

      g.append("rect")
        .attr("x", x)
        .attr("y", y)
        .attr("width", MINIMAP_CELL_SIZE / scale)
        .attr("height", MINIMAP_CELL_SIZE / scale)
        .attr("fill", color)
        .attr("stroke", "none");
    });

    // Store scale and offset for viewport indicator
    svgRef.current = { scale, offsetX, offsetY, minX, minY };

    // Update viewport indicator
    updateViewportIndicator(
      svg,
      mainTransform,
      mainViewBox,
      scale,
      offsetX,
      offsetY,
      minX,
      minY
    );
  }, [worldData, xScale, yScale]);

  // Update viewport indicator when main transform changes
  useEffect(() => {
    if (!svgRef.current || !mainTransform || !mainViewBox) return;

    const svg = d3.select(minimapRef.current);
    const { scale, offsetX, offsetY, minX, minY } = svgRef.current;

    updateViewportIndicator(
      svg,
      mainTransform,
      mainViewBox,
      scale,
      offsetX,
      offsetY,
      minX,
      minY
    );
  }, [mainTransform, mainViewBox]);

  const updateViewportIndicator = (
    svg,
    transform,
    viewBox,
    scale,
    offsetX,
    offsetY,
    minX,
    minY
  ) => {
    if (!transform || !viewBox) return;

    const { x, y, k } = transform;
    const viewportWidth = viewBox.width;
    const viewportHeight = viewBox.height;

    // Calculate viewport bounds in world coordinates
    const worldLeft = -x / k;
    const worldTop = -y / k;
    const worldRight = worldLeft + viewportWidth / k;
    const worldBottom = worldTop + viewportHeight / k;

    // Transform to minimap coordinates
    const minimapLeft = (worldLeft - minX) * scale + offsetX;
    const minimapTop = (worldTop - minY) * scale + offsetY;
    const minimapWidth = (worldRight - worldLeft) * scale;
    const minimapHeight = (worldBottom - worldTop) * scale;

    // Remove old indicator
    svg.select(".viewport-indicator").remove();

    // Draw viewport indicator (white rectangle with border)
    svg
      .append("rect")
      .attr("class", "viewport-indicator")
      .attr("x", minimapLeft)
      .attr("y", minimapTop)
      .attr("width", minimapWidth)
      .attr("height", minimapHeight)
      .attr("fill", "rgba(255, 255, 255, 0.2)")
      .attr("stroke", "var(--label-color)")
      .attr("stroke-width", 2)
      .style("pointer-events", "none");
  };

  const handleMinimapClick = (event) => {
    if (!svgRef.current || !onMinimapClick) return;

    const rect = minimapRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const { scale, offsetX, offsetY, minX, minY } = svgRef.current;

    // Convert minimap coordinates to world coordinates
    const worldX = (x - offsetX) / scale + minX;
    const worldY = (y - offsetY) / scale + minY;

    onMinimapClick(worldX, worldY);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        width: `${MINIMAP_SIZE}px`,
        height: `${MINIMAP_SIZE}px`,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        border: "1px solid var(--label-color)",
        borderRadius: "4px",
        cursor: "pointer",
        zIndex: 1000,
      }}
      onClick={handleMinimapClick}
    >
      <svg
        ref={minimapRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        style={{ display: "block" }}
      />
    </div>
  );
};

export default Minimap;

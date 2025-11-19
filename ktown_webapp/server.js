const express = require("express");
const path = require("path");
const fs = require("fs"); //
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Serve public directory (for file1.json/file2.json etc.)
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

//check if the json files are in Public Directory
app.get("/api/default-files", (req, res) => {
  const file1Path = path.join(PUBLIC_DIR, "map_plus.json");
  const file2Path = path.join(PUBLIC_DIR, "map.json");

  const hasFile1 = fs.existsSync(file1Path);
  const hasFile2 = fs.existsSync(file2Path);

  if (!hasFile1 || !hasFile2) {
    return res.json({
      hasDefaults: false,
      hasFile1,
      hasFile2,
    });
  }

  try {
    const file1Raw = fs.readFileSync(file1Path, "utf8");
    const file2Raw = fs.readFileSync(file2Path, "utf8");
    const file1 = JSON.parse(file1Raw);
    const file2 = JSON.parse(file2Raw);

    return res.json({
      hasDefaults: true,
      file1,
      file2,
    });
  } catch (err) {
    console.error("Error reading default JSON files:", err);
    return res.status(500).json({
      hasDefaults: false,
      error: "Failed to read default JSON files",
      details: err.message,
    });
  }
});

function normalizeToArray(value) {
  //   console.log("normalises to array", value);

  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseCoords(coordString) {
  if (!coordString || typeof coordString !== "string") return [];
  const nums = coordString.match(/-?\d+/g);
  if (!nums) return [];
  const result = [];
  for (let i = 0; i < nums.length - 1; i += 2) {
    const x = parseInt(nums[i], 10);
    const y = parseInt(nums[i + 1], 10);
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      result.push({ x, y });
    }
  }
  return result;
}

/**
 * Utility: merge two plain objects shallowly
 */
function shallowMerge(a, b) {
  return Object.assign({}, a || {}, b || {});
}

/**
 * Build a map of historical figures from file1 + file2
 */
function buildHistoricalFiguresMap(file1, file2) {
  const map = {};

  const hf1 = normalizeToArray(
    file1?.df_world?.historical_figures?.historical_figure
  );
  hf1.forEach((h) => {
    if (!h || !h.id) return;
    map[h.id] = shallowMerge(map[h.id], h);
  });

  const hf2 = normalizeToArray(
    file2?.df_world?.historical_figures?.historical_figure
  );
  hf2.forEach((h) => {
    if (!h || !h.id) return;
    map[h.id] = shallowMerge(map[h.id], h);
  });

  return map;
}

/**
 * Build a map: author_hfid -> written contents
 * Uses written_contents from both files, if present
 */
function buildWrittenByAuthorMap(file1, file2) {
  const byAuthor = {};

  function addFromFile(file, sourceLabel) {
    const wcArray = normalizeToArray(
      file?.df_world?.written_contents?.written_content
    );
    wcArray.forEach((wc) => {
      if (!wc) return;
      const authorId =
        wc.author_hfid ||
        wc.author_hf_id || // just in case
        wc.author_hfid_id || // in case of small naming variations
        null;

      if (!authorId) return;

      const normalized = {
        id: wc.id,
        title: wc.title,
        style: wc.style ?? wc.form ?? null,
        raw: wc,
        source: sourceLabel,
      };

      if (!byAuthor[authorId]) byAuthor[authorId] = [];
      byAuthor[authorId].push(normalized);
    });
  }

  addFromFile(file1, "file1");
  addFromFile(file2, "file2");

  return byAuthor;
}

/**
 * Extract historical figure IDs from arbitrary "structures" object
 * by looking for values that match known hist fig IDs.
 */
function collectHistFigIdsFromStructures(structures, histFigureById) {
  const ids = new Set();

  function traverse(val) {
    if (!val) return;
    const t = typeof val;

    if (t === "string" || t === "number") {
      const key = String(val);
      if (histFigureById[key]) {
        ids.add(key);
      }
    } else if (Array.isArray(val)) {
      val.forEach(traverse);
    } else if (t === "object") {
      Object.values(val).forEach(traverse);
    }
  }

  traverse(structures);
  return Array.from(ids);
}

/**
 * POST /api/world-data
 * Body: { file1: <JSON>, file2: <JSON> }
 */
app.post("/api/world-data", (req, res) => {
  try {
    const { file1, file2 } = req.body;

    console.log("runs data parse");

    if (!file1 || !file2) {
      return res.status(400).json({
        error:
          "Both file1 and file2 JSON must be provided in the request body.",
      });
    }

    // Maps & helpers
    const histFigureById = buildHistoricalFiguresMap(file1, file2);
    const writtenByAuthor = buildWrittenByAuthorMap(file1, file2);

    // Regions maps

    const regions1 = normalizeToArray(file1?.df_world?.regions?.region);
    const regions2 = normalizeToArray(file2?.df_world?.regions?.region);

    const region2ById = {};
    regions2.forEach((r) => {
      if (r && r.id) region2ById[r.id] = r;
    });

    // Underground region maps
    const ugr1 = normalizeToArray(
      file1?.df_world?.underground_regions?.underground_region
    );
    const ugr2 = normalizeToArray(
      file2?.df_world?.underground_regions?.underground_region
    );
    const ugr2ById = {};
    ugr2.forEach((r) => {
      if (r && r.id) ugr2ById[r.id] = r;
    });

    // Sites maps
    const sites1 = normalizeToArray(file1?.df_world?.sites?.site);
    const sites2 = normalizeToArray(file2?.df_world?.sites?.site);
    const site1ById = {};
    sites1.forEach((s) => {
      if (s && s.id) site1ById[s.id] = s;
    });

    // Cells: key "x,y" -> cell object
    const cellsMap = new Map();

    function getOrCreateCell(x, y) {
      const key = `${x},${y}`;
      if (!cellsMap.has(key)) {
        cellsMap.set(key, {
          key,
          x,
          y,
          region: null,
          undergroundRegions: [],
          sites: [],
          historical_figures: [],
          written_contents: [],
        });
      }
      return cellsMap.get(key);
    }

    function addHistoricalFiguresToCell(cell, hfList) {
      const existingIds = new Set(cell.historical_figures.map((h) => h.id));
      hfList.forEach((h) => {
        if (!h || !h.id || existingIds.has(h.id)) return;
        cell.historical_figures.push(h);
        existingIds.add(h.id);
      });
    }

    function addWrittenContentsToCell(cell, wcList) {
      const existingIds = new Set(cell.written_contents.map((w) => w.id));
      wcList.forEach((w) => {
        if (!w || !w.id || existingIds.has(w.id)) return;
        cell.written_contents.push(w);
        existingIds.add(w.id);
      });
    }

    // 1) Regions -> create cells
    regions1.forEach((r1) => {
      if (!r1) return;
      const coords = parseCoords(r1.coords);
      const r2 = r1.id ? region2ById[r1.id] : null;
      const mergedRegion = shallowMerge(r1, r2);

      coords.forEach(({ x, y }) => {
        const cell = getOrCreateCell(x, y);
        // If multiple regions share a cell, you could change this
        // to cell.regions.push(...). For now we store one region.
        cell.region = mergedRegion;
      });
    });

    // 2) Underground regions -> attach to cells
    ugr1.forEach((ug1) => {
      if (!ug1) return;
      const coords = parseCoords(ug1.coords);
      const ug2 = ug1.id ? ugr2ById[ug1.id] : null;
      const merged = shallowMerge(ug1, ug2);

      coords.forEach(({ x, y }) => {
        const cell = getOrCreateCell(x, y);
        cell.undergroundRegions.push(merged);
      });
    });

    // 3) Sites from file2, attach to cells, then hist figs + written contents
    sites2.forEach((s2) => {
      if (!s2 || !s2.coords) return;
      const coords = parseCoords(s2.coords);
      if (!coords.length) return;
      const { x, y } = coords[0]; // assume 1 main coord per site

      const cell = getOrCreateCell(x, y);
      const s1 = s2.id ? site1ById[s2.id] : null;

      const mergedSite = {
        id: s2.id,
        coords: { x, y },
        fromFile1: s1 || null,
        fromFile2: s2 || null,
        structures: s2.structures || s1?.structures || null,
        inhabitants: [],
        historical_figures: [],
        written_contents: [],
      };

      // Inhabitants from structures
      const inhabitantIds = collectHistFigIdsFromStructures(
        mergedSite.structures,
        histFigureById
      );
      mergedSite.inhabitants = inhabitantIds;

      const siteHFs = inhabitantIds
        .map((id) => histFigureById[id])
        .filter(Boolean);

      mergedSite.historical_figures = siteHFs;

      // Written contents for inhabitants
      const siteWCs = [];
      inhabitantIds.forEach((hid) => {
        const wcs = writtenByAuthor[hid] || [];
        wcs.forEach((w) => siteWCs.push(w));
      });

      mergedSite.written_contents = siteWCs;

      // Add to cell
      cell.sites.push(mergedSite);
      addHistoricalFiguresToCell(cell, siteHFs);
      addWrittenContentsToCell(cell, siteWCs);
    });

    // 4) Sort cells: (0,0) -> (0,1) -> ... -> (1,0) -> ...
    const cells = Array.from(cellsMap.values()).sort((a, b) => {
      if (a.x === b.x) return a.y - b.y;
      return a.x - b.x;
    });

    const worldData = { cells };

    res.json({ worldData });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to build worldData",
      details: err.message,
    });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

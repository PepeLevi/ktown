const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const map_plus_location = "big/map_plus.json";
const map_location = "big/map.json";
const book_location = "big/books.json";

// Serve public directory (for file1.json/file2.json etc.)
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// ---------- Helper: load default JSON files from /public ----------
function loadDefaultFiles() {
  const file1Path = path.join(PUBLIC_DIR, map_plus_location);
  const file2Path = path.join(PUBLIC_DIR, map_location);
  const booksPath = path.join(PUBLIC_DIR, book_location);

  const hasFile1 = fs.existsSync(file1Path);
  const hasFile2 = fs.existsSync(file2Path);
  const hasBooks = fs.existsSync(booksPath); // NEW

  if (!hasFile1 || !hasFile2 || !hasBooks) {
    throw new Error(
      `Default files missing. map_plus.json: ${hasFile1}, map.json: ${hasFile2}, books.json: ${hasBooks}`
    );
  }

  const file1Raw = fs.readFileSync(file1Path, "utf8");
  const file2Raw = fs.readFileSync(file2Path, "utf8");
  const booksRaw = fs.readFileSync(booksPath, "utf8"); // NEW

  const file1 = JSON.parse(file1Raw);
  const file2 = JSON.parse(file2Raw);
  const books = JSON.parse(booksRaw); // NEW

  return { file1, file2, books }; // UPDATED
}

// ---------- Existing endpoint to check default files ----------
app.get("/api/default-files", (req, res) => {
  const file1Path = path.join(PUBLIC_DIR, map_plus_location);
  const file2Path = path.join(PUBLIC_DIR, map_location);
  const booksPath = path.join(PUBLIC_DIR, book_location);

  const hasFile1 = fs.existsSync(file1Path);
  const hasFile2 = fs.existsSync(file2Path);
  const hasBooks = fs.existsSync(booksPath); // NEW

  if (!hasFile1 || !hasFile2 || !hasBooks) {
    return res.json({
      hasDefaults: false,
      hasFile1,
      hasFile2,
      hasBooks,
    });
  }

  try {
    const file1Raw = fs.readFileSync(file1Path, "utf8");
    const file2Raw = fs.readFileSync(file2Path, "utf8");
    const booksRaw = fs.readFileSync(booksPath, "utf8"); // NEW

    const file1 = JSON.parse(file1Raw);
    const file2 = JSON.parse(file2Raw);
    const books = JSON.parse(booksRaw); // NEW

    return res.json({
      hasDefaults: true,
      file1,
      file2,
      books, // NEW
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
// ---------- Utility functions (unchanged from your code) ----------
function normalizeToArray(value) {
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

function shallowMerge(a, b) {
  return Object.assign({}, a || {}, b || {});
}

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

function buildWrittenByAuthorMap(file1, file2) {
  const byAuthor = {};

  function addFromFile(file, sourceLabel) {
    const wcArray = normalizeToArray(
      file?.df_world?.written_contents?.written_content
    );
    wcArray.forEach((wc) => {
      if (!wc) return;
      const authorId =
        wc.author_hfid || wc.author_hf_id || wc.author_hfid_id || null;

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

function buildBooksByAuthorMap(booksFile) {
  const byAuthor = {};

  if (!booksFile) return byAuthor;

  // Adjust this path if your books JSON is shaped differently
  const booksArr = normalizeToArray(booksFile);

  console.log("BOOKS ARRAY", booksArr);

  booksArr.forEach((b) => {
    if (!b) return;

    const authorId =
      b.author_hfid || b.author_hf_id || b.author || b.author_id || null;

    if (!authorId) return;

    const authorKey = String(authorId);

    const normalized = {
      id: b.id,
      title: b.title,
      raw: b,
    };

    if (!byAuthor[authorKey]) byAuthor[authorKey] = [];
    byAuthor[authorKey].push(normalized);
  });

  return byAuthor;
}

function collectHistFigIdsForStructure(
  structure,
  histFigureById,
  booksByAuthor
) {
  const figsById = new Map(); // id (string) -> hf object

  function traverse(val) {
    if (!val) return;

    if (typeof val === "string" || typeof val === "number") {
      const key = String(val);
      const hf = histFigureById[key];
      if (hf) {
        figsById.set(key, hf);
      }
    } else if (Array.isArray(val)) {
      val.forEach(traverse);
    } else if (typeof val === "object") {
      Object.values(val).forEach(traverse);
    }
  }

  traverse(structure);

  const inhabitants = Array.from(figsById.values());

  // Attach books to each historical figure if we have the map
  if (booksByAuthor) {
    inhabitants.forEach((hf) => {
      const hid = String(hf.id);

      if (booksByAuthor[hid]) {
        console.log("books by author", hf.id, booksByAuthor[hid], structure);
        hf.books = booksByAuthor[hid] || [];
      }
    });
  }

  structure.inhabitants = inhabitants;
  return inhabitants;
}

// ---------- Core: buildWorldData from file1/file2 ----------
function buildWorldData(file1, file2, booksFile) {
  // Maps & helpers
  const histFigureById = buildHistoricalFiguresMap(file1, file2);
  // const writtenByAuthor = buildWrittenByAuthorMap(file1, file2);
  const booksByAuthor = buildBooksByAuthorMap(booksFile); // NEW

  // Regions
  const regions1 = normalizeToArray(file1?.df_world?.regions?.region);
  const regions2 = normalizeToArray(file2?.df_world?.regions?.region);

  const region2ById = {};
  regions2.forEach((r) => {
    if (r && r.id) region2ById[r.id] = r;
  });

  // Underground regions
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

  // Sites
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
    const { x, y } = coords[0];

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

    if (mergedSite.structures) {
      if (Array.isArray(mergedSite.structures.structure)) {
        mergedSite.structures.structure.forEach((struct) => {
          collectHistFigIdsForStructure(struct, histFigureById, booksByAuthor);
        });
      } else {
        collectHistFigIdsForStructure(
          mergedSite.structures.structure,
          histFigureById,
          booksByAuthor
        );
      }
    }

    // mergedSite.inhabitants = inhabitantIds;

    // const siteHFs = inhabitantIds
    //   .map((id) => histFigureById[id])
    //   .filter(Boolean);
    // mergedSite.historical_figures = siteHFs;

    // const siteWCs = [];
    // inhabitantIds.forEach((hid) => {
    //   const wcs = writtenByAuthor[hid] || [];
    //   wcs.forEach((w) => siteWCs.push(w));
    // });
    // mergedSite.written_contents = siteWCs;

    let allINhabitants = [];
    let allbooksincelle = [];

    mergedSite.structures?.structure?.inhabitants?.forEach((inhabitant) => {
      allINhabitants.push(inhabitant);
      if (inhabitant.books) {
        inhabitant.books.forEach((b) => {
          allbooksincelle.push(b);
        });
      }
    });

    cell.sites.push(mergedSite);
    // addHistoricalFiguresToCell(cell, allINhabitants);
    // addWrittenContentsToCell(cell, allbooksincelle);
    cell.historical_figures = allINhabitants;
    cell.written_contents = allbooksincelle;
  });

  // 4) Sort cells
  const cells = Array.from(cellsMap.values()).sort((a, b) => {
    if (a.x === b.x) return a.y - b.y;
    return a.x - b.x;
  });

  cells.forEach((cell) => {
    // Remove site coords
    cell.sites.forEach((site) => {
      delete site.coords;
    });

    // Remove region coords
    if (cell.region) {
      delete cell.region.coords;
    }

    // Remove underground region coords
    cell.undergroundRegions.forEach((ug) => {
      delete ug.coords;
    });
  });

  return { cells };
}

// ---------- NEW: GET / -> worldData from default files ----------
app.get("/", (req, res) => {
  try {
    const { file1, file2, books } = loadDefaultFiles();
    const worldData = buildWorldData(file1, file2, books);
    res.json({ worldData });
    console.log("WORLD DATA (from default files)", worldData);
  } catch (err) {
    console.error("Error building worldData from default files:", err);
    res.status(500).json({
      error: "Failed to build worldData from default files",
      details: err.message,
    });
  }
});

// ---------- Existing POST /api/world-data (still works with body) ----------
app.post("/api/world-data", (req, res) => {
  try {
    // const { file1, file2, books } = req.body;

    const { file1, file2, books } = loadDefaultFiles();

    if (!file1 || !file2) {
      return res.status(400).json({
        error:
          "Both file1 and file2 JSON must be provided in the request body.",
      });
    }

    const worldData = buildWorldData(file1, file2, books);

    res.json({ worldData });
    // console.log("WORLD DATA (from request body)", worldData);
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

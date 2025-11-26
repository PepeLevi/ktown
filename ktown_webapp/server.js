const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { chain } = require("stream-chain");
const { parser } = require("stream-json");
const { streamValues } = require("stream-json/streamers/StreamValues");

const app = express();

app.use(cors());
app.use(express.json({ limit: "500mb" })); // Increased limit for large JSON files

const world_data_location = "big/queen.json";

// Serve public directory (for queen.json)
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// ---------- Helper: load JSON file using streaming parser for large files ----------
function loadJsonFileStreaming(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      resolve(null);
      return;
    }

    const fileSize = fs.statSync(filePath).size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    console.log(
      `Loading ${path.basename(
        filePath
      )} (${fileSizeMB} MB) using streaming parser...`
    );

    const pipeline = chain([
      fs.createReadStream(filePath),
      parser(),
      streamValues(),
    ]);

    let result = null;
    pipeline.on("data", (data) => {
      result = data.value;
    });

    pipeline.on("end", () => {
      if (result === null) {
        reject(new Error(`Failed to parse JSON file: ${filePath}`));
      } else {
        console.log(`✓ Loaded ${path.basename(filePath)}`);
        resolve(result);
      }
    });

    pipeline.on("error", (err) => {
      console.error(`Error loading ${filePath}:`, err);
      reject(err);
    });
  });
}

// ---------- Helper: load default JSON files from /public ----------
// Uses streaming parser to handle very large files that exceed Node.js string length limits
async function loadDefaultFiles() {
  const filePath = path.join(PUBLIC_DIR, world_data_location);

  const hasFile = fs.existsSync(filePath);

  // Files are optional - return empty structures if missing (they're in .gitignore)
  let file = { sites: [], regions: [] };

  if (!hasFile) {
    console.warn(
      `Warning: World data not found. Using empty structures.`
    );
    return file;
  }

  try {
    console.log("Loading JSON files using streaming parser...");

    // Use streaming parser for large files
    const [fileData] = await Promise.all([
      hasFile
        ? loadJsonFileStreaming(filePath).catch(() => null)
        : Promise.resolve(null)
    ]);

    if (fileData) {
      file = fileData;
    } else if (hasFile) {
      console.warn(
        `Warning: Failed to load ${filePath}. Using empty structure.`
      );
    }

    console.log("JSON files loaded successfully");
    return file;
  } catch (err) {
    console.error("Error loading JSON files:", err);
    throw new Error(`Failed to load JSON files: ${err.message}`);
  }
}

// ---------- Existing endpoint to check default files ----------
app.get("/api/default-files", (req, res) => {
  const filePath = path.join(PUBLIC_DIR, world_data_location);

  const hasFile = fs.existsSync(filePath);

  if (!hasFile) {
    return res.json({
      hasDefaults: false,
      hasFile
    });
  }

  try {
    const fileRaw = fs.readFileSync(filePath, "utf8");

    const file = JSON.parse(fileRaw);

    return res.json({
      hasDefaults: true,
      file
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

// ---------- Utility functions ----------
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

// ---------- Core: buildWorldData from file ----------
function buildWorldData(world) {

  const regions = normalizeToArray(world?.regions);
  const ugr = normalizeToArray( world?.underground_regions);
  const sites = normalizeToArray(world?.sites);
  const historical_events = normalizeToArray(world?.historical_events)

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
        sites: []
      });
    }
    return cellsMap.get(key);
  }

  // 1) Regions -> create cells
  regions.forEach((r) => {
    if (!r) return;
    const coords = parseCoords(r.coords);
    coords.forEach(({ x, y }) => {
      const cell = getOrCreateCell(x, y);
      cell.region = r;
    });
  });

  // 2) Underground regions -> attach to cells
  ugr.forEach((ug) => {
    if (!ug) return;
    const coords = parseCoords(ug.coords);
    coords.forEach(({ x, y }) => {
      const cell = getOrCreateCell(x, y);
      cell.undergroundRegions.push(ug);
    });
  });

  // 3) push sites to cell
  sites.forEach((s) => {
    if (!s || !s.coords) return;
    const coords = parseCoords(s.coords);
    if (!coords.length) return; // esben you js brained motherfucker thats the kind of boolean logic we like to see
    
    const { x, y } = coords[0];
    const cell = getOrCreateCell(x, y);
    cell.sites.push(s);
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

  return { cells, historical_events };
}

// ---------- NEW: GET / -> worldData from default files ----------
app.get("/", async (req, res) => {
  try {
    const file = await loadDefaultFiles();
    const worldData = buildWorldData(file);

    const firstCellWithBooks = worldData.cells.find((cell) =>
      cell.sites?.some((site) =>
        site.structures?.some((struct) =>
          struct.historical_figures?.some((inh) => {
            const hasBooks = Array.isArray(inh.books) && inh.books.length > 0;
            if (hasBooks) {
              console.log("has inhabitant with book", inh);
            }
            return hasBooks;
          })
        )
      )
    );

    console.log("firstCellWithBooks", firstCellWithBooks);
    res.json(worldData);

    // console.log("FILTERED WORLD DATA", filtered);
    // res.json({ worldData });

    // console.log("WORLD DATA (from default files)", worldData);
  } catch (err) {
    console.error("Error building worldData from default files:", err);
    res.status(500).json({
      error: "Failed to build worldData from default files",
      details: err.message,
    });
  }
});

// ---------- Existing POST /api/world-data (uses default files or body) ----------
app.post("/api/world-data", async (req, res) => {
  try {
    let file;

    // If body has files, use them; otherwise use default files
    if (req.body && req.body.file) {
      file = req.body.file;
    } else {
      // Use default files from /public directory
      file = await loadDefaultFiles();
    }

    if (!file) {
      return res.status(400).json({
        error:
          "JSON file must be provided. Either include it in the request body or place default files in the /public directory.",
      });
    }

    const worldData = buildWorldData(file);

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

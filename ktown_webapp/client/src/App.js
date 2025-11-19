// src/App.jsx
import React, { useState, useEffect } from "react";
import WorldMap from "./worldMap";
import { REGION_TEXTURES } from "./regionTextures";

function App() {
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [worldData, setWorldData] = useState(null);
  const [status, setStatus] = useState("");
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);

  const [allowUpload, setAllowUpload] = useState(true);

  // Use environment variable for backend URL, fallback to empty string for relative URLs
  // For Cloudflare tunnel: set REACT_APP_BACKEND_URL to https://back.kt0wn.com
  // For local development: leave empty to use proxy, or set to http://localhost:3001
  const backendUrl = process.env.REACT_APP_BACKEND_URL || "";

  const handleFile1Change = (e) => setFile1(e.target.files[0] || null);
  const handleFile2Change = (e) => setFile2(e.target.files[0] || null);

  function readJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }

  const buildWorldDataFromJson = async (json1, json2, msgPrefix = "") => {
    try {
      setStatus(msgPrefix + "Sending to server...");

      const res = await fetch(`${backendUrl}/api/world-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file1: json1, file2: json2 }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Request failed");
      }

      const data = await res.json();
      setWorldData(data.worldData);

      console.log("treats world data", data.worldData);

      setSelectedCell(null);
      setSelectedEntity(null);
      setStatus(
        `${msgPrefix}WorldData built: ${data.worldData.cells.length} cell(s).`
      );
    } catch (err) {
      console.error(err);
      setStatus("Error building worldData.");
      alert("Error: " + err.message);
    }
  };

  const handleBuild = async () => {
    if (!file1 || !file2) {
      alert("Please select both file1.json and file2.json.");
      return;
    }

    setStatus("Reading files...");

    try {
      const [json1, json2] = await Promise.all([
        readJsonFile(file1),
        readJsonFile(file2),
      ]);

      await buildWorldDataFromJson(json1, json2, "");
    } catch (err) {
      console.error(err);
      setStatus("Error reading files.");
      alert("Error: " + err.message);
    }
  };

  useEffect(() => {
    const checkDefaults = async () => {
      try {
        setStatus("Checking for default JSON files...");
        const res = await fetch(`${backendUrl}/api/default-files`);
        if (!res.ok) throw new Error("Failed to check default files");

        const data = await res.json();

        console.log("worldData", data);

        if (data.hasDefaults && data.file1 && data.file2) {
          setAllowUpload(false);
          setStatus("Default JSON files found. Building map...");
          await buildWorldDataFromJson(data.file1, data.file2, "Defaults: ");
        } else {
          setAllowUpload(true);
          setStatus("No default JSON files. Please upload your files.");
        }
      } catch (err) {
        console.error(err);
        setAllowUpload(true);
        setStatus("Could not check default files. Please upload your files.");
      }
    };

    checkDefaults();
  }, []);

  // ---- selection handlers ----

  const handleCellClick = (cell) => {
    setSelectedCell(cell);
    setSelectedEntity(null); // 🔸 only the cell is in focus
  };

  const handleEntityClick = (entity) => {
    setSelectedEntity(entity); // site or figure composed object
    setSelectedCell(null); // 🔸 clear cell highlight when clicking inside
  };

  return (
    <div className="app">
      <main className="layout">
        <section className="map-panel">
          {worldData ? (
            <WorldMap
              worldData={worldData}
              onCellClick={handleCellClick}
              onEntityClick={handleEntityClick}
              selectedCell={selectedCell}
              selectedEntity={selectedEntity} // 🔸 pass down
            />
          ) : (
            <p className="placeholder">Map will appear here.</p>
          )}
        </section>

        <section className="details-panel">
          <div className="app-header">
            <p>
              {allowUpload
                ? "Upload file1.json & file2.json to build the map."
                : "ktown: release the ktown files"}
            </p>
          </div>

          <section className="controls">
            {allowUpload && (
              <>
                <div className="file-inputs">
                  <label>
                    File 1:
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFile1Change}
                    />
                  </label>
                  <label>
                    File 2:
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFile2Change}
                    />
                  </label>
                </div>
                <button onClick={handleBuild}>Build Map</button>
              </>
            )}
            <p className="status">{status}</p>
          </section>

          {selectedEntity ? (
            <EntityDetailsView entity={selectedEntity} />
          ) : selectedCell ? (
            <CellDetailsView cell={selectedCell} />
          ) : (
            <p className="placeholder">
              Click a cell, site, or figure in the map to see details.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

/* ------- small details helpers ------- */

function TexturePreview({ label, src }) {
  if (!src) return null;
  return (
    // <div className="texture-preview">
    //   <div className="texture-label">{label}</div>
    //   <div className="texture-frame">
    <img src={src} alt={label} />
    //   </div>
    // </div>
  );
}

function EntityDetailsView({ entity }) {
  const {
    kind,
    name,
    type,
    textureUrl,
    regionTextureUrl,
    siteTextureUrl,
    cellCoords,
  } = entity;

  const mainTexture = textureUrl || siteTextureUrl || regionTextureUrl || null;

  return (
    <div className="details-content">
      <h3>
        {kind === "site" && "Site"}
        {kind === "figure" && "Historical Figure"}
        {!kind && "Entity"}
      </h3>

      <p>
        <strong>Name:</strong> {name || "Unknown"}
      </p>
      {type && (
        <p>
          <strong>Type:</strong> {type}
        </p>
      )}
      {cellCoords && (
        <p>
          <strong>Cell:</strong> ({cellCoords.x}, {cellCoords.y})
        </p>
      )}

      <div className="texture-previews">
        <TexturePreview label="Entity texture" src={mainTexture} />
        {siteTextureUrl && siteTextureUrl !== mainTexture && (
          <TexturePreview label="Site texture" src={siteTextureUrl} />
        )}
        {regionTextureUrl && regionTextureUrl !== mainTexture && (
          <TexturePreview label="Region texture" src={regionTextureUrl} />
        )}
      </div>

      {kind === "site" && (
        <>
          <h4>Site object</h4>
          <pre>{JSON.stringify(entity.site, null, 2)}</pre>

          <h4>Cell</h4>
          <pre>{JSON.stringify(entity.cell, null, 2)}</pre>

          <h4>Region</h4>
          <pre>{JSON.stringify(entity.region, null, 2)}</pre>

          <h4>Underground Regions</h4>
          <pre>{JSON.stringify(entity.undergroundRegions || [], null, 2)}</pre>

          <h4>Historical Figures at Site</h4>
          <pre>{JSON.stringify(entity.historical_figures || [], null, 2)}</pre>

          <h4>Written Contents at Site</h4>
          <pre>{JSON.stringify(entity.written_contents || [], null, 2)}</pre>
        </>
      )}

      {kind === "figure" && (
        <>
          <h4>Figure</h4>
          <pre>{JSON.stringify(entity.figure, null, 2)}</pre>

          <h4>Site</h4>
          <pre>{JSON.stringify(entity.site, null, 2)}</pre>

          <h4>Cell</h4>
          <pre>{JSON.stringify(entity.cell, null, 2)}</pre>

          <h4>Region</h4>
          <pre>{JSON.stringify(entity.region, null, 2)}</pre>

          <h4>Underground Regions</h4>
          <pre>{JSON.stringify(entity.undergroundRegions || [], null, 2)}</pre>

          <h4>Figures at Site</h4>
          <pre>
            {JSON.stringify(entity.site_historical_figures || [], null, 2)}
          </pre>

          <h4>Figures in Cell</h4>
          <pre>
            {JSON.stringify(entity.cell_historical_figures || [], null, 2)}
          </pre>

          <h4>Written Contents at Site</h4>
          <pre>
            {JSON.stringify(entity.site_written_contents || [], null, 2)}
          </pre>

          <h4>Written Contents in Cell</h4>
          <pre>
            {JSON.stringify(entity.cell_written_contents || [], null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}

function CellDetailsView({ cell }) {
  const regionType = cell.region?.type || null;
  const regionTexture = regionType ? REGION_TEXTURES[regionType] : null;

  return (
    <div className="details-content">
      <h3>
        Cell ({cell.x}, {cell.y})
      </h3>

      <div className="texture-previews">
        <TexturePreview label="Region texture" src={regionTexture} />
      </div>

      <h4>Region</h4>
      <pre>{cell.region ? JSON.stringify(cell.region, null, 2) : "None"}</pre>

      <h4>Sites</h4>
      <pre>
        {cell.sites?.length ? JSON.stringify(cell.sites, null, 2) : "None"}
      </pre>

      <h4>Historical Figures in Cell</h4>
      <pre>
        {cell.historical_figures?.length
          ? JSON.stringify(cell.historical_figures, null, 2)
          : "None"}
      </pre>

      <h4>Written Contents in Cell</h4>
      <pre>
        {cell.written_contents?.length
          ? JSON.stringify(cell.written_contents, null, 2)
          : "None"}
      </pre>
    </div>
  );
}

export default App;

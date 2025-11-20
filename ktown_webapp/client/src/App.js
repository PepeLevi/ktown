// src/App.jsx
import React, { useState, useEffect } from "react";
import WorldMap from "./worldMap";
import { REGION_TEXTURES } from "./regionTextures";

function App() {
  const [worldData, setWorldData] = useState(null);
  const [status, setStatus] = useState("Requesting world data from server...");
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);

  // Set this to your backend base URL if needed (e.g. "http://localhost:3000")
  const backendUrl = "";

  const fetchWorldData = async () => {
    try {
      setStatus("Requesting world data from server...");

      const res = await fetch(`${backendUrl}/api/world-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      console.log(res);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Request failed");
      }

      const data = await res.json();

      // Support both { worldData: {...} } and direct worldData payloads
      const wd = data.worldData || data;

      if (!wd || !wd.cells) {
        throw new Error("Invalid worldData format from server");
      }

      setWorldData(wd);

      wd.cells.forEach((cell) => {
        if (cell.written_contents && cell.written_contents.length > 0) {
          console.log("has cell with book", cell);
        }
      });

      setSelectedCell(null);
      setSelectedEntity(null);
      setStatus(`World data loaded: ${wd.cells.length} cell(s).`);
    } catch (err) {
      console.error(err);
      setStatus("Error loading world data.");
      alert("Error: " + err.message);
    }
  };

  useEffect(() => {
    fetchWorldData();
    // backendUrl is constant, so no need to add it to deps
  }, []);

  const handleEntityClick = (entity) => {
    setSelectedEntity(entity);
    setSelectedCell(null);
  };

  return (
    <div className="app">
      <main className="layout">
        <section className="map-panel">
          {worldData ? (
            <WorldMap
              worldData={worldData}
              onEntityClick={handleEntityClick}
              selectedCell={selectedCell}
              selectedEntity={selectedEntity}
            />
          ) : (
            <p className="placeholder">Map will appear here once loaded.</p>
          )}
        </section>

        <section className="details-panel">
          <div className="app-header">
            <p>World data is fetched directly from the server.</p>
          </div>

          <section className="controls">
            <button onClick={fetchWorldData}>Reload World Data</button>
            <p className="status">{status}</p>
          </section>

          {selectedEntity ? (
            <EntityDetailsView entity={selectedEntity} />
          ) : null}
        </section>
      </main>
    </div>
  );
}

/* ------- small details helpers ------- */

function TexturePreview({ label, src }) {
  if (!src) return null;
  return <img src={src} alt={label} />;
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
    site,
    structure,
    figure,
    book,
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

export default App;

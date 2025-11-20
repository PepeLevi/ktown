// src/App.jsx
import React, { useState, useEffect } from "react";
import WorldMap from "./worldMap";
import { REGION_TEXTURES } from "./regionTextures";

function App() {
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [worldData, setWorldData] = useState(null);
  const [status, setStatus] = useState("Requesting world data from server...");
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [figures, setFigures] = useState([]);
  const [books, setBooks] = useState([]);
  const [allowUpload, setAllowUpload] = useState(true);

  const backendUrl = "";

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

      // Support both { worldData: {...} } and direct worldData payloads
      const wd = data.worldData || data;

      if (!wd || !wd.cells) {
        throw new Error("Invalid worldData format from server");
      }

      setWorldData(wd);

      let temp_figures = [];
      let temp_books = [];
      wd.cells.forEach((cell) => {
        if (cell.written_contents && cell.written_contents.length > 0) {
          console.log("has cell with book", cell);

          for (let index = 0; index < cell.written_contents.length; index++) {
            temp_books.push(cell.written_contents[index]);
          }
        }
        if (cell.historical_figures) {
          for (let index = 0; index < cell.historical_figures.length; index++) {
            temp_figures.push(cell.historical_figures[index]);
          }
        }
      });

      setFigures(temp_figures);
      setBooks(temp_books);

      setSelectedCell(null);
      setSelectedEntity(null);
      setStatus(
        `${msgPrefix}WorldData built: ${wd.cells.length} cell(s).`
      );
    } catch (err) {
      console.error(err);
      setStatus("Error building worldData.");
      alert("Error: " + err.message);
    }
  };

  const fetchWorldData = async () => {
    try {
      setStatus("Requesting world data from server...");

      const res = await fetch(`${backendUrl}/api/world-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

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

      let temp_figures = [];
      let temp_books = [];
      wd.cells.forEach((cell) => {
        if (cell.written_contents && cell.written_contents.length > 0) {
          console.log("has cell with book", cell);

          for (let index = 0; index < cell.written_contents.length; index++) {
            temp_books.push(cell.written_contents[index]);
          }
        }
        if (cell.historical_figures) {
          for (let index = 0; index < cell.historical_figures.length; index++) {
            temp_figures.push(cell.historical_figures[index]);
          }
        }
      });

      setFigures(temp_figures);
      setBooks(temp_books);

      setSelectedCell(null);
      setSelectedEntity(null);
      setStatus(`World data loaded: ${wd.cells.length} cell(s).`);
    } catch (err) {
      console.error(err);
      setStatus("Error loading world data.");
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
        if (!res.ok) {
          // If default files endpoint doesn't exist, try fetching directly
          await fetchWorldData();
          return;
        }

        const data = await res.json();

        console.log("worldData", data);

        if (data.hasDefaults && data.file1 && data.file2) {
          setAllowUpload(false);
          setStatus("Default JSON files found. Building map...");
          await buildWorldDataFromJson(data.file1, data.file2, "Defaults: ");
        } else {
          setAllowUpload(true);
          setStatus("No default JSON files. Please upload your files.");
          // Try fetching directly as fallback
          await fetchWorldData();
        }
      } catch (err) {
        console.error(err);
        setAllowUpload(true);
        setStatus("Could not check default files. Please upload your files.");
        // Try fetching directly as fallback
        try {
          await fetchWorldData();
        } catch (fetchErr) {
          console.error("Failed to fetch world data:", fetchErr);
        }
      }
    };

    checkDefaults();
  }, []);

  // ---- selection handlers ----

  const handleCellClick = (cell) => {
    setSelectedCell(cell);
    setSelectedEntity(null);
  };

  const handleEntityClick = (entity) => {
    console.log("handleEntityClick", entity);
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
              onCellClick={handleCellClick}
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
            <EntityDetailsView entity={selectedEntity} figures={figures} />
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

function FigureDetailView({ figure, figures, isTopLevel }) {
  if (!figure) {
    return null;
  }

  return (
    <div className="figure-detail-view">
      <div className="flex-row-full">
        <p>{figure.name}</p>{" "}
        <p
          style={{
            transform: figure.sex === "-1" ? "rotate(90deg)" : "none",
          }}
        >
          {figure.id}
        </p>
      </div>

      <p>{figure.race}</p>
      <p>{figure.associated_type}</p>

      {figure.sphere && (
        <div className="flex-row-full">
          {Array.isArray(figure.sphere) &&
            figure.sphere.map((s, i) => <p key={i}>{s}</p>)}
        </div>
      )}

      {figure.hf_link && isTopLevel && (
        <div className="flex-column subFigures">
          {figure.hf_link.map((s, i) => (
            <div key={i}>
              {figures[s.hfid] ? (
                <div className={s.link_type + " subFigure"}>
                  <p>{s.link_type}</p>
                  <FigureDetailView
                    figure={figures[s.hfid]}
                    figures={figures}
                    isTopLevel={false}
                  />
                </div>
              ) : (
                <p>
                  {s.link_type}
                  {s.hfid}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {figure.books && isTopLevel && (
        <>
          {figure.books.map((b, i) => (
            <div key={i}>
              <BookDetailView book={b} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function BookDetailView({ book }) {
  console.log("BOOOK", book);
  if (!book) {
    return null;
  }

  return (
    <div className="book">
      <p>{book.title}</p>
      <p>{book.text_content}</p>
    </div>
  );
}

function EntityDetailsView({ entity, figures }) {
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

  console.log("clicked on entity", entity);

  return (
    <div className="details-content">
      <h3>
        {kind === "site" && "Site"}
        {kind === "figure" && "Historical Figure"}
        {kind === "structure" && "Structure"}
        {kind === "undergroundRegion" && "Underground Region"}
        {kind === "writtenContent" && "Written Content"}
        {kind === "cell" && "Cell"}
        {!kind && "Entity"}
      </h3>

      <div className="flex-row-full">
        <p>{name || "Unknown"}</p>
        {cellCoords && (
          <p>
            [{cellCoords.x}, {cellCoords.y}]
          </p>
        )}
      </div>
      <div className="flex-row-full">
        {type && <p>**{type}</p>}
        {kind && <p>{kind}**</p>}
      </div>

      <div className="texture-previews">
        <TexturePreview label="Entity texture" src={mainTexture} />
        {siteTextureUrl && siteTextureUrl !== mainTexture && (
          <TexturePreview label="Site texture" src={siteTextureUrl} />
        )}
        {regionTextureUrl && regionTextureUrl !== mainTexture && (
          <TexturePreview label="Region texture" src={regionTextureUrl} />
        )}
      </div>

      <div className="flex-row-full"></div>

      <div className="specs">
        {figure && (
          <FigureDetailView
            figure={figure}
            figures={figures}
            isTopLevel={true}
          />
        )}
      </div>

      {kind === "site" && (
        <>
          <h4>Site object</h4>
          <pre>{JSON.stringify(entity.site, null, 2)}</pre>

          <h4>Cell</h4>
          <pre>{JSON.stringify(entity.cell, null, 2)}</pre>

          <h4>Region</h4>
          <pre>{JSON.stringify(entity.region || null, null, 2)}</pre>

          <h4>Underground Regions</h4>
          <pre>{JSON.stringify(entity.undergroundRegions || [], null, 2)}</pre>

          <h4>Historical Figures at Site</h4>
          <pre>{JSON.stringify(entity.historical_figures || [], null, 2)}</pre>

          <h4>Written Contents at Site</h4>
          <pre>{JSON.stringify(entity.written_contents || [], null, 2)}</pre>
        </>
      )}

      {kind === "structure" && (
        <>
          <h4>Structure object</h4>
          <pre>{JSON.stringify(entity.structure, null, 2)}</pre>

          <h4>Cell</h4>
          <pre>{JSON.stringify(entity.cell, null, 2)}</pre>

          <h4>Region</h4>
          <pre>{JSON.stringify(entity.region || null, null, 2)}</pre>
        </>
      )}

      {kind === "figure" && (
        <>
          <h4>Figure</h4>
          <pre>{JSON.stringify(entity.figure, null, 2)}</pre>

          <h4>Site</h4>
          <pre>{JSON.stringify(entity.site || null, null, 2)}</pre>

          <h4>Cell</h4>
          <pre>{JSON.stringify(entity.cell, null, 2)}</pre>

          <h4>Region</h4>
          <pre>{JSON.stringify(entity.region || null, null, 2)}</pre>

          <h4>Underground Regions</h4>
          <pre>{JSON.stringify(entity.undergroundRegions || [], null, 2)}</pre>
        </>
      )}

      {kind === "cell" && (
        <>
          <h4>Cell</h4>
          <pre>{JSON.stringify(entity.cell, null, 2)}</pre>

          <h4>Region</h4>
          <pre>{JSON.stringify(entity.region || null, null, 2)}</pre>

          <h4>Sites</h4>
          <pre>
            {entity.sites?.length ? JSON.stringify(entity.sites, null, 2) : "None"}
          </pre>

          <h4>Historical Figures in Cell</h4>
          <pre>
            {entity.historical_figures?.length
              ? JSON.stringify(entity.historical_figures, null, 2)
              : "None"}
          </pre>

          <h4>Written Contents in Cell</h4>
          <pre>
            {entity.written_contents?.length
              ? JSON.stringify(entity.written_contents, null, 2)
              : "None"}
          </pre>
        </>
      )}
    </div>
  );
}

export default App;

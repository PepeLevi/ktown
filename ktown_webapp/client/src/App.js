// src/App.jsx
import React, { useState, useEffect } from "react";
import WorldMap from "./worldMap";
import { REGION_TEXTURES } from "./regionTextures";

function App() {
<<<<<<< HEAD
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [worldData, setWorldData] = useState(null);
  const [status, setStatus] = useState("");
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);

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
=======
  const [worldData, setWorldData] = useState(null);
  const [status, setStatus] = useState("Requesting world data from server...");
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [figures, setFigures] = useState([]);
  const [books, setBooks] = useState([]);

  // Set this to your backend base URL if needed (e.g. "http://localhost:3000")
  const backendUrl = "";

  const fetchWorldData = async () => {
    try {
      setStatus("Requesting world data from server...");
>>>>>>> c0ec853df47c8d6f00c17dee8aa5088b99a0fecf

      const res = await fetch(`${backendUrl}/api/world-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
<<<<<<< HEAD
        body: JSON.stringify({ file1: json1, file2: json2 }),
=======
>>>>>>> c0ec853df47c8d6f00c17dee8aa5088b99a0fecf
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Request failed");
      }

      const data = await res.json();
<<<<<<< HEAD
      setWorldData(data.worldData);
      data.worldData.cells.forEach((cell) => {
        if (cell.written_contents.length > 0) {
          console.log("has cell with book", cell);
        }
      });

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
=======

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
        for (let index = 0; index < cell.historical_figures.length; index++) {
          temp_figures.push(cell.historical_figures[index]);
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
>>>>>>> c0ec853df47c8d6f00c17dee8aa5088b99a0fecf
      alert("Error: " + err.message);
    }
  };

  useEffect(() => {
<<<<<<< HEAD
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
=======
    fetchWorldData();
    // backendUrl is constant, so no need to add it to deps
  }, []);

  const handleEntityClick = (entity) => {
    setSelectedEntity(entity);
    setSelectedCell(null);
>>>>>>> c0ec853df47c8d6f00c17dee8aa5088b99a0fecf
  };

  return (
    <div className="app">
      <main className="layout">
        <section className="map-panel">
          {worldData ? (
            <WorldMap
              worldData={worldData}
<<<<<<< HEAD
              onCellClick={handleCellClick}
              onEntityClick={handleEntityClick}
              selectedCell={selectedCell}
              selectedEntity={selectedEntity} // 🔸 pass down
            />
          ) : (
            <p className="placeholder">Map will appear here.</p>
=======
              onEntityClick={handleEntityClick}
              selectedCell={selectedCell}
              selectedEntity={selectedEntity}
            />
          ) : (
            <p className="placeholder">Map will appear here once loaded.</p>
>>>>>>> c0ec853df47c8d6f00c17dee8aa5088b99a0fecf
          )}
        </section>

        <section className="details-panel">
          <div className="app-header">
<<<<<<< HEAD
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
=======
            <p>KT0WN</p>
          </div>

          {/* <section className="controls">
            <button onClick={fetchWorldData}>Reload World Data</button>
            <p className="status">{status}</p>
          </section> */}

          {selectedEntity ? (
            <EntityDetailsView entity={selectedEntity} figures={figures} />
>>>>>>> c0ec853df47c8d6f00c17dee8aa5088b99a0fecf
          ) : null}
        </section>
      </main>
    </div>
  );
}

/* ------- small details helpers ------- */

function TexturePreview({ label, src }) {
  if (!src) return null;
<<<<<<< HEAD
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
=======
  return <img src={src} alt={label} />;
}

function FigureDetailView({ figure, figures, isTopLevel }) {
  if (!figure) {
    return;
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
            <>
              {figures[s.hfid] ? (
                <div key={i} className={s.link_type + " subFigure"}>
                  <p>{s.link_type}</p>
                  <FigureDetailView
                    figure={figures[s.hfid]}
                    isTopLevel={false}
                  />
                </div>
              ) : (
                <p>
                  {s.link_type}
                  {s.hfid}
                </p>
              )}
            </>
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
    return;
  }

  return (
    <div className="book">
      <p>{book.title}</p>
      <p>{book.text_content}</p>
    </div>
  );
}
function structureDetailView({ e }) {
  return <div></div>;
}
function siteDetailView({ e }) {
  return <div></div>;
}

function EntityDetailsView({ entity, figures }) {
>>>>>>> c0ec853df47c8d6f00c17dee8aa5088b99a0fecf
  const {
    kind,
    name,
    type,
    textureUrl,
    regionTextureUrl,
    siteTextureUrl,
    cellCoords,
<<<<<<< HEAD
=======
    site,
    structure,
    figure,
    book,
>>>>>>> c0ec853df47c8d6f00c17dee8aa5088b99a0fecf
  } = entity;

  const mainTexture = textureUrl || siteTextureUrl || regionTextureUrl || null;

<<<<<<< HEAD
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
=======
  console.log("clicked on entity", entity);

  return (
    <div className="details-content">
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
>>>>>>> c0ec853df47c8d6f00c17dee8aa5088b99a0fecf

      <div className="texture-previews">
        <TexturePreview label="Entity texture" src={mainTexture} />
        {siteTextureUrl && siteTextureUrl !== mainTexture && (
          <TexturePreview label="Site texture" src={siteTextureUrl} />
        )}
        {regionTextureUrl && regionTextureUrl !== mainTexture && (
          <TexturePreview label="Region texture" src={regionTextureUrl} />
        )}
      </div>

<<<<<<< HEAD
      {kind === "site" && (
=======
      <div className="flex-row-full"></div>

      {/* {kind === "site" && (
>>>>>>> c0ec853df47c8d6f00c17dee8aa5088b99a0fecf
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
<<<<<<< HEAD
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
=======
      )} */}
      <div className="specs">
        {figure && (
          <FigureDetailView
            figure={figure}
            figures={figures}
            isTopLevel={true}
          />
        )}
      </div>
>>>>>>> c0ec853df47c8d6f00c17dee8aa5088b99a0fecf
    </div>
  );
}

export default App;

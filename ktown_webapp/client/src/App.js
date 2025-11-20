// src/App.jsx
import React, { useState, useEffect } from "react";
import WorldMap from "./oldworldMap";

function App() {
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
            <p>KT0WN</p>
          </div>

          {/* <section className="controls">
            <button onClick={fetchWorldData}>Reload World Data</button>
            <p className="status">{status}</p>
          </section> */}

          {selectedEntity ? (
            <EntityDetailsView
              entity={selectedEntity}
              figures={figures}
              books={books}
              handleEntityClick={handleEntityClick}
            />
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

function FigureDetailView({
  figure,
  figures,
  isTopLevel,
  books,
  handleEntityClick,
}) {
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
              <BookDetailView book={b} isTopLevel={false} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
function BookDetailView({ book, isTopLevel, figures, books }) {
  if (!book) {
    return;
  }

  return (
    <div className="book">
      <div className="flex-row-full"></div>
      <p>{book.title}</p>
      <p>{book.raw.text_content}</p>

      {book.author_hfid && isTopLevel && (
        <>
          <FigureDetailView
            figure={figures[book.author_hfid]}
            isTopLevel={false}
          />
        </>
      )}
    </div>
  );
}
function StructureDetailView({ structure, handleEntityClick }) {
  return (
    <div>
      <button
        onClick={() => {
          handleEntityClick(structure);
        }}
      >
        {structure.name}
      </button>
    </div>
  );
}
function SiteDetailView({ site, handleEntityClick }) {
  console.log("CLICK ON SITE", site);

  return (
    <div>
      <p>{site.fromFile2.name}</p>
      {site.structures?.structure && (
        <>
          {Array.isArray(site.structures?.structure) ? (
            site.structures?.structure.map((s, i) => (
              <div key={i}>
                <StructureDetailView
                  structure={s}
                  isTopLevel={false}
                  handleEntityClick={handleEntityClick}
                />
              </div>
            ))
          ) : (
            <StructureDetailView
              handleEntityClick={handleEntityClick}
              structure={site.structures?.structure}
              isTopLevel={false}
            />
          )}
        </>
      )}
    </div>
  );
}

function EntityDetailsView({ entity, figures, books, handleEntityClick }) {
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
            books={books}
            handleEntityClick={handleEntityClick}
          />
        )}

        {book && (
          <BookDetailView
            book={book}
            isTopLevel={true}
            figures={figures}
            books={books}
            handleEntityClick={handleEntityClick}
          />
        )}

        {site && (
          <SiteDetailView
            site={site}
            isTopLevel={true}
            figures={figures}
            books={books}
            handleEntityClick={handleEntityClick}
          />
        )}
      </div>
    </div>
  );
}

export default App;

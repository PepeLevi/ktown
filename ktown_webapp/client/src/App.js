// src/App.jsx
import React, { useState, useEffect } from "react";
import WorldMap from "./worldMap";
import JourneyVerticalProgress from "./progressBar";
import RichBookContent from "./RichBookContent";

function createSelectedEntity(kind, payload) {
  return {
    kind,
    [kind]: payload,
    id: payload?.id ?? null,
    name: payload?.name ?? null,
  };
}

function App() {
  const [worldData, setWorldData] = useState(null);
  const [status, setStatus] = useState("Requesting world data from server...");
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [figures, setFigures] = useState([]);
  const [books, setBooks] = useState([]);
  const [level, setLevel] = React.useState(5);

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
        if (cell.sites.length > 0) {
          for (let si = 0; si < cell.sites.length; si++) {
            const site = cell.sites[si];

            if (site.structures) {
              for (let sti = 0; sti < site.structures.length; sti++) {
                const structure = site.structures[sti];

                if (structure.inhabitant.length > 0) {
                  for (let ii = 0; ii < structure.inhabitant.length; ii++) {
                    const figure = structure.inhabitant[ii];

                    temp_figures.push(figure);

                    if (figure.books) {
                      console.log("has figure with books", figure);

                      for (let bi = 0; bi < figure.books.length; bi++) {
                        const book = figure.books[bi];
                        temp_books.push(book);
                      }
                    }
                  }
                }
              }
            }
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

  useEffect(() => {
    fetchWorldData();
    // backendUrl is constant, so no need to add it to deps
  }, []);

  const handleEntityClick = (entity) => {
    setSelectedEntity(entity);
    setSelectedCell(null);

    if (entity.kind === "cell") {
      setLevel(5);
    }
    if (entity.kind === "site") {
      setLevel(4);
    }
    if (entity.kind === "structure") {
      setLevel(3);
    }
    if (entity.kind === "figure") {
      setLevel(1);
    }
    if (entity.kind === "book") {
      setLevel(0);
    }

    console.log("click entity", entity, level);
  };

  return (
    <div className="app">
      <div className="progressBar">
        <JourneyVerticalProgress level={level} />
      </div>
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
        <>
          <p className="cat_headline">figure sphere</p>
          <div className="flex-row-full">
            {Array.isArray(figure.sphere) &&
              figure.sphere.map((s, i) => <p key={i}>{s}</p>)}
          </div>
        </>
      )}

      {figure.books && isTopLevel && (
        <>
          <p className="cat_headline">books</p>
          {normalizeToArray(figure.books).map((b, i) => (
            <div key={i}>
              <BookDetailView
                book={b}
                isTopLevel={false}
                figures={figures}
                books={books}
                handleEntityClick={handleEntityClick}
              />
            </div>
          ))}
        </>
      )}

      {figure.hf_link && isTopLevel && (
        <>
          <p className="cat_headline">connections</p>
          <div className="flex-column subFigures">
            {normalizeToArray(figure.hf_link).length > 0 &&
              normalizeToArray(figure.hf_link).map((s, i) => (
                <>
                  {figures[s.hfid] ? (
                    <button
                      onClick={() => {
                        handleEntityClick(
                          createSelectedEntity("figure", figures[s.hfid])
                        );
                      }}
                      key={i}
                      className={s.link_type + " subFigure"}
                    >
                      <p>{s.link_type}</p>
                      <FigureDetailView
                        figure={figures[s.hfid]}
                        isTopLevel={false}
                        figures={figures}
                        books={books}
                        handleEntityClick={handleEntityClick}
                      />
                    </button>
                  ) : null}
                </>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
function BookDetailView({
  book,
  isTopLevel,
  figures,
  books,
  handleEntityClick,
}) {
  if (!book) {
    return null;
  }

  return (
    <div className="book">
      <button
        className="flex-row-full"
        onClick={() => {
          handleEntityClick(createSelectedEntity("book", book));
        }}
      >
        <p>{book.title}</p>
        <p>is a book</p>
      </button>

      {/* <p className="cat_headline">book content:</p> */}

      {/* ⬇️ Use rich renderer instead of plain <p> */}
      <div className="book-content">
        <RichBookContent
          text={book?.raw?.text_content}
          handleEntityClick={handleEntityClick}
          createSelectedEntity={createSelectedEntity}
        />
      </div>

      {figures[book.author_hfid] && isTopLevel && (
        <>
          {/* <p className="cat_headline">book author:</p> */}
          <FigureDetailView
            figure={figures[book.author_hfid]}
            isTopLevel={false}
            figures={figures}
            books={books}
          />
        </>
      )}
    </div>
  );
}

// Helper function to normalize values to arrays
const normalizeToArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

function StructureDetailView({ structure, handleEntityClick, books, figures }) {
  // Normalize inhabitant to array (can be single object or array)
  const inhabitants = normalizeToArray(
    structure.inhabitant || structure.inhabitants
  );

  return (
    <div>
      <button
        onClick={() => {
          handleEntityClick(createSelectedEntity("structure", structure));
        }}
      >
        {structure.name}
      </button>

      {inhabitants.length > 0 && (
        <>
          <p className="cat_headline">structure inhabitant:</p>
          {inhabitants.map((si, i) => (
            <button
              key={i}
              onClick={() => {
                handleEntityClick(createSelectedEntity("figure", si));
              }}
            >
              <FigureDetailView
                figure={si}
                figures={figures}
                isTopLevel={true}
                books={books}
                handleEntityClick={handleEntityClick}
              />
            </button>
          ))}
        </>
      )}
    </div>
  );
}
function SiteDetailView({ site, handleEntityClick, figures, books }) {
  return (
    <div>
      <p>{site.fromFile2.name}</p>
      {site.structures && (
        <>
          {Array.isArray(site.structures) ? (
            site.structures.map((s, i) => (
              <div key={i}>
                <StructureDetailView
                  structure={s}
                  isTopLevel={false}
                  handleEntityClick={handleEntityClick}
                  figures={figures}
                  books={books}
                />
              </div>
            ))
          ) : (
            <StructureDetailView
              handleEntityClick={handleEntityClick}
              structure={site.structures}
              isTopLevel={false}
              figures={figures}
              books={books}
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

      {mainTexture && (
        <div className="texture-previews">
          <TexturePreview label="Entity texture" src={mainTexture} />
          {siteTextureUrl && siteTextureUrl !== mainTexture && (
            <TexturePreview label="Site texture" src={siteTextureUrl} />
          )}
          {regionTextureUrl && regionTextureUrl !== mainTexture && (
            <TexturePreview label="Region texture" src={regionTextureUrl} />
          )}
        </div>
      )}

      <div className="flex-row-full"></div>
      <div className="specs">
        {kind === "figure" && (
          <FigureDetailView
            figure={figure}
            figures={figures}
            isTopLevel={true}
            books={books}
            handleEntityClick={handleEntityClick}
          />
        )}

        {kind === "book" && (
          <BookDetailView
            book={book}
            isTopLevel={true}
            figures={figures}
            books={books}
            handleEntityClick={handleEntityClick}
          />
        )}

        {kind === "site" && (
          <SiteDetailView
            site={site}
            isTopLevel={true}
            figures={figures}
            books={books}
            handleEntityClick={handleEntityClick}
          />
        )}

        {kind === "structure" && (
          <StructureDetailView
            structure={structure}
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

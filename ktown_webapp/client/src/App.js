// src/App.jsx
import React, { useState, useEffect } from "react";
import WorldMap from "./worldMap";
import JourneyVerticalProgress from "./progressBar";
import RichBookContent from "./RichBookContent";
import CellPopup from "./CellPopup";

import "./App.css";

function createSelectedEntity(kind, payload) {
  const base = {
    kind,
    [kind]: payload, // e.g. entity.cell = payload when kind === "cell"
    id: payload?.id ?? null,
    name: payload?.name ?? null,
  };

  if (kind === "cell") {
    const x = payload?.x ?? payload?.cellCoords?.x;
    const y = payload?.y ?? payload?.cellCoords?.y;

    return {
      ...base,
      cellCoords: x != null && y != null ? { x, y } : null,
    };
  }

  return base;
}

function App() {
  const [worldData, setWorldData] = useState(null);
  const [allHistoricalEvents, setAllHistoricalEvents] = useState(null);
  const [status, setStatus] = useState("Requesting world data from server...");
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [figures, setFigures] = useState([]);
  const [books, setBooks] = useState([]);
  const [sites, setSites] = useState([]);
  const [level, setLevel] = React.useState(5);
  const [showLibrary, setShowLibrary] = useState(false);

  const [bookCells, setBookCells] = useState([]);
  const [currentBookCellIndex, setCurrentBookCellIndex] = useState(-1);

  const [shouldShowLoader, setShouldShowLoader] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [undergroundRegions, setUndergroundRegions] = useState([]);

  // Set this to your backend base URL if needed (e.g. "http://localhost:3000")
  const backendUrl = "";

  const fetchWorldData = async () => {
    setShouldShowLoader(true);
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
      const wd = data.worldData || data;

      if (!wd || !wd.cells || !wd.historical_events) {
        throw new Error("Invalid worldData format from server");
      }

      setWorldData({ cells: wd.cells });
      setAllHistoricalEvents(wd.historical_events);

      let temp_figures = {};
      let temp_books = {};
      let temp_bookCells = []; // NEW
      let temp_sites = {};
      let temp_undergroundRegions = [];

      wd.cells.forEach((cell) => {
        let cellHasBooks = false;

        if (cell.undergroundRegions && cell.undergroundRegions.length > 0) {
          for (let cu = 0; cu < cell.undergroundRegions.length; cu++) {
            const undergroundRegion = cell.undergroundRegions[cu];

            undergroundRegion.cellCoords = { x: cell.x, y: cell.y };
            temp_undergroundRegions.push(undergroundRegion);
          }
        }

        if (cell.sites && cell.sites.length > 0) {
          for (let si = 0; si < cell.sites.length; si++) {
            const site = cell.sites[si];
            site["cellCoords"] = { x: cell.x, y: cell.y };
            temp_sites[parseInt(site["id"])] = site;

            if (site.books) {
              const siteBooks = normalizeToArray(site.books);
              for (let sbi = 0; sbi < siteBooks.length; sbi++) {
                const book = siteBooks[sbi];

                if (book && book.author_hfid) {
                  book["cellCoords"] = { x: cell.x, y: cell.y };
                  temp_books[book.author_hfid] = book;
                  cellHasBooks = true; // NEW
                }
              }
            }

            if (site.historical_figures) {
              for (let hfi = 0; hfi < site.historical_figures.length; hfi++) {
                const hf = site.historical_figures[hfi];
                if (hf && hf.id) {
                  hf["cellCoords"] = { x: cell.x, y: cell.y };
                  temp_figures[hf.id] = hf;

                  // historical figure may have books
                  if (hf.books) {
                    const hfBooks = normalizeToArray(hf.books);
                    for (let bi = 0; bi < hfBooks.length; bi++) {
                      const book = hfBooks[bi];
                      if (book && book.author_hfid) {
                        book["cellCoords"] = { x: cell.x, y: cell.y };
                        temp_books[book.author_hfid] = book;
                        cellHasBooks = true; // NEW
                      }
                    }
                  }
                }
              }
            }

            if (site.structures) {
              const structures = Array.isArray(site.structures)
                ? site.structures
                : [site.structures];
              for (let sti = 0; sti < structures.length; sti++) {
                const structure = structures[sti];
                const inhabitants = normalizeToArray(
                  structure.historical_figures || structure.inhabitants
                );

                if (inhabitants.length > 0) {
                  for (let ii = 0; ii < inhabitants.length; ii++) {
                    const figure = inhabitants[ii];

                    if (figure && figure.id) {
                      figure["cellCoords"] = { x: cell.x, y: cell.y };
                      temp_figures[figure.id] = figure;

                      if (figure.books) {
                        const books = normalizeToArray(figure.books);
                        for (let bi = 0; bi < books.length; bi++) {
                          const book = books[bi];
                          if (book && book.author_hfid) {
                            book["cellCoords"] = { x: cell.x, y: cell.y };
                            temp_books[book.author_hfid] = book;
                            cellHasBooks = true; // NEW
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // If this cell has any books (via site/figure/structure), store it:
        if (cellHasBooks) {
          const composed = buildCellEntityFromCell(cell);
          temp_bookCells.push(composed); // ✅ composed entity
        }
      });

      setUndergroundRegions(temp_undergroundRegions);
      setFigures(temp_figures);
      setBooks(temp_books);
      setBookCells(temp_bookCells); // NEW
      setSites(temp_sites);
      setCurrentBookCellIndex(-1); // NEW

      setSelectedCell(null);
      setSelectedEntity(null);
      setStatus(`World data loaded: ${wd.cells.length} cell(s).`);

      console.log("has sites", sites);

      setHasLoaded(true);
    } catch (err) {
      console.error(err);
      setStatus("Error loading world data.");
      alert("Error: " + err.message);
      // Keep loader visible even on error so user can see the welcome message
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    fetchWorldData();
    // backendUrl is constant, so no need to add it to deps
  }, []);

  function buildCellEntityFromCell(originalCell) {
    if (!originalCell) return null;

    return {
      kind: "cell",
      name: `Cell (${originalCell.x}, ${originalCell.y})`,
      type: originalCell.region?.type || null,
      cellCoords: { x: originalCell.x, y: originalCell.y },
      cell: originalCell,
      region: originalCell.region,
      sites: originalCell.sites || [],
      undergroundRegions: originalCell.undergroundRegions || [],
      historical_figures: originalCell.historical_figures || [],
      written_contents: originalCell.written_contents || [],
    };
  }

  const goToNextBookCell = () => {
    if (!bookCells.length) return;

    setCurrentBookCellIndex((prev) => {
      const nextIndex = (prev + 1 + bookCells.length) % bookCells.length;
      const entity = bookCells[nextIndex]; // already composed

      // Same as clicking a cell
      handleEntityClick(entity);

      return nextIndex;
    });
  };

  const [popupData, setPopupData] = useState(null);

  const handleEntityClick = (entity, clickEvent) => {
    setSelectedEntity(entity);
    setSelectedCell(null);

    // Get click position for popup
    const x =
      clickEvent?.clientX ||
      clickEvent?.nativeEvent?.clientX ||
      window.innerWidth / 2;
    const y =
      clickEvent?.clientY ||
      clickEvent?.nativeEvent?.clientY ||
      window.innerHeight / 2;

    // Show popup instead of details panel
    setPopupData({
      cellData: entity,
      position: { x, y },
    });

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
      setLevel(2);
    }
    if (entity.kind === "book") {
      setLevel(0);
    }

    console.log("click entity", entity, level);
  };

  const handleClosePopup = () => {
    setPopupData(null);
  };

  return (
    <div className="app">
      <div className="progressBar">
        <JourneyVerticalProgress level={level} />
        <div
          className={`library-logo-container ${
            shouldShowLoader ? "library-logo-disabled" : ""
          }`}
        >
          <img
            src={require("./library-logo.png")}
            alt="Library"
            className="library-logo"
            onClick={() => !shouldShowLoader && setShowLibrary(true)}
            style={{
              cursor: shouldShowLoader ? "not-allowed" : "pointer",
              background: "transparent",
              backgroundColor: "transparent",
              opacity: shouldShowLoader ? 0.3 : 1,
            }}
          />
        </div>
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

        <div className="overlay"></div>
      </main>

      {shouldShowLoader && (
        <WelcomeScreen
          hasLoaded={hasLoaded}
          onClose={() => setShouldShowLoader(false)}
        />
      )}

      {showLibrary && (
        <LibraryWindow
          books={Object.values(books)}
          figures={figures}
          sites={sites}
          onClose={() => setShowLibrary(false)}
          handleEntityClick={handleEntityClick}
          createSelectedEntity={createSelectedEntity}
        />
      )}

      {/* Popup instead of details panel - rendered after library to ensure it's on top */}
      {popupData && (
        <CellPopup
          entity={popupData.cellData}
          position={popupData.position}
          onClose={handleClosePopup}
          figures={figures}
          books={books}
          sites={sites}
          allHistoricalEvents={allHistoricalEvents}
          handleEntityClick={handleEntityClick}
          createSelectedEntity={createSelectedEntity}
          undergroundRegions={undergroundRegions}
        />
      )}
    </div>
  );
}

/* ------- Library Window Component ------- */

function LibraryWindow({
  books,
  figures,
  sites,
  onClose,
  handleEntityClick,
  createSelectedEntity,
}) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [viewingBook, setViewingBook] = React.useState(null);

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (viewingBook) {
        // When viewing book content, only Escape to go back
        if (e.key === "Escape") {
          setViewingBook(null);
        }
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(books.length - 1, prev + 1));
          break;
        case "Enter":
          e.preventDefault();
          if (books[selectedIndex]) {
            setViewingBook(books[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, books, viewingBook, onClose]);

  return (
    <div className="library-overlay" onClick={onClose}>
      <div className="library-window" onClick={(e) => e.stopPropagation()}>
        <button className="library-close" onClick={onClose}>
          ×
        </button>

        <div className="library-content">
          {!viewingBook ? (
            <>
              <p className="library-welcome">welcome to Ktown library!</p>
              <div className="library-list">
                {books.length > 0 ? (
                  books.map((book, index) => (
                    <div
                      key={book.id || index}
                      className={`library-item ${
                        index === selectedIndex ? "library-item-selected" : ""
                      }`}
                      onClick={() => setViewingBook(book)}
                    >
                      {book.title || `Book ${book.id || index}`}
                    </div>
                  ))
                ) : (
                  <p style={{ color: "#666" }}>No books found</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="library-book-header">
                <button
                  className="library-back"
                  onClick={() => setViewingBook(null)}
                >
                  ← Back
                </button>
                <h3 className="library-book-title">
                  {viewingBook.title || `Book ${viewingBook.id}`}
                </h3>
              </div>
              <div className="library-book-content">
                <RichBookContent
                  text={viewingBook.text_content}
                  handleEntityClick={handleEntityClick}
                  createSelectedEntity={createSelectedEntity}
                  figures={figures}
                  sites={sites}
                  books={books}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------- Welcome Screen Component ------- */

function WelcomeScreen({ hasLoaded, onClose }) {
  return (
    <div
      className={`welcome-overlay ${
        !hasLoaded ? "welcome-overlay-loading" : ""
      }`}
    >
      <div className="welcome-popup">
        {hasLoaded && (
          <button className="welcome-close" onClick={onClose}>
            ×
          </button>
        )}

        <div className="welcome-content">
          <div className="welcome-text">
            <p>welcome to Ktown!</p>

            <p>
              Ktown is all of these things at once: a phenomenon, an assemblage,
              a cognitive system, a space of reasons, a duration, and a critique
              of the given.
            </p>

            <p>
              The world is visually text-based, with its elements and characters
              represented by numbers, letters and symbols, all inserted into a
              tile-based graphic. The map uses these symbols to represent
              different data, once we have this raw information mediated by
              artificial intelligence, we parse the data to integrate it into
              the map interface. It uses a signifying layer based on characters
              and layers. Using a fractal map with an interactive zoom.
            </p>

            <p>
              The restructuring and semantic alteration of data is the
              activation itself. The transformations applied to data here are
              not only related to its activation (the transition from data to
              information), but also to the production of practical and
              linguistic content that operates in the function of information as
              a process.
            </p>

            <p>
              The general passive dynamics of the ordinary spectator, of
              intelligibility and cognition (of differentiating and linking,
              that is, understanding the world around them) become active, as
              this is the central issue in KTOWN's gameplay dynamics. The player
              must interact with a generated (artificial) environment, and
              through this navigation and interactivity, they will be able to
              build links and distinguish differences to experimentally
              construct meaning through maps and text.
            </p>
          </div>

          {!hasLoaded && (
            <div className="welcome-loading">
              <div className="welcome-progress-bar">
                <div className="welcome-progress-fill"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to normalize values to arrays
const normalizeToArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

export default App;

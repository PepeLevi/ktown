// src/App.jsx
import React, { useState, useEffect } from "react";
import WorldMap from "./worldMap";
import JourneyVerticalProgress from "./progressBar";
import RichBookContent from "./RichBookContent";
import CellPopup from "./CellPopup";

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
  const [allHistoricalEvents, setAllHistoricalEvents] = useState(null)
  const [status, setStatus] = useState("Requesting world data from server...");
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [figures, setFigures] = useState([]);
  const [books, setBooks] = useState([]);
  const [sites, setSites] = useState([]);
  const [level, setLevel] = React.useState(5);

  const [bookCells, setBookCells] = useState([]);
  const [currentBookCellIndex, setCurrentBookCellIndex] = useState(-1);

  const [shouldShowLoader, setShouldShowLoader] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Set this to your backend base URL if needed (e.g. "http://localhost:3000")
  const backendUrl = "";

  // const fetchWorldData = async () => {
  //   try {
  //     setStatus("Requesting world data from server...");

  //     const res = await fetch(`${backendUrl}/api/world-data`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //     });

  //     if (!res.ok) {
  //       const err = await res.json().catch(() => ({}));
  //       throw new Error(err.error || "Request failed");
  //     }

  //     const data = await res.json();

  //     // Support both { worldData: {...} } and direct worldData payloads
  //     const wd = data.worldData || data;

  //     if (!wd || !wd.cells) {
  //       throw new Error("Invalid worldData format from server");
  //     }

  //     setWorldData(wd);

  //     // Build figures and books as objects indexed by ID (for links like figures[s.hfid])
  //     let temp_figures = {};
  //     let temp_books = {};
  //     wd.cells.forEach((cell) => {
  //       // console.log("looks at cell directly from json", cell);

  //       if (cell.sites && cell.sites.length > 0) {
  //         for (let si = 0; si < cell.sites.length; si++) {
  //           const site = cell.sites[si];

  //           if (site.books) {
  //             for (let sbi = 0; sbi < site.books.length; sbi++) {
  //               const book = site.books[sbi];
  //               if (book && book.id) {
  //                 temp_books[book.id] = book;
  //               }
  //             }
  //           }

  //           if (site.historical_figures) {
  //             for (let hfi = 0; hfi < site.historical_figures.length; hfi++) {
  //               const hf = site.historical_figures[hfi];
  //               if (hf && hf.id) {
  //                 temp_figures[hf.id] = hf;
  //               }
  //             }
  //           }
  //           if (site.structures) {
  //             const structures = Array.isArray(site.structures)
  //               ? site.structures
  //               : [site.structures];
  //             for (let sti = 0; sti < structures.length; sti++) {
  //               const structure = structures[sti];
  //               const inhabitants = normalizeToArray(
  //                 structure.historical_figures || structure.inhabitants
  //               );

  //               if (inhabitants.length > 0) {
  //                 for (let ii = 0; ii < inhabitants.length; ii++) {
  //                   const figure = inhabitants[ii];

  //                   if (figure && figure.id) {
  //                     temp_figures[figure.id] = figure;

  //                     if (figure.books) {
  //                       // console.log("has figure with book", figure);

  //                       const books = normalizeToArray(figure.books);
  //                       for (let bi = 0; bi < books.length; bi++) {
  //                         const book = books[bi];
  //                         if (book && book.id) {
  //                           temp_books[book.id] = book;
  //                         }
  //                       }
  //                     }
  //                   }
  //                 }
  //               }
  //             }
  //           }
  //         }
  //       }
  //     });

  //     setFigures(temp_figures);
  //     setBooks(temp_books);

  //     setSelectedCell(null);
  //     setSelectedEntity(null);
  //     setStatus(`World data loaded: ${wd.cells.length} cell(s).`);
  //   } catch (err) {
  //     console.error(err);
  //     setStatus("Error loading world data.");
  //     alert("Error: " + err.message);
  //   }
  // };
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

      setWorldData({cells: wd.cells});
      setAllHistoricalEvents(wd.historical_events);

      let temp_figures = {};
      let temp_books = {};
      let temp_bookCells = []; // NEW
      let temp_sites = {};

      wd.cells.forEach((cell) => {
        let cellHasBooks = false; // NEW

        if (cell.sites && cell.sites.length > 0) {
          for (let si = 0; si < cell.sites.length; si++) {
            const site = cell.sites[si];
            site['cellCoords'] = { x: cell.x, y: cell.y };
            temp_sites[parseInt(site['id'])] = site

            if (site.books) {
              for (let sbi = 0; sbi < site.books.length; sbi++) {
                const book = site.books[sbi];

                if (book && book.author_hfid) {
                  book['cellCoords'] = { x: cell.x, y: cell.y };
                  temp_books[book.author_hfid] = book;
                  cellHasBooks = true; // NEW
                }
              }
            }

            if (site.historical_figures) {
              for (let hfi = 0; hfi < site.historical_figures.length; hfi++) {
                const hf = site.historical_figures[hfi];
                if (hf && hf.id) {
                  hf['cellCoords'] = { x: cell.x, y: cell.y };
                  temp_figures[hf.id] = hf;

                  // historical figure may have books
                  if (hf.books) {
                    const hfBooks = normalizeToArray(hf.books);
                    for (let bi = 0; bi < hfBooks.length; bi++) {
                      const book = hfBooks[bi];
                      if (book && book.author_hfid) {
                        book['cellCoords'] = { x: cell.x, y: cell.y };
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
                      figure['cellCoords'] = { x: cell.x, y: cell.y };
                      temp_figures[figure.id] = figure;

                      if (figure.books) {
                        const books = normalizeToArray(figure.books);
                        for (let bi = 0; bi < books.length; bi++) {
                          const book = books[bi];
                          if (book && book.author_hfid) {
                            book['cellCoords'] = { x: cell.x, y: cell.y };
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

      setFigures(temp_figures);
      setBooks(temp_books);
      setBookCells(temp_bookCells); // NEW
      setSites(temp_sites)
      setCurrentBookCellIndex(-1); // NEW

      setSelectedCell(null);
      setSelectedEntity(null);
      setStatus(`World data loaded: ${wd.cells.length} cell(s).`);

      setHasLoaded(true);
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
      setLevel(0);
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

        {/* Popup instead of details panel */}
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
          />
        )}

        {bookCells.length > 0 && (
          <button className="book-tour-button" onClick={goToNextBookCell}>
            -xx-
          </button>
        )}
      </main>

      {shouldShowLoader && (
        <div className="loader">
          {hasLoaded && (
            <button
              onClick={() => {
                setShouldShowLoader(false);
              }}
            >
              explore
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to normalize values to arrays
const normalizeToArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

export default App;

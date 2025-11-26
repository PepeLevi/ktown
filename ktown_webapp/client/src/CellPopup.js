// src/CellPopup.js
import React from "react";
import "./CellPopup.css";
import RichBookContent from "./RichBookContent";

const normalizeToArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

function FigureDetailView({
  figure,
  figures,
  isTopLevel,
  books,
  sites,
  allHistoricalEvents = [],
  handleEntityClick,
  createSelectedEntity,
  undergroundRegions = [],
}) {
  if (!figure) {
    return null;
  }

  const figureEvents =
    figure.historical_events?.map((id) =>
      allHistoricalEvents.find((e) => e.id == id)
    ) || [];

  return (
    <div className="figure-detail-view">
      {isTopLevel && <p>{figure.name}</p>}
      {figure.sphere && (
        <>
          {Array.isArray(figure.sphere) &&
            figure.sphere.map((s, i) => <span key={i}> {s}</span>)}
        </>
      )}

      {figure.books && isTopLevel && (
        <>
          {normalizeToArray(figure.books).map((b, i) => (
            <span key={i}>
              <BookDetailView
                book={b}
                isTopLevel={false}
                figures={figures}
                books={books}
                sites={sites}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
              />
            </span>
          ))}
        </>
      )}

      {figure.hf_link && isTopLevel && (
        <>
          {normalizeToArray(figure.hf_link).length > 0 ? (
            normalizeToArray(figure.hf_link).map((s, i) => (
              <React.Fragment key={i}>
                {figures[s.hfid] ? (
                  <>
                    <span
                      className="inline-entity-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        const entity = createSelectedEntity(
                          "figure",
                          figures[s.hfid]
                        );
                        const x = e.clientX || window.innerWidth / 2;
                        const y = e.clientY || window.innerHeight / 2;
                        handleEntityClick(entity, { clientX: x, clientY: y });
                      }}
                      style={{
                        color: 'var(--primary-color)',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {figures[s.hfid].name || `Figure ${s.hfid}`}
                    </span>
                    <FigureDetailView
                      figure={figures[s.hfid]}
                      isTopLevel={false}
                      figures={figures}
                      books={books}
                      sites={sites}
                      handleEntityClick={handleEntityClick}
                      createSelectedEntity={createSelectedEntity}
                    />
                  </>
                ) : null}
              </React.Fragment>
            ))
          ) : (
            <>
              {figures[figure.hf_link.hfid] ? (
                <>
                  <span
                    className="inline-entity-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      const entity = createSelectedEntity(
                        "figure",
                        figures[figure.hf_link.hfid]
                      );
                      const x = e.clientX || window.innerWidth / 2;
                      const y = e.clientY || window.innerHeight / 2;
                      handleEntityClick(entity, { clientX: x, clientY: y });
                    }}
                    style={{
                      color: 'var(--primary-color)',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    {figures[figure.hf_link.hfid].name || `Figure ${figure.hf_link.hfid}`}
                  </span>
                  <FigureDetailView
                    figure={figures[figure.hf_link.hfid]}
                    isTopLevel={false}
                    figures={figures}
                    books={books}
                    sites={sites}
                    handleEntityClick={handleEntityClick}
                    createSelectedEntity={createSelectedEntity}
                  />
                </>
              ) : null}
            </>
          )}
        </>
      )}

      {/* Display historical events for the figure */}
      {figureEvents.length > 0 && isTopLevel && (
        <>
          {figureEvents.map((event, i) => {
            if (!event || !event.string) return;
            return (
              <div className="book-content">
                <RichBookContent
                  text={event.string}
                  handleEntityClick={handleEntityClick}
                  createSelectedEntity={createSelectedEntity}
                  figures={figures}
                  sites={sites}
                  books={books}
                />.
              </div>
            );
          })}
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
  sites,
  handleEntityClick,
  createSelectedEntity,
}) {
  if (!book) {
    return null;
  }

  return (
    <div className="book">
      {!isTopLevel && (
        <span
          className="inline-entity-link"
          onClick={(e) => {
            e.stopPropagation();
            const entity = createSelectedEntity("book", book);
            const x = e.clientX || window.innerWidth / 2;
            const y = e.clientY || window.innerHeight / 2;
            handleEntityClick(entity, { clientX: x, clientY: y });
          }}
          style={{
            color: 'var(--primary-color)',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {book.title}
        </span>
      )}

      <div className="book-content">
        <RichBookContent
          text={book?.text_content}
          handleEntityClick={handleEntityClick}
          createSelectedEntity={createSelectedEntity}
          figures={figures}
          sites={sites}
          books={books}
        />
      </div>

      {figures[book.author_hfid] && isTopLevel && (
        <FigureDetailView
          figure={figures[book.author_hfid]}
          isTopLevel={false}
          figures={figures}
          books={books}
          sites={sites}
          handleEntityClick={handleEntityClick}
          createSelectedEntity={createSelectedEntity}
        />
      )}
    </div>
  );
}

function StructureDetailView({
  structure,
  handleEntityClick,
  books,
  figures,
  sites = [],
  allHistoricalEvents = [],
  createSelectedEntity,
  isTopLevel,
  structures, // New prop for structures lookup
  site, // Optional site context for sites lookup
  undergroundRegions = [],
}) {
  // Normalize inhabitant to array (can be single object or array)
  const inhabitants = normalizeToArray(
    structure.historical_figures || structure.inhabitants
  );

  const structureEvents =
    structure.historical_events?.map((id) =>
      allHistoricalEvents.find((e) => e.id == id)
    ) || [];

  // Create sites lookup if site is available
  const sitesLookup = site && site.id ? { [site.id]: site } : {};

  return (
    <div>
      {!isTopLevel && (
        <span
          className="inline-entity-link"
          onClick={(e) => {
            e.stopPropagation();
            const entity = createSelectedEntity("structure", structure);
            const x = e.clientX || window.innerWidth / 2;
            const y = e.clientY || window.innerHeight / 2;
            handleEntityClick(entity, { clientX: x, clientY: y });
          }}
          style={{
            color: 'var(--primary-color)',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {structure.name}
        </span>
      )}

      {inhabitants.length > 0 && (
        <>
          {inhabitants.map((si, i) => (
            <span key={i}>
              <span
                className="inline-entity-link"
                onClick={(e) => {
                  e.stopPropagation();
                  const entity = createSelectedEntity("figure", si);
                  const x = e.clientX || window.innerWidth / 2;
                  const y = e.clientY || window.innerHeight / 2;
                  handleEntityClick(entity, { clientX: x, clientY: y });
                }}
                style={{
                  color: 'var(--primary-color)',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {si.name || `Figure ${si.id}`}
              </span>
              <FigureDetailView
                figure={si}
                figures={figures}
                isTopLevel={false}
                books={books}
                sites={sites}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
              />
            </span>
          ))}
        </>
      )}

      {/* Display historical events */}
      {structureEvents.length > 0 && (
        <>
          {structureEvents.map((event, i) => {
            if (!event || !event.string) return;
            return (
              <div className="book-content">
                <RichBookContent
                  text={event.string}
                  handleEntityClick={handleEntityClick}
                  createSelectedEntity={createSelectedEntity}
                  figures={figures}
                  sites={sites}
                  books={books}
                />.
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function SiteDetailView({
  site,
  handleEntityClick,
  figures,
  books,
  sites,
  allHistoricalEvents = [],
  createSelectedEntity,
  undergroundRegions = [],
}) {
  if (!site) {
    return null;
  }

  const siteEvents =
    site?.historical_events?.map((id) =>
      allHistoricalEvents.find((e) => e.id == id)
    ) || [];

  // Create sites lookup object with current site
  const sitesLookup = site && site.id ? { [site.id]: site } : {};

  return (
    <div>
      <span>{site.fromFile2?.name || site.fromFile1?.name || site.name}</span>

      {site.structures && (
        <>
          {Array.isArray(site.structures) ? (
            site.structures.map((s, i) => (
              <span key={i}>
                <StructureDetailView
                  structure={s}
                  isTopLevel={false}
                  handleEntityClick={handleEntityClick}
                  figures={figures}
                  books={books}
                  createSelectedEntity={createSelectedEntity}
                  structures={
                    site.structures
                      ? (Array.isArray(site.structures)
                          ? site.structures
                          : [site.structures]
                        ).reduce((acc, st) => {
                          if (st && st.id) acc[st.id] = st;
                          return acc;
                        }, {})
                      : null
                  }
                  site={site}
                  undergroundRegions={undergroundRegions}
                />
              </span>
            ))
          ) : (
            <StructureDetailView
              handleEntityClick={handleEntityClick}
              structure={site.structures}
              isTopLevel={false}
              figures={figures}
              books={books}
              createSelectedEntity={createSelectedEntity}
              structures={null}
              site={site}
              undergroundRegions={undergroundRegions}
            />
          )}
        </>
      )}

      {/* Display historical events for the site itself */}
      {siteEvents.length > 0 && (
        <>
          {siteEvents.map((event, i) => {
            if (!event || !event.string) return;
            return (
              <div className="book-content">
                <RichBookContent
                  text={event.string}
                  handleEntityClick={handleEntityClick}
                  createSelectedEntity={createSelectedEntity}
                  figures={figures}
                  sites={sites}
                  books={books}
                />.
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

export function getRandomRegionWithSameDepth(
  targetRegion,
  allRegions,
  sampleSize = 5
) {
  const targetDepth = targetRegion.depth;

  // infinite loop until we find a match
  while (true) {
    // randomly pick N regions
    const sample = getRandomSample(allRegions, sampleSize);

    // filter by depth
    const matches = sample.filter((r) => r.depth === targetDepth);

    // return a random match if any were found
    if (matches.length > 0) {
      return matches[Math.floor(Math.random() * matches.length)];
    } else {
      getRandomRegionWithSameDepth(targetRegion, allRegions, 5);
    }
  }
}

function getRandomSample(arr, n) {
  const result = [];
  const length = arr.length;

  for (let i = 0; i < n; i++) {
    const randomIndex = Math.floor(Math.random() * length);
    result.push(arr[randomIndex]);
  }
  return result;
}


function CellPopup({
  entity,
  position,
  onClose,
  figures,
  books,
  sites,
  undergroundRegions,
  allHistoricalEvents,
  handleEntityClick,
  createSelectedEntity,
}) {
  if (!entity) return null;

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
    writtenContent,
    undergroundRegion,
  } = entity;

  if (kind == "site" && !site) {
    console.log("fuck", entity);
  }

  const mainTexture = textureUrl || siteTextureUrl || regionTextureUrl || null;

  console.log("in detailview", entity, undergroundRegion);

  // Calculate popup position
  const calculatePosition = () => {
    const padding = 20; // <-- margin from all edges
    const maxWidth = 600;

    if (!position) {
      return {
        left: "50%",
        top: "40%",
        transform: "translate(-50%, -50%)",
      };
    }

    const x = position.x || window.innerWidth / 2;
    const y = position.y || window.innerHeight / 2;

    const offsetX = -50;
    const offsetY = -50;

    let left = x + offsetX;
    let top = y + offsetY;

    // --- Horizontal clamping ---
    const rightLimit = window.innerWidth - maxWidth - padding;
    if (left > rightLimit) left = rightLimit;
    if (left < padding) left = padding;

    // --- Vertical clamping ---
    // The popup’s height is unknown until rendered, so clamp based on viewport
    // This keeps the TOP of the popup on screen with at least padding
    const estimatedHeight = 400; // optionally adjust or measure dynamically
    const bottomLimit = window.innerHeight - estimatedHeight - padding;

    if (top > bottomLimit) top = bottomLimit;
    if (top < padding) top = padding;

    return {
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      transform: "none",
      maxHeight: `${window.innerHeight - top - 50}px`, // prevents it from falling off the page
    };
  };

  const style = calculatePosition();

  return (
    <div className="cell-popup-overlay" onClick={onClose}>
      <div
        className="cell-popup"
        onClick={(e) => e.stopPropagation()}
        style={style}
      >
        <button className="cell-popup-close" onClick={onClose}>
          ×
        </button>

        <div className="cell-popup-content">
          {cellCoords && (
            <p className="cell-coords">
              [{cellCoords.x}, {cellCoords.y}]
            </p>
          )}
          {kind === "undergroundRegion" ? (
            <p>{undergroundRegion?.type || type || "Underground Region"}</p>
          ) : (
            <p>{name || "Unknown"}</p>
          )}
          <div className="specs">
            {kind === "figure" && (
              <FigureDetailView
                figure={figure}
                figures={figures}
                isTopLevel={true}
                books={books}
                sites={sites}
                allHistoricalEvents={allHistoricalEvents}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
                undergroundRegions={undergroundRegions}
              />
            )}

            {kind === "writtenContent" && (
              <BookDetailView
                book={writtenContent}
                isTopLevel={true}
                figures={figures}
                books={books}
                sites={sites}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
              />
            )}

            {kind === "undergroundRegion" && (
              <div className="underground-region-link">
                <span
                  className="inline-entity-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    const entity = createSelectedEntity(
                      "undergroundRegion",
                      getRandomRegionWithSameDepth(
                        undergroundRegion,
                        undergroundRegions,
                        5
                      )
                    );
                    const x = e.clientX || window.innerWidth / 2;
                    const y = e.clientY || window.innerHeight / 2;
                    handleEntityClick(entity, { clientX: x, clientY: y });
                  }}
                  style={{
                    color: 'var(--primary-color)',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      color: "var(--cell-txt-color)",
                      transition: "color 0.15s"
                    }}
                    onMouseEnter={e =>
                      (e.currentTarget.style.color = "var(--primary-color)")
                    }
                    onMouseLeave={e =>
                      (e.currentTarget.style.color = "var(--cell-txt-color)")
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      width="1em"
                      height="1em"
                      style={{ marginRight: "0.4em", color: "inherit" }}
                      fill="currentColor"
                    >
                      <path
                        d="M5.5 3.5a.5.5 0 0 1 .5.5v6.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 1 1 .708-.708L5 10.293V4a.5.5 0 0 1 .5-.5z"
                      />
                    </svg>
                     
                  </span>
                </span>
              </div>
            )}

            {kind === "site" && (
              <SiteDetailView
                site={site}
                isTopLevel={true} //not being used rn. i think bc structure cant be non-top level yet
                figures={figures}
                books={books}
                sites={sites}
                allHistoricalEvents={allHistoricalEvents}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
                undergroundRegions={undergroundRegions}
              />
            )}

            {kind === "structure" && (
              <StructureDetailView
                structure={structure}
                isTopLevel={true}
                figures={figures}
                books={books}
                allHistoricalEvents={allHistoricalEvents}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
                structures={entity.structures}
                undergroundRegions={undergroundRegions}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CellPopup;

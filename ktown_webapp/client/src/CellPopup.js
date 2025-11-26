// src/CellPopup.js
import React from "react";
import "./CellPopup.css";
import RichBookContent from "./RichBookContent";

const normalizeToArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

function TexturePreview({ label, src }) {
  if (!src) return null;
  return <img src={src} alt={label} />;
}

function FigureDetailView({
  figure,
  figures,
  isTopLevel,
  books,
  sites,
  allHistoricalEvents = [],
  handleEntityClick,
  createSelectedEntity,
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
                sites={sites}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
              />
            </div>
          ))}
        </>
      )}

      {figure.hf_link && isTopLevel && (
        <>
          <p className="cat_headline">connections</p>
          <div className="flex-column subFigures">
            {normalizeToArray(figure.hf_link).length > 0 ? (
              normalizeToArray(figure.hf_link).map((s, i) => (
                <React.Fragment key={i}>
                  {figures[s.hfid] ? (
                    <button
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
                      className={s.link_type + " subFigure"}
                    >
                      <p>{s.link_type}</p>
                      <FigureDetailView
                        figure={figures[s.hfid]}
                        isTopLevel={false}
                        figures={figures}
                        books={books}
                        sites={sites}
                        handleEntityClick={handleEntityClick}
                        createSelectedEntity={createSelectedEntity}
                      />
                    </button>
                  ) : (
                    <p>hej {s.hfid}</p>
                  )}
                </React.Fragment>
              ))
            ) : (
              <>
                <p>hej {figure.hf_link.hfid}</p>
                <React.Fragment>
                  {figures[figure.hf_link.hfid] ? (
                    <button
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
                      className={s.link_type + " subFigure"}
                    >
                      <p>{s.link_type}</p>
                      <FigureDetailView
                        figure={figures[figure.hf_link.hfid]}
                        isTopLevel={false}
                        figures={figures}
                        books={books}
                        sites={sites}
                        handleEntityClick={handleEntityClick}
                        createSelectedEntity={createSelectedEntity}
                      />
                    </button>
                  ) : null}
                </React.Fragment>
              </>
            )}
          </div>
        </>
      )}

      {/* Display historical events for the figure */}
      {figureEvents.length > 0 && isTopLevel && (
        <>
          <p className="cat_headline">historical events:</p>
          {figureEvents.map((event, i) => {
            const eventData = typeof event === "object" ? event : { id: event };
            return (
              <div className="book-content">
                <RichBookContent
                  text={event.string}
                  handleEntityClick={handleEntityClick}
                  createSelectedEntity={createSelectedEntity}
                  figures={figures}
                  sites={sites}
                  books={books}
                />
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
        <button
          className="flex-row-full"
          onClick={(e) => {
            e.stopPropagation();
            const entity = createSelectedEntity("book", book);
            const x = e.clientX || window.innerWidth / 2;
            const y = e.clientY || window.innerHeight / 2;
            handleEntityClick(entity, { clientX: x, clientY: y });
          }}
        >
          <p>{book.title}</p>
        </button>
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
        <>
          <div className="flex-row-full"></div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const entity = createSelectedEntity(
                "figure",
                figures[book.author_hfid]
              );
              const x = e.clientX || window.innerWidth / 2;
              const y = e.clientY || window.innerHeight / 2;
              handleEntityClick(entity, { clientX: x, clientY: y });
            }}
          >
            <FigureDetailView
              figure={figures[book.author_hfid]}
              isTopLevel={false}
              figures={figures}
              books={books}
              sites={sites}
              handleEntityClick={handleEntityClick}
              createSelectedEntity={createSelectedEntity}
            />
          </button>
        </>
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            const entity = createSelectedEntity("structure", structure);
            const x = e.clientX || window.innerWidth / 2;
            const y = e.clientY || window.innerHeight / 2;
            handleEntityClick(entity, { clientX: x, clientY: y });
          }}
        >
          {structure.name}
        </button>
      )}

      {inhabitants.length > 0 && (
        <>
          <p className="cat_headline">structure inhabitant:</p>
          {inhabitants.map((si, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                const entity = createSelectedEntity("figure", si);
                const x = e.clientX || window.innerWidth / 2;
                const y = e.clientY || window.innerHeight / 2;
                handleEntityClick(entity, { clientX: x, clientY: y });
              }}
            >
              <FigureDetailView
                figure={si}
                figures={figures}
                isTopLevel={false}
                books={books}
                sites={sites}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
              />
            </button>
          ))}
        </>
      )}

      {/* Display historical events */}
      {structureEvents.length > 0 && (
        <>
          <p className="cat_headline">historical events:</p>
          {structureEvents
            .map((id) => ({ id }))
            .map((event, i) => {
              // If event is just an ID, we need to look it up
              // For now, we'll display it as-is and assume the full event data will be passed
              const eventData =
                typeof event === "object" ? event : { id: event };
              return (
                <div className="book-content">
                  <RichBookContent
                    text={event.string}
                    handleEntityClick={handleEntityClick}
                    createSelectedEntity={createSelectedEntity}
                    figures={figures}
                    sites={sites}
                    books={books}
                  />
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
      <p>{site.fromFile2?.name || site.fromFile1?.name || site.name}</p>

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
              createSelectedEntity={createSelectedEntity}
              structures={null}
              site={site}
            />
          )}
        </>
      )}

      {/* Display historical events for the site itself */}
      {siteEvents.length > 0 && (
        <>
          <p className="cat_headline">site historical events:</p>
          {siteEvents.map((event, i) => {
            const eventData = typeof event === "object" ? event : { id: event };
            return (
              <div className="book-content">
                <RichBookContent
                  text={event.string}
                  handleEntityClick={handleEntityClick}
                  createSelectedEntity={createSelectedEntity}
                  figures={figures}
                  sites={sites}
                  books={books}
                />
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
      console.log("has corresponding underground region", matches);

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

  if(kind == 'site' && !site){
    console.log('fuck', entity)
  }

  const mainTexture = textureUrl || siteTextureUrl || regionTextureUrl || null;

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

          <div className="flex-row-full"></div>
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
              <div>
                <button
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
                >
                  click to dig to cave
                </button>
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
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CellPopup;

// src/CellPopup.js
import React from "react";
import "./CellPopup.css";
import RichBookContent from "./RichBookContent";

const normalizeToArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

// Extract and display only links from historical events
function extractEventLinks(eventString, figures, sites, books, undergroundRegions, handleEntityClick, createSelectedEntity) {
  if (!eventString) return null;

  const links = [];
  
  // Parse HTML <a> tags
  const wrapperHtml = `<div>${eventString}</div>`;
  const parser = new DOMParser();
  const doc = parser.parseFromString(wrapperHtml, "text/html");
  const root = doc.body.firstChild;
  
  // Extract <a> tags
  const anchorTags = root.querySelectorAll("a");
  anchorTags.forEach((a) => {
    const href = a.getAttribute("href") || "";
    const match = href.match(/^([^/]+)\/(\d+)/);
    if (match) {
      const [, rawKind, idStr] = match;
      const id = Number(idStr);
      
      const kindMap = {
        historical_figure_id: "figure",
        site_id: "site",
        written_work_id: "book",
        structure_id: "structure",
      };
      
      const kind = kindMap[rawKind] || rawKind;
      links.push({ kind, id, rawKind });
    }
  });
  
  // Extract direct references like "hist_figure_id:123", "artifact_id:133", etc.
  const directRefPattern = /(\w+_id):(\d+)/g;
  let match;
  while ((match = directRefPattern.exec(eventString)) !== null) {
    const [, rawKind, idStr] = match;
    const id = Number(idStr);
    
    const kindMap = {
      hist_figure_id: "figure",
      historical_figure_id: "figure",
      site_id: "site",
      wc_id: "book",
      written_work_id: "book",
      artifact_id: "artifact",
      structure_id: "structure",
    };
    
    const kind = kindMap[rawKind] || rawKind;
    // Avoid duplicates
    if (!links.some(l => l.kind === kind && l.id === id)) {
      links.push({ kind, id, rawKind });
    }
  }
  
  // Render links
  return links.map((link, i) => {
    let entity = null;
    let displayName = null;
    
    switch (link.kind) {
      case "figure":
        entity = figures[link.id];
        displayName = entity?.name || `Figure ${link.id}`;
        break;
      case "site":
        entity = sites[link.id];
        displayName = entity?.fromFile2?.name || entity?.fromFile1?.name || entity?.name || `Site ${link.id}`;
        break;
      case "book":
        entity = books[link.id];
        displayName = entity?.title || `Book ${link.id}`;
        break;
      case "structure":
        // Structures are nested in sites, so we need to search
        entity = Object.values(sites || {}).find(site => {
          if (Array.isArray(site.structures)) {
            return site.structures.some(s => s.id === link.id);
          }
          return site.structures?.id === link.id;
        });
        if (entity) {
          const structure = Array.isArray(entity.structures) 
            ? entity.structures.find(s => s.id === link.id)
            : entity.structures;
          displayName = structure?.name || `Structure ${link.id}`;
        } else {
          displayName = `Structure ${link.id}`;
        }
        break;
      case "artifact":
        displayName = `Artifact ${link.id}`;
        break;
      default:
        displayName = `${link.kind} ${link.id}`;
    }
    
    // Handle underground regions - show type instead of name
    if (link.kind === "undergroundRegion" || (undergroundRegions && undergroundRegions[link.id])) {
      const undergroundRegion = undergroundRegions[link.id];
      entity = undergroundRegion;
      displayName = undergroundRegion?.type || `Underground Region ${link.id}`;
    }
    
    if (!entity && link.kind !== "artifact") {
      return null;
    }
    
    return (
      <span
        key={i}
        className="inline-entity-link"
        onClick={(e) => {
          e.stopPropagation();
          if (entity) {
            const selectedEntity = createSelectedEntity(link.kind, entity);
            const x = e.clientX || window.innerWidth / 2;
            const y = e.clientY || window.innerHeight / 2;
            handleEntityClick(selectedEntity, { clientX: x, clientY: y });
          }
        }}
        style={{
          color: 'var(--primary-color)',
          cursor: entity ? 'pointer' : 'default',
          textDecoration: entity ? 'underline' : 'none'
        }}
      >
        {displayName}
      </span>
    );
  }).filter(Boolean);
}

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
            const eventData = typeof event === "object" ? event : { id: event };
            const links = extractEventLinks(
              event.string,
              figures,
              sites,
              books,
              undergroundRegions,
              handleEntityClick,
              createSelectedEntity
            );
            return links && links.length > 0 ? (
              <span key={i}>{links}</span>
            ) : null;
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
            const eventData = typeof event === "object" ? event : { id: event };
            const links = extractEventLinks(
              event.string,
              figures,
              sites,
              books,
              undergroundRegions,
              handleEntityClick,
              createSelectedEntity
            );
            return links && links.length > 0 ? (
              <span key={i}>{links}</span>
            ) : null;
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
            const eventData = typeof event === "object" ? event : { id: event };
            const links = extractEventLinks(
              event.string,
              figures,
              sites,
              books,
              undergroundRegions,
              handleEntityClick,
              createSelectedEntity
            );
            return links && links.length > 0 ? (
              <span key={i}>{links}</span>
            ) : null;
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

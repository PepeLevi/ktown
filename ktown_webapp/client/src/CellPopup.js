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
  handleEntityClick,
  createSelectedEntity,
  historicalEvents, // Events passed from entity
}) {
  if (!figure) {
    return null;
  }

  // Get historical events from figure if available, or use passed events
  const figureEvents = historicalEvents || figure.historical_events || [];

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
            const eventData = typeof event === 'object' ? event : { id: event };
            return (
              <HistoricalEventView
                key={i}
                event={eventData}
                figures={figures}
                structures={null}
                sites={null}
                books={books}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
              />
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
              handleEntityClick={handleEntityClick}
              createSelectedEntity={createSelectedEntity}
            />
          </button>
        </>
      )}
    </div>
  );
}

// Parse HTML links from historical event text and create clickable elements
const parseHistoricalEventText = (text, figures, structures, handleEntityClick, createSelectedEntity) => {
  if (!text) return null;

  // Regular expression to match <a href="type/id">text</a> patterns
  const linkRegex = /<a\s+href=["']([^"']+)\/(\d+)["']>([^<]+)<\/a>/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }

    const linkType = match[1]; // e.g., "historical_figure_id", "structure_id"
    const linkId = match[2]; // e.g., "973"
    const linkText = match[3]; // e.g., "hf hyperlink"

    // Create clickable link based on type
    let entity = null;
    if (linkType === 'historical_figure_id' && figures[linkId]) {
      entity = createSelectedEntity("figure", figures[linkId]);
    } else if (linkType === 'structure_id' && structures && structures[linkId]) {
      entity = createSelectedEntity("structure", structures[linkId]);
    }

    parts.push({
      type: 'link',
      content: linkText,
      entity: entity,
      linkType: linkType,
      linkId: linkId,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last link
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  // If no links found, return original text
  if (parts.length === 0) {
    return <p>{text}</p>;
  }

  return (
    <p>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.content}</span>;
        } else if (part.type === 'link' && part.entity) {
          return (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                const x = e.clientX || window.innerWidth / 2;
                const y = e.clientY || window.innerHeight / 2;
                handleEntityClick(part.entity, { clientX: x, clientY: y });
              }}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'inherit', 
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
                margin: 0
              }}
            >
              {part.content}
            </button>
          );
        } else {
          // Link found but entity not available
          return <span key={i} style={{ textDecoration: 'underline' }}>{part.content} (ID: {part.linkId})</span>;
        }
      })}
    </p>
  );
};

// Parse event string to extract all reference fields
const parseEventString = (eventString) => {
  if (!eventString) return {};
  
  const references = {};
  // Match patterns like "field_name:value" or "field_name:value,"
  const fieldRegex = /(\w+):(-?\d+)/g;
  let match;
  
  while ((match = fieldRegex.exec(eventString)) !== null) {
    const fieldName = match[1];
    const fieldValue = match[2];
    // Only store if value is not -1 (which means "none" in Dwarf Fortress)
    if (fieldValue !== '-1') {
      references[fieldName] = fieldValue;
    }
  }
  
  return references;
};

// Component to display historical events
function HistoricalEventView({
  event,
  figures,
  structures,
  sites,
  books,
  handleEntityClick,
  createSelectedEntity,
}) {
  if (!event) return null;

  // Get event string (the main data field)
  const eventString = event.string || '';
  
  // Parse text content with links (if there's text_content or text field)
  const textContent = event.text_content || event.text || event.name || '';
  const parsedText = textContent ? parseHistoricalEventText(
    textContent,
    figures,
    structures,
    handleEntityClick,
    createSelectedEntity
  ) : null;

  // Parse the event string to extract all reference fields
  const eventFields = parseEventString(eventString);
  
  // Build references array from all possible fields
  const references = [];
  
  // Historical figure references
  const hfFields = [
    'hist_figure_id', 'hfid_target', 'seeker_hfid', 'target_hfid', 
    'gambler_hfid', 'group_hfid', 'group_1_hfid', 'group_2_hfid',
    'convicted_hfid', 'slayer_hfid', 'hf_id', 'hfid1', 'hfid2'
  ];
  
  hfFields.forEach(field => {
    if (eventFields[field] && figures[eventFields[field]]) {
      const hfId = eventFields[field];
      references.push({
        type: 'figure',
        id: hfId,
        field: field,
        entity: createSelectedEntity("figure", figures[hfId]),
        label: figures[hfId].name || `Figure ${hfId}`,
      });
    }
  });

  // Site references
  if (eventFields.site_id && sites && sites[eventFields.site_id]) {
    const siteId = eventFields.site_id;
    references.push({
      type: 'site',
      id: siteId,
      field: 'site_id',
      entity: createSelectedEntity("site", sites[siteId]),
      label: sites[siteId].name || `Site ${siteId}`,
    });
  }

  // Structure references
  if (eventFields.structure_id && structures && structures[eventFields.structure_id]) {
    const structId = eventFields.structure_id;
    references.push({
      type: 'structure',
      id: structId,
      field: 'structure_id',
      entity: createSelectedEntity("structure", structures[structId]),
      label: structures[structId].name || `Structure ${structId}`,
    });
  }

  // Written content references (wc_id)
  if (eventFields.wc_id && books) {
    // wc_id might map to book IDs - need to check how books are indexed
    const wcId = eventFields.wc_id;
    // Try to find book by ID in books object
    const book = Object.values(books).find(b => b.id === wcId || b.wc_id === wcId);
    if (book) {
      references.push({
        type: 'writtenContent',
        id: wcId,
        field: 'wc_id',
        entity: createSelectedEntity("writtenContent", book),
        label: book.title || `Written Content ${wcId}`,
      });
    }
  }

  // Artifact references (artifact_id)
  if (eventFields.artifact_id) {
    const artifactId = eventFields.artifact_id;
    references.push({
      type: 'artifact',
      id: artifactId,
      field: 'artifact_id',
      entity: null, // Artifacts might not be in the entity system yet
      label: `Artifact ${artifactId}`,
    });
  }

  // Entity/Civilization references (entity_id, civ_id, convicter_enid)
  const entityFields = ['entity_id', 'civ_id', 'convicter_enid'];
  entityFields.forEach(field => {
    if (eventFields[field]) {
      const entityId = eventFields[field];
      references.push({
        type: 'entity',
        id: entityId,
        field: field,
        entity: null, // Entities might not be in the entity system yet
        label: `${field}: ${entityId}`,
      });
    }
  });

  // Item references (slayer_item_id, slayer_shooter_item_id)
  const itemFields = ['slayer_item_id', 'slayer_shooter_item_id'];
  itemFields.forEach(field => {
    if (eventFields[field]) {
      const itemId = eventFields[field];
      references.push({
        type: 'item',
        id: itemId,
        field: field,
        entity: null,
        label: `${field}: ${itemId}`,
      });
    }
  });

  // Check if event has any content or references
  const hasContent = parsedText || eventString.trim().length > 0;
  const hasReferences = references.length > 0;
  
  // Don't show if event is empty and has no references
  if (!hasContent && !hasReferences) {
    return null;
  }

  return (
    <div style={{ marginBottom: '1rem', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}>
      {event.name && <p><strong>{event.name}</strong></p>}
      {parsedText}
      {eventString && !parsedText && (
        <p style={{ fontSize: '0.9em', color: '#666' }}>{eventString}</p>
      )}
      {hasReferences && (
        <>
          <p className="cat_headline">References:</p>
          {references.map((ref, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                if (ref.entity) {
                  const x = e.clientX || window.innerWidth / 2;
                  const y = e.clientY || window.innerHeight / 2;
                  handleEntityClick(ref.entity, { clientX: x, clientY: y });
                }
              }}
              style={{
                display: 'block',
                margin: '0.25rem 0',
                background: 'none',
                border: '1px solid #ccc',
                padding: '0.25rem',
                cursor: ref.entity ? 'pointer' : 'default',
                textAlign: 'left',
                width: '100%',
                opacity: ref.entity ? 1 : 0.7
              }}
            >
              {ref.label} ({ref.field}: {ref.id})
            </button>
          ))}
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
  createSelectedEntity,
  isTopLevel,
  historicalEvents, // New prop for historical events
  structures, // New prop for structures lookup
  site, // Optional site context for sites lookup
}) {
  // Normalize inhabitant to array (can be single object or array)
  const inhabitants = normalizeToArray(
    structure.historical_figures || structure.inhabitants
  );

  // Get historical events from structure if available
  const structureEvents = structure.historical_events || [];
  
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
                isTopLevel={true}
                books={books}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
              />
            </button>
          ))}
        </>
      )}

      {/* Display historical events */}
      {(structureEvents.length > 0 || (historicalEvents && historicalEvents.length > 0)) && (
        <>
          <p className="cat_headline">historical events:</p>
          {(historicalEvents || structureEvents.map(id => ({ id }))).map((event, i) => {
            // If event is just an ID, we need to look it up
            // For now, we'll display it as-is and assume the full event data will be passed
            const eventData = typeof event === 'object' ? event : { id: event };
            return (
              <HistoricalEventView
                key={i}
                event={eventData}
                figures={figures}
                structures={structures}
                sites={sitesLookup}
                books={books}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
              />
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
  createSelectedEntity,
  historicalEvents, // Events passed from entity
}) {
  // Get historical events from site if available, or use passed events
  const siteEvents = historicalEvents || site.historical_events || [];
  
  // Create sites lookup object with current site
  const sitesLookup = site && site.id ? { [site.id]: site } : {};

  return (
    <div>
      <p>{site.fromFile2?.name || site.fromFile1?.name || site.name}</p>
      
      {/* Display historical events for the site itself */}
      {siteEvents.length > 0 && (
        <>
          <p className="cat_headline">site historical events:</p>
          {siteEvents.map((event, i) => {
            const eventData = typeof event === 'object' ? event : { id: event };
            return (
               <HistoricalEventView
                 key={i}
                 event={eventData}
                 figures={figures}
                 structures={null}
                 sites={sitesLookup}
                 books={books}
                 handleEntityClick={handleEntityClick}
                 createSelectedEntity={createSelectedEntity}
               />
            );
          })}
        </>
      )}

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
                  historicalEvents={s.historical_events ? s.historical_events.map(id => ({ id })) : null}
                  structures={site.structures ? (Array.isArray(site.structures) ? site.structures : [site.structures]).reduce((acc, st) => {
                    if (st && st.id) acc[st.id] = st;
                    return acc;
                  }, {}) : null}
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
              historicalEvents={site.structures?.historical_events ? site.structures.historical_events.map(id => ({ id })) : null}
              structures={null}
              site={site}
            />
          )}
        </>
      )}
    </div>
  );
}

function CellPopup({
  entity,
  position,
  onClose,
  figures,
  books,
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
  } = entity;

  const mainTexture = textureUrl || siteTextureUrl || regionTextureUrl || null;

  // Calculate popup position
  const calculatePosition = () => {
    const padding = 20; // <-- margin from all edges
    const maxWidth = 600;

    if (!position) {
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const x = position.x || window.innerWidth / 2;
    const y = position.y || window.innerHeight / 2;

    const offsetX = -50;
    const offsetY = -20;

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

          {/* {mainTexture && (
            <div className="texture-previews">
              <TexturePreview label="Entity texture" src={mainTexture} />
              {siteTextureUrl && siteTextureUrl !== mainTexture && (
                <TexturePreview label="Site texture" src={siteTextureUrl} />
              )}
              {regionTextureUrl && regionTextureUrl !== mainTexture && (
                <TexturePreview label="Region texture" src={regionTextureUrl} />
              )}
            </div>
          )} */}

          <div className="flex-row-full"></div>
          <div className="specs">
            {kind === "figure" && (
              <FigureDetailView
                figure={figure}
                figures={figures}
                isTopLevel={true}
                books={books}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
                historicalEvents={entity.historicalEvents}
              />
            )}

            {kind === "writtenContent" && (
              <BookDetailView
                book={writtenContent}
                isTopLevel={true}
                figures={figures}
                books={books}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
              />
            )}

            {/* {kind === "cell" && (
              <SiteDetailView
                site={site}
                isTopLevel={true}
                figures={figures}
                books={books}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
              />
            )} */}

            {kind === "site" && (
              <SiteDetailView
                site={site}
                isTopLevel={true}
                figures={figures}
                books={books}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
                historicalEvents={entity.historicalEvents}
              />
            )}

            {kind === "structure" && (
              <StructureDetailView
                structure={structure}
                isTopLevel={true}
                figures={figures}
                books={books}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
                historicalEvents={entity.historicalEvents}
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

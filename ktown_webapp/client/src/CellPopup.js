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
}) {
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
            {normalizeToArray(figure.hf_link).length > 0 &&
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
                  ) : null}
                </React.Fragment>
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
  createSelectedEntity,
}) {
  if (!book) {
    return null;
  }

  return (
    <div className="book">
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
        <p>is a book</p>
      </button>

      <div className="book-content">
        <RichBookContent
          text={book?.raw?.text_content}
          handleEntityClick={handleEntityClick}
          createSelectedEntity={createSelectedEntity}
        />
      </div>

      {figures[book.author_hfid] && isTopLevel && (
        <>
          <FigureDetailView
            figure={figures[book.author_hfid]}
            isTopLevel={false}
            figures={figures}
            books={books}
            handleEntityClick={handleEntityClick}
            createSelectedEntity={createSelectedEntity}
          />
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
}) {
  // Normalize inhabitant to array (can be single object or array)
  const inhabitants = normalizeToArray(
    structure.historical_figures || structure.inhabitants
  );

  return (
    <div>
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
    </div>
  );
}

function SiteDetailView({
  site,
  handleEntityClick,
  figures,
  books,
  createSelectedEntity,
}) {
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
    book,
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
                createSelectedEntity={createSelectedEntity}
              />
            )}

            {kind === "book" && (
              <BookDetailView
                book={book}
                isTopLevel={true}
                figures={figures}
                books={books}
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
              />
            )}

            {kind === "site" && (
              <SiteDetailView
                site={site}
                isTopLevel={true}
                figures={figures}
                books={books}
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
                handleEntityClick={handleEntityClick}
                createSelectedEntity={createSelectedEntity}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CellPopup;

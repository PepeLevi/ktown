import React, { useMemo } from "react";

export default function RichBookContent({
  text,
  handleEntityClick,
  createSelectedEntity,
  figures,
  sites,
  books
}) {
  const content = useMemo(() => {
    if (!text) return null;

    // Wrap in a root so we always have one parent
    const wrapperHtml = `<div>${text}</div>`;
    const parser = new DOMParser();
    const doc = parser.parseFromString(wrapperHtml, "text/html");
    const root = doc.body.firstChild;

    const convertNode = (node, keyPrefix = "n") => {
      if (!node) return null;

      // Text node
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      // Element node
      if (node.nodeType === Node.ELEMENT_NODE) {
        const children = [];
        for (let i = 0; i < node.childNodes.length; i++) {
          children.push(convertNode(node.childNodes[i], `${keyPrefix}-${i}`));
        }

        const key = keyPrefix;

        const tag = node.nodeName.toLowerCase();

        if (tag === "br") {
          return <br key={key} />;
        }

        if (tag === "a") {
          const href = node.getAttribute("href") || "";
          const label = node.textContent || href;
          const entityInfo = parseHrefToEntityInfo(href, label);

          return (
            <InlineEntityButton
              entityInfo={entityInfo}
              handleEntityClick={handleEntityClick}
              createSelectedEntity={createSelectedEntity}
              figures={figures}
              sites={sites}
              books={books}
            />
          );
        }

        // Basic mapping for common tags; others just become <span>
        const commonTagMap = {
          p: "p",
          strong: "strong",
          b: "b",
          em: "em",
          i: "i",
          h1: "h1",
          h2: "h2",
          h3: "h3",
          h4: "h4",
          h5: "h5",
          h6: "h6",
          ul: "ul",
          ol: "ol",
          li: "li",
        };

        const Component = commonTagMap[tag] || "span";

        return <Component key={key}>{children}</Component>;
      }

      return null;
    };

    // Convert children of the wrapper <div>
    const result = [];
    for (let i = 0; i < root.childNodes.length; i++) {
      result.push(convertNode(root.childNodes[i], `root-${i}`));
    }

    return result;
  }, [text, handleEntityClick]);

  return <>{content}</>;
}

function parseHrefToEntityInfo(href, label) {
  // expected pattern like "historical_figure_id/2986"
  const match = href.match(/^([^/]+)\/(\d+)/);
  if (!match) return null;

  const [, rawKind, idStr] = match;
  const id = Number(idStr);

  // Map raw types to your app's "kind" values
  const kindMap = {
    historical_figure_id: "figure",
    civilization_id: "civilization",
    site_id: "site",
    written_work_id: "book"
  };

  const kind = kindMap[rawKind] || rawKind;

  return {
    id,
    kind,
    rawKind,
    name: label || href,
  };
}

function findEntity(kind, id, figures, sites, books, handleEntityClick, createSelectedEntity){
  console.log("finding entity")
  console.log(kind, id)

  // find actual entity
  // debugger;
  switch(kind){
    case "figure":
      handleEntityClick(createSelectedEntity("figure", figures[id]));
      break;
    case "site":
      handleEntityClick(createSelectedEntity("site", sites[id]));
      break;
    case "book":
      handleEntityClick(createSelectedEntity("book", books[id]));
      break;
  }  
}

function InlineEntityButton({
  entityInfo,
  handleEntityClick,
  createSelectedEntity,
  figures,
  sites,
  books
}) {
  if (!entityInfo) return null;

  const { kind, id, name } = entityInfo;

  return (
    <button
      type="button"
      className="inline-entity-button"
      onClick={() => {
        findEntity(kind, id, figures, sites, books, handleEntityClick, createSelectedEntity)
      }}
    >
      {name}
    </button>
  );
}

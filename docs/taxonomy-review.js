const SNAPSHOT_URL = window.__SNAPSHOT_URL__ || `./data/book3_mapping_snapshot.json?v=2026-04-30-4`;

const state = {
  taxonomy: [],
  rows: [],
  mappedRows: [],
  groupedTree: new Map(),
  selectedNodeId: null,
  treeSearch: "",
  cardSearch: "",
  expandedL1: new Set(),
  expandedL2: new Set()
};

const elements = {
  l3Count: document.getElementById("l3Count"),
  mappedCount: document.getElementById("mappedCount"),
  treeSearch: document.getElementById("treeSearch"),
  cardSearch: document.getElementById("cardSearch"),
  treeHint: document.getElementById("treeHint"),
  treeRoot: document.getElementById("treeRoot"),
  detailTitle: document.getElementById("detailTitle"),
  detailPath: document.getElementById("detailPath"),
  detailCount: document.getElementById("detailCount"),
  cardGrid: document.getElementById("cardGrid")
};

initialize();

async function initialize() {
  const response = await fetch(SNAPSHOT_URL, { cache: "no-store" });
  const snapshot = await response.json();
  state.taxonomy = snapshot.taxonomy;
  state.rows = snapshot.backendRows || [];
  state.mappedRows = state.rows.filter((row) => Array.isArray(row.mappingIds) && row.mappingIds.length);
  state.selectedNodeId = snapshot.taxonomy[0]?.nodeId ?? null;

  for (const node of state.taxonomy) {
    state.expandedL1.add(node.l1);
    state.expandedL2.add(`${node.l1}__${node.l2}`);
  }

  buildTree();
  bindEvents();
  render();
}

function bindEvents() {
  elements.treeSearch.addEventListener("input", (event) => {
    state.treeSearch = event.target.value.trim().toLowerCase();
    render();
  });

  elements.cardSearch.addEventListener("input", (event) => {
    state.cardSearch = event.target.value.trim().toLowerCase();
    render();
  });
}

function buildTree() {
  const grouped = new Map();

  for (const node of state.taxonomy) {
    if (!grouped.has(node.l1)) {
      grouped.set(node.l1, new Map());
    }

    const l2Map = grouped.get(node.l1);
    if (!l2Map.has(node.l2)) {
      l2Map.set(node.l2, []);
    }

    l2Map.get(node.l2).push(node);
  }

  state.groupedTree = grouped;
}

function getMappedRowsForNode(nodeId) {
  return state.mappedRows.filter((row) => row.mappingIds.includes(nodeId));
}

function getVisibleTree() {
  const query = state.treeSearch;
  if (!query) {
    return state.groupedTree;
  }

  const filtered = new Map();

  for (const [l1, l2Map] of state.groupedTree.entries()) {
    const l1Matches = l1.toLowerCase().includes(query);
    const keptL2 = new Map();

    for (const [l2, nodes] of l2Map.entries()) {
      const l2Matches = l2.toLowerCase().includes(query);
      const matchedNodes = nodes.filter((node) => {
        return (
          l1Matches ||
          l2Matches ||
          node.l3.toLowerCase().includes(query) ||
          node.nodeId.toLowerCase().includes(query)
        );
      });

      if (matchedNodes.length) {
        keptL2.set(l2, matchedNodes);
      }
    }

    if (keptL2.size) {
      filtered.set(l1, keptL2);
    }
  }

  return filtered;
}

function toggleL1(l1) {
  if (state.expandedL1.has(l1)) {
    state.expandedL1.delete(l1);
  } else {
    state.expandedL1.add(l1);
  }
  renderTree();
}

function toggleL2(l1, l2) {
  const key = `${l1}__${l2}`;
  if (state.expandedL2.has(key)) {
    state.expandedL2.delete(key);
  } else {
    state.expandedL2.add(key);
  }
  renderTree();
}

function render() {
  elements.l3Count.textContent = String(state.taxonomy.length);
  elements.mappedCount.textContent = String(state.rows.length);
  renderTree();
  renderCards();
}

function renderTree() {
  const visibleTree = getVisibleTree();
  elements.treeRoot.innerHTML = "";

  for (const [l1, l2Map] of visibleTree.entries()) {
    const l1Rows = [...l2Map.values()].flat().reduce((sum, node) => sum + getMappedRowsForNode(node.nodeId).length, 0);
    const l1Section = document.createElement("section");
    l1Section.className = "tree-l1";

    const l1Button = document.createElement("button");
    l1Button.className = "tree-toggle";
    l1Button.type = "button";
    l1Button.addEventListener("click", () => toggleL1(l1));
    l1Button.innerHTML = `
      <div class="tree-toggle-row">
        <div class="tree-text">
          <span class="tree-name">${escapeHtml(l1)}</span>
          <div class="tree-caption">${l1Rows} mapped BCATs</div>
        </div>
        <span class="badge">${l1Rows}</span>
      </div>
    `;
    l1Section.appendChild(l1Button);

    if (state.expandedL1.has(l1)) {
      const l1Children = document.createElement("div");
      l1Children.className = "tree-children";

      for (const [l2, nodes] of l2Map.entries()) {
        const l2Rows = nodes.reduce((sum, node) => sum + getMappedRowsForNode(node.nodeId).length, 0);
        const l2Section = document.createElement("section");
        l2Section.className = "tree-l2";

        const l2Button = document.createElement("button");
        l2Button.className = "tree-toggle";
        l2Button.type = "button";
        l2Button.addEventListener("click", () => toggleL2(l1, l2));
        l2Button.innerHTML = `
          <div class="tree-toggle-row">
            <div class="tree-text">
              <span class="tree-name">${escapeHtml(l2)}</span>
              <div class="tree-caption">${l2Rows} mapped BCATs</div>
            </div>
            <span class="badge">${l2Rows}</span>
          </div>
        `;
        l2Section.appendChild(l2Button);

        if (state.expandedL2.has(`${l1}__${l2}`)) {
          const l2Children = document.createElement("div");
          l2Children.className = "tree-children";

          for (const node of nodes) {
            const count = getMappedRowsForNode(node.nodeId).length;
            const button = document.createElement("button");
            button.className = `tree-l3${state.selectedNodeId === node.nodeId ? " selected" : ""}`;
            button.type = "button";
            button.addEventListener("click", () => {
              state.selectedNodeId = node.nodeId;
              render();
            });
            button.innerHTML = `
              <div class="tree-toggle-row">
                <div class="tree-text">
                  <span class="tree-l3-title">${escapeHtml(node.l3)}</span>
                  <div class="tree-subtitle">${escapeHtml(node.nodeId)}</div>
                </div>
                <span class="badge">${count}</span>
              </div>
            `;
            l2Children.appendChild(button);
          }

          l2Section.appendChild(l2Children);
        }

        l1Children.appendChild(l2Section);
      }

      l1Section.appendChild(l1Children);
    }

    elements.treeRoot.appendChild(l1Section);
  }
}

function renderCards() {
  const selectedNode = state.taxonomy.find((node) => node.nodeId === state.selectedNodeId);
  const query = state.cardSearch;

  if (query) {
    const rows = state.rows
      .filter((row) =>
        [row.backendId, row.backendCategoryId, row.superCategory, row.category, row.subCategory, row.rowStatus]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      )
      .sort((a, b) => String(a.backendId ?? "").localeCompare(String(b.backendId ?? "")));

    elements.detailTitle.textContent = "Global Backend Results";
    elements.detailPath.textContent = `Showing matches across all backend IDs for "${query}".`;
    elements.detailCount.textContent = `${rows.length} row${rows.length === 1 ? "" : "s"}`;
    elements.treeHint.textContent = selectedNode ? `${selectedNode.nodeId} selected` : "Tree selection preserved";

    if (!rows.length) {
      elements.cardGrid.innerHTML = `<div class="empty-state">No backend rows matched the global search.</div>`;
      return;
    }

    elements.cardGrid.innerHTML = rows
      .map(
        (row) => `
          <article class="bcat-card">
            <span class="bcat-id">${escapeHtml(row.backendId ?? "No Backend ID")}</span>
            <h3>${escapeHtml(row.subCategory || "Unnamed Sub-Category")}</h3>
            <p><strong>Legacy BCAT:</strong> ${escapeHtml(row.backendCategoryId || "-")}</p>
            <p><strong>Super Category:</strong> ${escapeHtml(row.superCategory || "-")}</p>
            <p><strong>Category:</strong> ${escapeHtml(row.category || "-")}</p>
            <p><strong>Sub-Category:</strong> ${escapeHtml(row.subCategory || "-")}</p>
            <p><strong>Status:</strong> ${escapeHtml(row.rowStatus || (row.mappingIds?.length ? "Mapped Current Row" : "Additional Tech Row"))}</p>
            <p><strong>Mapped L3:</strong> ${escapeHtml(
              [row.l1, row.l2, row.l3].filter(Boolean).join(" / ") || "-"
            )}</p>
          </article>
        `
      )
      .join("");
    return;
  }

  if (!selectedNode) {
    elements.detailTitle.textContent = "Choose an L3";
    elements.detailPath.textContent = "Select a leaf from the tree to load its assigned backend categories.";
    elements.detailCount.textContent = "0 BCATs";
    elements.cardGrid.innerHTML = `<div class="empty-state">No L3 selected yet.</div>`;
    return;
  }

  const rows = getMappedRowsForNode(selectedNode.nodeId).sort((a, b) => String(a.backendId ?? "").localeCompare(String(b.backendId ?? "")));

  elements.detailTitle.textContent = selectedNode.l3;
  elements.detailPath.textContent = `${selectedNode.l1} / ${selectedNode.l2} / ${selectedNode.l3} / ${selectedNode.nodeId}`;
  elements.detailCount.textContent = `${rows.length} backend ID${rows.length === 1 ? "" : "s"}`;
  elements.treeHint.textContent = `${selectedNode.nodeId} selected`;

  if (!rows.length) {
    elements.cardGrid.innerHTML = `<div class="empty-state">No BCATs matched the current search for this L3.</div>`;
    return;
  }

  elements.cardGrid.innerHTML = rows
    .map(
      (row) => `
        <article class="bcat-card">
          <span class="bcat-id">${escapeHtml(row.backendId ?? "No Backend ID")}</span>
          <h3>${escapeHtml(row.subCategory || "Unnamed Sub-Category")}</h3>
          <p><strong>Legacy BCAT:</strong> ${escapeHtml(row.backendCategoryId || "-")}</p>
          <p><strong>Super Category:</strong> ${escapeHtml(row.superCategory || "-")}</p>
          <p><strong>Category:</strong> ${escapeHtml(row.category || "-")}</p>
          <p><strong>Sub-Category:</strong> ${escapeHtml(row.subCategory || "-")}</p>
          <p><strong>Status:</strong> ${escapeHtml(row.rowStatus || "Mapped Current Row")}</p>
        </article>
      `
    )
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const GGA_STATUS_BOARD_MODULE_ID = "gga-status-board";

const GGA_STATUSES = [
  ["agony", "Agony"],
  ["bad+1", "+1 Basic Abstract Difficulty"],
  ["bad+2", "+2 Basic Abstract Difficulty"],
  ["bad+3", "+3 Basic Abstract Difficulty"],
  ["bad+4", "+4 Basic Abstract Difficulty"],
  ["bad+5", "+5 Basic Abstract Difficulty"],
  ["bad-1", "-1 Basic Abstract Difficulty"],
  ["bad-2", "-2 Basic Abstract Difficulty"],
  ["bad-3", "-3 Basic Abstract Difficulty"],
  ["bad-4", "-4 Basic Abstract Difficulty"],
  ["bad-5", "-5 Basic Abstract Difficulty"],
  ["bleed", "Bleeding"],
  ["blind", "Blinded"],
  ["burn", "Burning"],
  ["coughing", "Coughing"],
  ["crawl", "Crawling *"],
  ["crouch", "Crouching *"],
  ["dead", "Dead"],
  ["deaf", "Deafened"],
  ["disabled", "Disabled"],
  ["disarmed", "Disarmed"],
  ["drowsy", "Drowsy"],
  ["drunk", "Drunk"],
  ["euphoria", "Euphoria"],
  ["exhausted", "Fatigued"],
  ["fall", "Falling"],
  ["fly", "Flying"],
  ["grapple", "Grappled"],
  ["kneel", "Kneeling *"],
  ["mentalstun", "Mental Stun"],
  ["mild_pain", "Mild Pain"],
  ["moderate_pain", "Moderate Pain (-2)"],
  ["moderate_pain2", "Moderate Pain (-3)"],
  ["nauseated", "Nauseated"],
  ["num1", "Counter 1"],
  ["num10", "Counter 10"],
  ["num2", "Counter 2"],
  ["num3", "Counter 3"],
  ["num4", "Counter 4"],
  ["num5", "Counter 5"],
  ["num6", "Counter 6"],
  ["num7", "Counter 7"],
  ["num8", "Counter 8"],
  ["num9", "Counter 9"],
  ["pinned", "Pinned"],
  ["poison", "Poisoned"],
  ["prone", "Lying Down *"],
  ["reeling", "Reeling"],
  ["retching", "Retching"],
  ["severe_pain", "Severe Pain (-4)"],
  ["severe_pain2", "Severe Pain (-5)"],
  ["shock1", "Shock 1"],
  ["shock2", "Shock 2"],
  ["shock3", "Shock 3"],
  ["shock4", "Shock 4"],
  ["silence", "Silenced"],
  ["sit", "Sitting *"],
  ["sleeping", "Sleeping"],
  ["sprint", "Sprinting"],
  ["standing", "undefined *"],
  ["stealth", "Sneaking/Stealth"],
  ["stun", "Stunned"],
  ["suffocate", "Suffocating"],
  ["terrible_pain", "Terrible Pain"],
  ["tipsy", "Tipsy"]
];

function ggaStatusBoardEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[character]));
}

function ggaStatusBoardTurnsSuffix(turns) {
  const numberOfTurns = Number.parseInt(turns, 10);
  if (!Number.isFinite(numberOfTurns) || numberOfTurns < 1) return "";
  return ` { turns: ${numberOfTurns} }`;
}

async function ggaStatusBoardSendCommand(action, statusId = "", options = {}) {
  const turnsSuffix = statusId && ["on", "t"].includes(action) && options.useTurns
    ? ggaStatusBoardTurnsSuffix(options.turns)
    : "";

  const command = statusId
    ? `/status ${action} ${statusId}${turnsSuffix}`
    : `/status ${action}`;

  if (ui.chat?.processMessage) {
    return ui.chat.processMessage(command);
  }

  ui.notifications?.warn(`Could not execute chat command directly: ${command}`);
}

class GGAStatusBoardApplication extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "gga-status-board",
      title: "GGA Status Board",
      width: 680,
      height: 740,
      resizable: true,
      classes: ["gga-status-board-window"]
    });
  }

  constructor(options = {}) {
    super(options);
    this.filter = game.settings.get(GGA_STATUS_BOARD_MODULE_ID, "filter") ?? "";
    this.useTurns = game.settings.get(GGA_STATUS_BOARD_MODULE_ID, "useTurns") ?? false;
    this.turns = game.settings.get(GGA_STATUS_BOARD_MODULE_ID, "turns") ?? 1;
  }

  get selectedTokens() {
    return canvas?.tokens?.controlled ?? [];
  }

  get commandOptions() {
    return {
      useTurns: this.useTurns,
      turns: this.turns
    };
  }

  _findStatusConfig(statusId) {
    return (CONFIG.statusEffects ?? []).find(effect => {
      return effect.id === statusId
        || effect._id === statusId
        || effect.name === statusId
        || effect.label === statusId;
    });
  }

  _tokenHasStatus(token, statusId) {
    const tokenDocument = token?.document;
    const actor = token?.actor;

    if (!tokenDocument) return false;

    try {
      if (tokenDocument.hasStatusEffect?.(statusId)) return true;
    } catch (_error) {}

    const statusConfig = this._findStatusConfig(statusId);
    const statusIcon = statusConfig?.icon;

    if (Array.isArray(tokenDocument.effects)) {
      if (tokenDocument.effects.includes(statusId)) return true;
      if (statusIcon && tokenDocument.effects.includes(statusIcon)) return true;
    }

    const actorEffects = [
      ...(actor?.effects?.contents ?? []),
      ...(actor?.temporaryEffects ?? [])
    ];

    for (const effect of actorEffects) {
      try {
        if (effect.statuses?.has?.(statusId)) return true;
        if (effect.flags?.core?.statusId === statusId) return true;
        if (effect.getFlag?.("core", "statusId") === statusId) return true;
        if (effect.id === statusId) return true;
        if (effect.name === statusId) return true;
        if (effect.label === statusId) return true;
        if (statusIcon && effect.icon === statusIcon) return true;
      } catch (_error) {}
    }

    return false;
  }

  _getStatusState(statusId) {
    const tokens = this.selectedTokens;

    if (!tokens.length) {
      return {
        key: "none",
        symbol: "-",
        label: "No token selected",
        count: 0,
        total: 0
      };
    }

    const count = tokens.filter(token => this._tokenHasStatus(token, statusId)).length;

    if (count === 0) {
      return {
        key: "off",
        symbol: "□",
        label: "Off",
        count,
        total: tokens.length
      };
    }

    if (count === tokens.length) {
      return {
        key: "on",
        symbol: "✓",
        label: "On",
        count,
        total: tokens.length
      };
    }

    return {
      key: "mixed",
      symbol: "◩",
      label: "Mixed",
      count,
      total: tokens.length
    };
  }

  async getData() {
    const query = this.filter.toLowerCase().trim();

    const allRows = GGA_STATUSES
      .map(([id, name]) => ({
        id,
        name,
        ...this._getStatusState(id)
      }))
      .filter(row => {
        if (!query) return true;
        return `${row.id} ${row.name}`.toLowerCase().includes(query);
      });

    const activeRows = GGA_STATUSES
      .map(([id, name]) => ({
        id,
        name,
        ...this._getStatusState(id)
      }))
      .filter(row => row.key === "on" || row.key === "mixed");

    return {
      tokenNames: this.selectedTokens.map(token => token.name).join(", ") || "No selected tokens",
      filter: this.filter,
      useTurns: this.useTurns,
      turns: this.turns,
      allRows,
      activeRows
    };
  }

  async _renderInner(data) {
    const activeHtml = data.activeRows.length
      ? data.activeRows.map(row => this._renderStatusRow(row)).join("")
      : `<div class="gga-status-board-empty">No active statuses detected on selected token(s).</div>`;

    const allHtml = data.allRows.length
      ? data.allRows.map(row => this._renderStatusRow(row)).join("")
      : `<div class="gga-status-board-empty">No statuses match the filter.</div>`;

    return $(`
      <form class="gga-status-board">
        <div class="gga-status-board-header">
          <div class="gga-status-board-selected">
            <strong>Selected:</strong> ${ggaStatusBoardEscapeHtml(data.tokenNames)}
          </div>

          <div class="gga-status-board-controls">
            <input
              type="search"
              id="gga-status-board-filter"
              value="${ggaStatusBoardEscapeHtml(data.filter)}"
              placeholder="Filter status ID or name"
            >

            <button type="button" id="gga-status-board-refresh">
              Refresh
            </button>

            <button type="button" id="gga-status-board-clear">
              Clear
            </button>
          </div>

          <div class="gga-status-board-turns">
            <label class="gga-status-board-turns-toggle">
              <input type="checkbox" id="gga-status-board-use-turns" ${data.useTurns ? "checked" : ""}>
              Expire at end of combat turns
            </label>
            <label class="gga-status-board-turns-value">
              Turns
              <input type="number" id="gga-status-board-turns" min="1" step="1" value="${Number.parseInt(data.turns, 10) || 1}">
            </label>
            <span class="gga-status-board-turns-help">
              Applies to On and Toggle commands as <code>{ turns: x }</code>.
            </span>
          </div>
        </div>

        <div class="gga-status-board-body">
          <h3>Active on Selected Token(s)</h3>
          <div class="gga-status-board-list">
            ${activeHtml}
          </div>

          <h3>All Statuses</h3>
          <div class="gga-status-board-list">
            ${allHtml}
          </div>
        </div>

        <div class="gga-status-board-footer">
          ✓ all selected have it &nbsp; | &nbsp;
          ◩ some selected have it &nbsp; | &nbsp;
          □ none have it &nbsp; | &nbsp;
          Double-click row = Toggle ${data.useTurns ? `with ${Number.parseInt(data.turns, 10) || 1} turn(s)` : ""}
        </div>
      </form>
    `);
  }

  _renderStatusRow(row) {
    return `
      <div class="gga-status-board-row ${row.key}" data-status-id="${ggaStatusBoardEscapeHtml(row.id)}">
        <div
          class="gga-status-board-state"
          title="${ggaStatusBoardEscapeHtml(row.label)}: ${row.count}/${row.total}"
        >
          ${row.symbol}
        </div>

        <div class="gga-status-board-name">
          <span>${ggaStatusBoardEscapeHtml(row.name)}</span>
          <code>${ggaStatusBoardEscapeHtml(row.id)}</code>
        </div>

        <div class="gga-status-board-actions">
          <button type="button" data-action="on">On</button>
          <button type="button" data-action="off">Off</button>
          <button type="button" data-action="t">Toggle</button>
        </div>
      </div>
    `;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("#gga-status-board-refresh").on("click", () => {
      this.render(false);
    });

    html.find("#gga-status-board-clear").on("click", async () => {
      await ggaStatusBoardSendCommand("clear");
      setTimeout(() => this.render(false), 250);
    });

    html.find("#gga-status-board-filter").on("input", foundry.utils.debounce(async event => {
      this.filter = event.currentTarget.value ?? "";
      await game.settings.set(GGA_STATUS_BOARD_MODULE_ID, "filter", this.filter);
      this.render(false);
    }, 150));

    html.find("#gga-status-board-use-turns").on("change", async event => {
      this.useTurns = event.currentTarget.checked;
      await game.settings.set(GGA_STATUS_BOARD_MODULE_ID, "useTurns", this.useTurns);
      this.render(false);
    });

    html.find("#gga-status-board-turns").on("change", async event => {
      const value = Math.max(1, Number.parseInt(event.currentTarget.value, 10) || 1);
      this.turns = value;
      await game.settings.set(GGA_STATUS_BOARD_MODULE_ID, "turns", this.turns);
      this.render(false);
    });

    html.find(".gga-status-board-row").on("dblclick", async event => {
      const statusId = event.currentTarget.dataset.statusId;
      if (!statusId) return;

      await ggaStatusBoardSendCommand("t", statusId, this.commandOptions);
      setTimeout(() => this.render(false), 250);
    });

    html.find("button[data-action]").on("click", async event => {
      event.preventDefault();
      event.stopPropagation();

      const row = event.currentTarget.closest(".gga-status-board-row");
      const statusId = row?.dataset?.statusId;
      const action = event.currentTarget.dataset.action;

      if (!statusId || !action) return;

      await ggaStatusBoardSendCommand(action, statusId, this.commandOptions);
      setTimeout(() => this.render(false), 250);
    });
  }
}

function openGGAStatusBoard() {
  if (globalThis.ggaStatusBoard?.rendered) {
    globalThis.ggaStatusBoard.bringToTop();
    return globalThis.ggaStatusBoard.render(false);
  }

  globalThis.ggaStatusBoard = new GGAStatusBoardApplication();
  return globalThis.ggaStatusBoard.render(true);
}

Hooks.once("init", () => {
  game.settings.register(GGA_STATUS_BOARD_MODULE_ID, "filter", {
    name: "GGA Status Board Filter",
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(GGA_STATUS_BOARD_MODULE_ID, "useTurns", {
    name: "GGA Status Board Use Turns",
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(GGA_STATUS_BOARD_MODULE_ID, "turns", {
    name: "GGA Status Board Turns",
    scope: "client",
    config: false,
    type: Number,
    default: 1
  });

  game.keybindings.register(GGA_STATUS_BOARD_MODULE_ID, "open", {
    name: "Open GGA Status Board",
    hint: "Open the standalone GGA Status Board.",
    editable: [
      {
        key: "KeyS",
        modifiers: ["Shift", "Alt"]
      }
    ],
    onDown: () => {
      openGGAStatusBoard();
      return true;
    },
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
});

Hooks.once("ready", () => {
  globalThis.GGAStatusBoard = {
    open: openGGAStatusBoard,
    sendStatus: ggaStatusBoardSendCommand
  };
});

Hooks.on("getSceneControlButtons", controls => {
  const tokenControls = Array.isArray(controls)
    ? controls.find(control => control.name === "token")
    : controls?.tokens;

  if (!tokenControls) return;

  const tool = {
    name: "gga-status-board",
    title: "GGA Status Board",
    icon: "fas fa-clipboard-list",
    button: true,
    onClick: () => openGGAStatusBoard()
  };

  if (Array.isArray(tokenControls.tools)) {
    if (!tokenControls.tools.some(existingTool => existingTool.name === tool.name)) {
      tokenControls.tools.push(tool);
    }
  } else {
    tokenControls.tools[tool.name] = tool;
  }
});

for (const hookName of [
  "controlToken",
  "updateToken",
  "createActiveEffect",
  "updateActiveEffect",
  "deleteActiveEffect"
]) {
  Hooks.on(hookName, () => {
    if (!globalThis.ggaStatusBoard?.rendered) return;

    clearTimeout(globalThis.ggaStatusBoard._ggaStatusBoardRefreshTimer);
    globalThis.ggaStatusBoard._ggaStatusBoardRefreshTimer = setTimeout(() => {
      globalThis.ggaStatusBoard.render(false);
    }, 150);
  });
}

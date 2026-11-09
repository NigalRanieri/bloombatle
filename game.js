
const GAME_MODES = Object.freeze({
    EASY: "easy",
    ADVANCED: "advanced"
});

let currentGameMode = GAME_MODES.EASY;

const advancedTodayGauntlet = advancedGauntlets.find(
    gauntlet => gauntlet.date === today
);

const gauntletsByMode = {
    [GAME_MODES.EASY]: currentGauntlet,
    [GAME_MODES.ADVANCED]: advancedTodayGauntlet
};

let activeGauntlet = currentGauntlet;
let activePuzzles = puzzles;

const board = document.getElementById("board");


const PUZZLE_CONFIGS = Object.freeze({
    CLASSIC: Object.freeze({
        boardSize: 5,
        torchCount: 2
    }),
    EXPANDED: Object.freeze({
        boardSize: 6,
        torchCount: 3
    })
});

function getPuzzleConfig(puzzleData) {
    if (puzzleData?.config) {
        return PUZZLE_CONFIGS[puzzleData.config];
    }

    // Existing V1 activePuzzles have no config field.
    return PUZZLE_CONFIGS.CLASSIC;
}



let selectedTorches = [];
let solvedPuzzles = new Set();
let savedSolutions = new Map();

let savedPlacements = new Map();
let startedPuzzles = new Set();

let torchPlacements = 0;



function createModeState() {
    return {
        restored: false,
        puzzleIndex: 0,
        selectedTorches: [],
        solvedPuzzles: new Set(),
        savedSolutions: new Map(),
        savedPlacements: new Map(),
        startedPuzzles: new Set(),
        torchPlacements: 0
    };
}


const modeStates = {
    [GAME_MODES.EASY]: {
        restored: false,
        puzzleIndex: 0,
        selectedTorches,
        solvedPuzzles,
        savedSolutions,
        savedPlacements,
        startedPuzzles,
        torchPlacements: 0
    },
    [GAME_MODES.ADVANCED]: createModeState()
};


function syncCurrentModeState() {
    const state = modeStates[currentGameMode];

    state.puzzleIndex = puzzleIndex;
    state.torchPlacements = torchPlacements;
}



function activateModeState(mode) {
    if (!modeStates[mode]) {
        throw new Error(`Unsupported game mode: ${mode}`);
    }

    // Save the numeric state of the mode we're leaving.
    syncCurrentModeState();

    const state = modeStates[mode];

    selectedTorches = state.selectedTorches;
    solvedPuzzles = state.solvedPuzzles;
    savedSolutions = state.savedSolutions;
    savedPlacements = state.savedPlacements;
    startedPuzzles = state.startedPuzzles;

    puzzleIndex = state.puzzleIndex;
    torchPlacements = state.torchPlacements;

    currentGameMode = mode;

    // Switch to this mode's daily dataset.
    activeGauntlet = gauntletsByMode[mode];
    activePuzzles = activeGauntlet?.puzzles ?? [];
}


function switchGameMode(mode) {
    if (mode === currentGameMode) {
        return;
    }

    if (!modeStates[mode]) {
        throw new Error(`Unsupported game mode: ${mode}`);
    }

    // Persist the mode we're leaving.
    saveProgress();

    // Activate its independent state and daily dataset.
    activateModeState(mode);

    const state = modeStates[mode];

    // Restore localStorage only on first activation.
    if (!state.restored) {
        state.puzzleIndex = restoreProgress();
        puzzleIndex = state.puzzleIndex;
        state.restored = true;
    }

    // Update selector appearance.
    for (const [buttonId, buttonMode] of [
        ["mode-easy", GAME_MODES.EASY],
        ["mode-advanced", GAME_MODES.ADVANCED]
    ]) {
        const button = document.getElementById(buttonId);
        const active = buttonMode === mode;

        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    }

    // Remove the previous mode's completion styling.
    document.getElementById("score").classList.toggle(
        "finished",
        activePuzzles.length === 10 &&
        solvedPuzzles.size === activePuzzles.length
    );

    document.getElementById("progress").textContent =
        `${solvedPuzzles.size} / ${activePuzzles.length} solved`;

    if (document.getElementById("statistics-dialog").open) {
        closeStatisticsModal();
    }

    if (!activeGauntlet || activePuzzles.length !== 10) {
        showUnavailableGauntlet();
        updateScore();
        return;
    }

    loadPuzzle(puzzleIndex);
    updateScore();

// Reopen statistics when entering a completed Gauntlet.
    if (solvedPuzzles.size === activePuzzles.length) {
        showStatisticsModal();
    }
}


function getStorageKey(mode = currentGameMode) {
    const date = activeGauntlet?.date;

    switch (mode) {
        case GAME_MODES.EASY:
            return `bloombatle:${date}:v1`;

        case GAME_MODES.ADVANCED:
            return `bloombatle:${date}:advanced:v1`;

        default:
            throw new Error(`Unsupported game mode: ${mode}`);
    }
}


function saveProgress() {
    if (!activeGauntlet || activePuzzles.length !== 10) {
        return;
    }

    const data = {
        torchPlacements,
        puzzleIndex,
        solved: [...solvedPuzzles],
        started: [...startedPuzzles],
        placements: [...savedPlacements],
        completedScore:
            solvedPuzzles.size === activePuzzles.length
                ? torchPlacements
                : null
    };

    try {
        localStorage.setItem(getStorageKey(), JSON.stringify(data));
    } catch (error) {
        console.warn("Could not save Gauntlet progress:", error);
    }
}

function restoreProgress() {
    if (!activeGauntlet || activePuzzles.length !== 10) {
        return 0;
    }

    const config = getPuzzleConfig(activePuzzles[0]);
    const maxTorches = config.torchCount;
    const maxSlot = config.boardSize * 4;

    try {
        const raw = localStorage.getItem(getStorageKey());

        if (!raw) {
            return 0;
        }

        const data = JSON.parse(raw);

        if (!data || typeof data !== "object") {
            return 0;
        }

        torchPlacements =
            Number.isSafeInteger(data.torchPlacements) &&
            data.torchPlacements >= 0
                ? data.torchPlacements
                : 0;

        const validIndex = index =>
            Number.isInteger(index) &&
            index >= 0 &&
            index < activePuzzles.length;

        if (Array.isArray(data.solved)) {
            for (const index of data.solved) {
                if (validIndex(index)) {
                    solvedPuzzles.add(index);
                }
            }
        }

        if (Array.isArray(data.started)) {
            for (const index of data.started) {
                if (validIndex(index)) {
                    startedPuzzles.add(index);
                }
            }
        }

        if (Array.isArray(data.placements)) {
            for (const entry of data.placements) {
                if (!Array.isArray(entry) || entry.length !== 2) {
                    continue;
                }

                const [index, positions] = entry;

                if (
                    validIndex(index) &&
                    Array.isArray(positions) &&
                    positions.length <= maxTorches &&
                    positions.every(position =>
                        Number.isInteger(position) &&
                        position >= 0 &&
                        position < maxSlot
                    ) &&
                    new Set(positions).size === positions.length
                ) {
                    savedPlacements.set(index, [...positions]);
                }
            }
        }

        // Solved puzzles remain marked as started.
        for (const index of solvedPuzzles) {
            startedPuzzles.add(index);
        }

        if (solvedPuzzles.size === activePuzzles.length) {
            document.getElementById("score")
                .classList.add("finished");
        }

        return validIndex(data.puzzleIndex)
            ? data.puzzleIndex
            : 0;

    } catch (error) {
        console.warn("Could not restore Gauntlet progress:", error);
        return 0;
    }
}



const SCORE_BUCKETS = {
    [GAME_MODES.EASY]: [
        { label: "Excellent", range: "20–30", min: 20, max: 30 },
        { label: "Good", range: "31–50", min: 31, max: 50 },
        { label: "Average", range: "51–80", min: 51, max: 80 },
        { label: "Challenging", range: "81–120", min: 81, max: 120 },
        { label: "Persistent", range: "121+", min: 121, max: Infinity }
    ],
    [GAME_MODES.ADVANCED]: [
        { label: "Excellent", range: "30–45", min: 30, max: 45 },
        { label: "Good", range: "46–75", min: 46, max: 75 },
        { label: "Average", range: "76–120", min: 76, max: 120 },
        { label: "Challenging", range: "121–180", min: 121, max: 180 },
        { label: "Persistent", range: "181+", min: 181, max: Infinity }
    ]
};



function getCompletedScores() {
    const scores = [];

    const keyPattern = currentGameMode === GAME_MODES.EASY
        ? /^bloombatle:\d{4}-\d{2}-\d{2}:v1$/
        : /^bloombatle:\d{4}-\d{2}-\d{2}:advanced:v1$/;

    const minimumScore =
        currentGameMode === GAME_MODES.EASY ? 20 : 30;

    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);

            if (!keyPattern.test(key)) {
                continue;
            }

            const data = JSON.parse(localStorage.getItem(key));

            if (
                data &&
                Array.isArray(data.solved) &&
                new Set(data.solved).size === 10 &&
                Number.isSafeInteger(data.completedScore) &&
                data.completedScore >= minimumScore
            ) {
                scores.push(data.completedScore);
            }
        }
    } catch (error) {
        console.warn("Could not read Gauntlet history:", error);
    }

    return scores;
}

function updateHistogram() {
    const scores = getCompletedScores();
    const scoreBuckets = SCORE_BUCKETS[currentGameMode];
    const container = document.getElementById("score-histogram");
    const summary = document.getElementById("statistics-summary");

    container.replaceChildren();

    if (scores.length === 0) {
        summary.textContent = "No completed Gauntlets yet.";
    } else {
        const best = Math.min(...scores);

        summary.textContent =
            `${scores.length} completed Gauntlet${scores.length === 1 ? "" : "s"} · Best score: ${best}`;
    }

    const counts = scoreBuckets.map(bucket =>
        scores.filter(score =>
            score >= bucket.min && score <= bucket.max
        ).length
    );

    const largestCount = Math.max(1, ...counts);

    scoreBuckets.forEach((bucket, index) => {
        const row = document.createElement("div");
        row.className = "histogram-row";

        const label = document.createElement("div");
        label.className = "histogram-label";

        const name = document.createElement("strong");
        name.textContent = bucket.label;

        const range = document.createElement("span");
        range.textContent = bucket.range;

        label.append(name, range);

        const track = document.createElement("div");
        track.className = "histogram-track";

        const bar = document.createElement("div");
        bar.className = "histogram-bar";
        bar.style.width =
            `${counts[index] / largestCount * 100}%`;

        track.appendChild(bar);

        const count = document.createElement("span");
        count.className = "histogram-count";
        count.textContent = counts[index];

        row.append(label, track, count);
        container.appendChild(row);
    });
}

let countdownInterval = null;

function showStatisticsModal() {
    const dialog = document.getElementById("statistics-dialog");

    if (dialog.open) {
        return;
    }

    updateHistogram();
    updateGauntletCountdown();

    dialog.showModal();

    clearInterval(countdownInterval);
    countdownInterval = setInterval(updateGauntletCountdown, 1000);
}

function closeStatisticsModal() {
    document.getElementById("statistics-dialog").close();
}

document.getElementById("statistics-dialog")
    .addEventListener("close", () => {
        clearInterval(countdownInterval);
        countdownInterval = null;
    });

function updateGauntletCountdown() {
    const countdown = document.getElementById("gauntlet-countdown");

    const now = Date.now();
    const nextMidnightUTC =
        (Math.floor(now / 86400000) + 1) * 86400000;

    const remainingSeconds =
        Math.max(0, Math.ceil((nextMidnightUTC - now) / 1000));

    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    countdown.textContent =
        [hours, minutes, seconds]
            .map(value => String(value).padStart(2, "0"))
            .join(":");
}


function updateScore() {
    document.getElementById("score").textContent =
        `${torchPlacements} torches placed`;
}

function recordSolvedPuzzle() {
    if (solvedPuzzles.has(puzzleIndex)) {
        return;
    }

    solvedPuzzles.add(puzzleIndex);
    savedSolutions.set(puzzleIndex, [...selectedTorches]);
    savedPlacements.set(puzzleIndex, [...selectedTorches]);

    document.getElementById("progress").textContent =
        `${solvedPuzzles.size} / ${activePuzzles.length} solved`;

    updateNavigation();

    if (solvedPuzzles.size === activePuzzles.length) {
        document.getElementById("score").classList.add("finished");
    }

    saveProgress();

    if (solvedPuzzles.size === activePuzzles.length) {
        showStatisticsModal();
    }
}

// LIGHT PATHS

const lightPaths = [
    // TOP: 0–4
    [[1, 6, 11, 16, 21], [1, 7, 13, 19, 25], [1]],
    [[2, 7, 12, 17, 22], [2, 6], [2, 8, 14, 20]],
    [[3, 8, 13, 18, 23], [3, 7, 11], [3, 9, 15]],
    [[4, 9, 14, 19, 24], [4, 8, 12, 16], [4, 10]],
    [[5, 10, 15, 20, 25], [5, 9, 13, 17, 21], [5]],

    // RIGHT: 5–9
    [[5, 4, 3, 2, 1], [5], [5, 9, 13, 17, 21]],
    [[10, 9, 8, 7, 6], [10, 4], [10, 14, 18, 22]],
    [[15, 14, 13, 12, 11], [15, 9, 3], [15, 19, 23]],
    [[20, 19, 18, 17, 16], [20, 14, 8, 2], [20, 24]],
    [[25, 24, 23, 22, 21], [25, 19, 13, 7, 1], [25]],

    // BOTTOM: 10–14
    [[25, 20, 15, 10, 5], [25, 19, 13, 7, 1], [25]],
    [[24, 19, 14, 9, 4], [24, 18, 12, 6], [24, 20]],
    [[23, 18, 13, 8, 3], [23, 17, 11], [23, 19, 15]],
    [[22, 17, 12, 7, 2], [22, 16], [22, 18, 14, 10]],
    [[21, 16, 11, 6, 1], [21], [21, 17, 13, 9, 5]],

    // LEFT: 15–19
    [[21, 22, 23, 24, 25], [21, 17, 13, 9, 5], [21]],
    [[16, 17, 18, 19, 20], [16, 12, 8, 4], [16, 22]],
    [[11, 12, 13, 14, 15], [11, 7, 3], [11, 17, 23]],
    [[6, 7, 8, 9, 10], [6, 2], [6, 12, 18, 24]],
    [[1, 2, 3, 4, 5], [1], [1, 7, 13, 19, 25]]
];


const lightPaths6 = [
    // TOP: positions 0–5
    [[1, 7, 13, 19, 25, 31], [1, 8, 15, 22, 29, 36], [1]],
    [[2, 8, 14, 20, 26, 32], [2, 7], [2, 9, 16, 23, 30]],
    [[3, 9, 15, 21, 27, 33], [3, 8, 13], [3, 10, 17, 24]],
    [[4, 10, 16, 22, 28, 34], [4, 9, 14, 19], [4, 11, 18]],
    [[5, 11, 17, 23, 29, 35], [5, 10, 15, 20, 25], [5, 12]],
    [[6, 12, 18, 24, 30, 36], [6, 11, 16, 21, 26, 31], [6]],

    // RIGHT: positions 6–11
    [[6, 5, 4, 3, 2, 1], [6], [6, 11, 16, 21, 26, 31]],
    [[12, 11, 10, 9, 8, 7], [12, 5], [12, 17, 22, 27, 32]],
    [[18, 17, 16, 15, 14, 13], [18, 11, 4], [18, 23, 28, 33]],
    [[24, 23, 22, 21, 20, 19], [24, 17, 10, 3], [24, 29, 34]],
    [[30, 29, 28, 27, 26, 25], [30, 23, 16, 9, 2], [30, 35]],
    [[36, 35, 34, 33, 32, 31], [36, 29, 22, 15, 8, 1], [36]],

    // BOTTOM: positions 12–17
    [[36, 30, 24, 18, 12, 6], [36, 29, 22, 15, 8, 1], [36]],
    [[35, 29, 23, 17, 11, 5], [35, 28, 21, 14, 7], [35, 30]],
    [[34, 28, 22, 16, 10, 4], [34, 27, 20, 13], [34, 29, 24]],
    [[33, 27, 21, 15, 9, 3], [33, 26, 19], [33, 28, 23, 18]],
    [[32, 26, 20, 14, 8, 2], [32, 25], [32, 27, 22, 17, 12]],
    [[31, 25, 19, 13, 7, 1], [31], [31, 26, 21, 16, 11, 6]],

    // LEFT: positions 18–23
    [[31, 32, 33, 34, 35, 36], [31, 26, 21, 16, 11, 6], [31]],
    [[25, 26, 27, 28, 29, 30], [25, 20, 15, 10, 5], [25, 32]],
    [[19, 20, 21, 22, 23, 24], [19, 14, 9, 4], [19, 26, 33]],
    [[13, 14, 15, 16, 17, 18], [13, 8, 3], [13, 20, 27, 34]],
    [[7, 8, 9, 10, 11, 12], [7, 2], [7, 14, 21, 28, 35]],
    [[1, 2, 3, 4, 5, 6], [1], [1, 8, 15, 22, 29, 36]]
];


function getLightPaths(boardSize) {
    switch (boardSize) {
        case 5:
            return lightPaths;
        case 6:
            return lightPaths6;
        default:
            throw new Error(
                `Unsupported board size: ${boardSize}`
            );
    }
}


// ILLUMINATION

// Coordinates are expressed in a 100 x 100 cell.
// The first cell of a ray receives a half-beam:
// from the center toward the next cell.
// All later cells receive a full beam.

function rayDirection(ray, torchPosition, rayIndex, boardSize = 5) {
    if (ray.length > 1) {
        const difference = ray[1] - ray[0];

        if (difference === boardSize) return [0, 1];
        if (difference === -boardSize) return [0, -1];
        if (difference === 1) return [1, 0];
        if (difference === -1) return [-1, 0];
        if (difference === boardSize + 1) return [1, 1];
        if (difference === -(boardSize + 1)) return [-1, -1];
        if (difference === boardSize - 1) return [-1, 1];
        if (difference === -(boardSize - 1)) return [1, -1];
    }

    if (torchPosition < boardSize) return [0, 1];
    if (torchPosition < 2 * boardSize) return [-1, 0];
    if (torchPosition < 3 * boardSize) return [0, -1];
    return [1, 0];
}


function illuminateTorch(position) {
    const { boardSize } = getPuzzleConfig(puzzle);
    const paths = getLightPaths(boardSize);
    const illuminated = new Set();
    const segments = new Map();

    paths[position].forEach((ray, rayIndex) => {
        const [dx, dy] = rayDirection(ray, position, rayIndex, boardSize);

        ray.forEach((cell, index) => {
            // Stop the ray at the first obstacle.
            if (segments === null) return;
        });

        for (let index = 0; index < ray.length; index++) {
            const cell = ray[index];

            if (puzzle.o.includes(cell)) {
                break;
            }

            illuminated.add(cell);

            if (!segments.has(cell)) {
                segments.set(cell, []);
            }


            segments.get(cell).push({
                dx,
                dy,
                first: index === 0
            });

// At the entrance cell, connect the center
// to the board edge facing the torch.
// Only add this once per torch.
            if (index === 0 && rayIndex === 0) {
                let entryDx = 0;
                let entryDy = 0;

                if (position < boardSize) {
                    entryDy = -1;       // Torch above
                } else if (position < 2 * boardSize) {
                    entryDx = 1;        // Torch to the right
                } else if (position < 3 * boardSize) {
                    entryDy = 1;        // Torch below
                } else {
                    entryDx = -1;       // Torch to the left
                }

                segments.get(cell).push({
                    dx: entryDx,
                    dy: entryDy,
                    first: true
                });
            }

        }
    });

    return { illuminated, segments };
}

function createBeamOverlay(cell, firstSegments, secondSegments, thirdSegments = []) {
    const svg = document.createElementNS(
        "http://www.w3.org/2000/svg", "svg"
    );

    svg.setAttribute("class", "beam-overlay");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");

    const definitions = document.createElementNS(
        "http://www.w3.org/2000/svg", "defs"
    );

    svg.appendChild(definitions);

    const allSegments = [
        ...firstSegments.map(segment => ({ ...segment, order: "first" })),
        ...secondSegments.map(segment => ({ ...segment, order: "second" })),
        ...thirdSegments.map(segment => ({ ...segment, order: "third" }))
    ];

    allSegments.forEach((segment, index) => {
        const gradientId = `beam-gradient-${cell}-${index}`;

        const gradient = document.createElementNS(
            "http://www.w3.org/2000/svg", "linearGradient"
        );

        gradient.setAttribute("id", gradientId);
        gradient.setAttribute("gradientUnits", "objectBoundingBox");

        // Gradient runs across the beam's width.
        gradient.setAttribute("x1", "0%");
        gradient.setAttribute("y1", "0%");
        gradient.setAttribute("x2", "0%");
        gradient.setAttribute("y2", "100%");

        const color = {
            first: "#f2a93b",
            second: "#e3cc62",
            third: "#E66A19"
        }[segment.order];

        [
            ["0%", "0"],
            ["25%", "0.25"],
            ["50%", "0.9"],
            ["75%", "0.25"],
            ["100%", "0"]
        ].forEach(([offset, opacity]) => {
            const stop = document.createElementNS(
                "http://www.w3.org/2000/svg", "stop"
            );

            stop.setAttribute("offset", offset);
            stop.setAttribute("stop-color", color);
            stop.setAttribute("stop-opacity", opacity);
            gradient.appendChild(stop);
        });

        definitions.appendChild(gradient);

        const x1 = segment.first ? 50 : 50 - segment.dx * 50;
        const y1 = segment.first ? 50 : 50 - segment.dy * 50;
        const x2 = 50 + segment.dx * 50;
        const y2 = 50 + segment.dy * 50;

        const line = document.createElementNS(
            "http://www.w3.org/2000/svg", "line"
        );

        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);


        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", "100");
        line.setAttribute("stroke-opacity", "0.16");
        line.setAttribute("stroke-linecap", "butt");

        svg.appendChild(line);

// Middle layer: stronger light, still quite broad.
        const middleLine = line.cloneNode();
        middleLine.setAttribute("stroke-width", "72");
        middleLine.setAttribute("stroke-opacity", "0.22");
        svg.appendChild(middleLine);

// Bright center: gives the beam a clear direction.
        const centerLine = line.cloneNode();
        centerLine.setAttribute("stroke-width", "32");
        centerLine.setAttribute("stroke-opacity", "0.55");
        svg.appendChild(centerLine);


    });

    return svg;
}


function updateLighting() {
    const { torchCount } = getPuzzleConfig(puzzle);

    const emptyLight = () => ({
        illuminated: new Set(),
        segments: new Map()
    });

    const lights = Array.from(
        { length: torchCount },
        (_, index) => selectedTorches[index] !== undefined
            ? illuminateTorch(selectedTorches[index])
            : emptyLight()
    );

    const illuminated = new Set();

    lights.forEach(light => {
        light.illuminated.forEach(cell => illuminated.add(cell));
    });

    document.querySelectorAll(".cell").forEach(element => {
        const cell = Number(element.dataset.cell);

        element.querySelectorAll(".beam-overlay")
            .forEach(overlay => overlay.remove());

        const firstSegments = lights[0]?.segments.get(cell) || [];
        const secondSegments = lights[1]?.segments.get(cell) || [];
        const thirdSegments = lights[2]?.segments.get(cell) || [];

        if (
            firstSegments.length > 0 ||
            secondSegments.length > 0 ||
            thirdSegments.length > 0
        ) {
            element.appendChild(
                createBeamOverlay(
                    cell,
                    firstSegments,
                    secondSegments,
                    thirdSegments
                )
            );
        }

        const isLit = illuminated.has(cell);

        element.classList.toggle(
            "bat-lit",
            puzzle.b.includes(cell) && isLit
        );

        element.classList.toggle(
            "flower-lit",
            puzzle.f.includes(cell) && isLit
        );

        const image = element.querySelector(".cell-symbol");

        if (image && puzzle.b.includes(cell)) {
            image.src = isLit
                ? "assets/bat_lit.png"
                : "assets/bat_shadow.png";
        }

        if (image && puzzle.f.includes(cell)) {
            image.src = isLit
                ? "assets/flower_lit.png"
                : "assets/flower_shadow.png";
        }
    });

    const allFlowersLit =
        puzzle.f.every(cell => illuminated.has(cell));

    const allBatsDark =
        puzzle.b.every(cell => !illuminated.has(cell));

    const won =
        selectedTorches.length === torchCount &&
        allFlowersLit &&
        allBatsDark;

    const status = document.getElementById("status");

    if (won) {
        status.textContent = "Puzzle solved!";
        status.className = "won";
        recordSolvedPuzzle();
    } else if (selectedTorches.length < torchCount) {
        status.textContent =
            `Place ${torchCount} torches to solve the puzzle.`;
        status.className = "";
    } else {
        status.textContent = "Not solved yet.";
        status.className = "";
    }
}



// TORCH SELECTION


function toggleTorch(position) {
    if (solvedPuzzles.has(puzzleIndex)) {
        return;
    }

    const { torchCount } = getPuzzleConfig(puzzle);
    const index = selectedTorches.indexOf(position);

    if (index >= 0) {
        selectedTorches.splice(index, 1);
    } else if (selectedTorches.length < torchCount) {
        selectedTorches.push(position);

        torchPlacements++;
        startedPuzzles.add(puzzleIndex);
        updateScore();
    }

    savedPlacements.set(puzzleIndex, [...selectedTorches]);

    updateTorchStyles();
    updateLighting();
    updatePuzzleSelector();
    saveProgress();
}


function updateTorchStyles() {
    const { boardSize } = getPuzzleConfig(puzzle);

    document.querySelectorAll(".torch").forEach(element => {
        const position = Number(element.dataset.position);
        const index = selectedTorches.indexOf(position);

        element.classList.toggle("selected", index >= 0);
        element.classList.toggle("first", index === 0);
        element.classList.toggle("second", index === 1);
        element.classList.toggle("third", index === 2);

        element.replaceChildren();

        if (index >= 0) {
            let direction;

            if (position < boardSize) {
                direction = "down";
            } else if (position < 2 * boardSize) {
                direction = "left";
            } else if (position < 3 * boardSize) {
                direction = "up";
            } else {
                direction = "right";
            }

            const image = document.createElement("img");
            image.className = "torch-image";
            image.src = `assets/torch_${direction}.png`;
            image.alt = "Torch";

            element.appendChild(image);
        }
    });
}

// BOARD RENDERING

function addElement(className, content, row, column) {
    const element = document.createElement("div");

    element.className = className;
    element.textContent = content;
    element.style.gridRow = row;
    element.style.gridColumn = column;

    board.appendChild(element);
    return element;
}

function addTorch(position, row, column) {
    const element = addElement("torch", "", row, column);

    element.dataset.position = position;
    element.addEventListener("click", () => toggleTorch(position));
}


function renderBoard() {
    board.replaceChildren();

    const { boardSize } = getPuzzleConfig(puzzle);
    const outerSize = boardSize + 2;

    board.style.gridTemplateColumns =
        `repeat(${outerSize}, 48px)`;
    board.style.gridTemplateRows =
        `repeat(${outerSize}, 48px)`;

    // Board cells: 1–boardSize²
    for (let cell = 1; cell <= boardSize * boardSize; cell++) {
        const row = Math.floor((cell - 1) / boardSize) + 2;
        const column = ((cell - 1) % boardSize) + 2;

        let asset = null;
        let className = "cell";

        if (puzzle.o.includes(cell)) {
            asset = "rock.png";
            className += " obstacle";
        } else if (puzzle.b.includes(cell)) {
            asset = "bat_shadow.png";
            className += " bat";
        } else if (puzzle.f.includes(cell)) {
            asset = "flower_shadow.png";
            className += " flower";
        }

        const element = addElement(className, "", row, column);
        element.dataset.cell = cell;

        if (asset !== null) {
            const image = document.createElement("img");
            image.className = "cell-symbol";
            image.src = `assets/${asset}`;
            image.alt = className.split(" ")[1];
            element.appendChild(image);
        }
    }

    // Top: left to right
    for (let i = 0; i < boardSize; i++) {
        addTorch(i, 1, i + 2);
    }

    // Right: top to bottom
    for (let i = 0; i < boardSize; i++) {
        addTorch(i + boardSize, i + 2, outerSize);
    }

    // Bottom: right to left
    for (let i = 0; i < boardSize; i++) {
        addTorch(
            i + 2 * boardSize,
            outerSize,
            boardSize + 1 - i
        );
    }

    // Left: bottom to top
    for (let i = 0; i < boardSize; i++) {
        addTorch(
            i + 3 * boardSize,
            boardSize + 1 - i,
            1
        );
    }
}


// PUZZLE NAVIGATION

function updateNavigation() {
    document.getElementById("puzzle-number").textContent =
        `Puzzle ${puzzleIndex + 1} / ${activePuzzles.length}`;

    document.getElementById("previous").disabled =
        puzzleIndex === 0;

    document.getElementById("next").disabled =
        puzzleIndex === activePuzzles.length - 1;

    updatePuzzleSelector();
}

function updatePuzzleSelector() {
    const container = document.getElementById("puzzle-selector");

    container.replaceChildren();

    for (let i = 0; i < activePuzzles.length; i++) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "puzzle-box";
        button.textContent = i + 1;

        if (solvedPuzzles.has(i)) {
            button.classList.add("solved");
        } else if (startedPuzzles.has(i)) {
            button.classList.add("started");
        }

        if (i === puzzleIndex) {
            button.classList.add("current");
            button.setAttribute("aria-current", "step");
        }

        button.setAttribute("aria-label", `Puzzle ${i + 1}`);

        button.addEventListener("click", () => {
            loadPuzzle(i);
        });

        container.appendChild(button);
    }
}

function showUnavailableGauntlet() {
    document.getElementById("board").replaceChildren();
    document.getElementById("puzzle-selector").replaceChildren();

    document.getElementById("puzzle-number").textContent =
        "No Gauntlet today";

    document.getElementById("previous").disabled = true;
    document.getElementById("next").disabled = true;

    document.getElementById("progress").textContent = "";

    const status = document.getElementById("status");
    status.textContent = "Today's Gauntlet is not available yet.";
    status.classList.remove("won");
}

function loadPuzzle(index) {
    if (!activeGauntlet || activePuzzles.length !== 10) {
        return;
    }

    if (index < 0 || index >= activePuzzles.length) {
        return;
    }

    puzzleIndex = index;
    puzzle = activePuzzles[puzzleIndex];

    selectedTorches.length = 0;

    if (savedPlacements.has(puzzleIndex)) {
        selectedTorches.push(...savedPlacements.get(puzzleIndex));
    }

    renderBoard();
    updateTorchStyles();
    updateLighting();
    updateNavigation();
    saveProgress();
}

document.getElementById("previous").addEventListener("click", () => {
    loadPuzzle(puzzleIndex - 1);
});

document.getElementById("next").addEventListener("click", () => {
    loadPuzzle(puzzleIndex + 1);
});

document.getElementById("statistics-dialog")
    .addEventListener("click", event => {
        const dialog = event.currentTarget;
        const rect = dialog.getBoundingClientRect();

        const clickedInside =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;

        if (!clickedInside) {
            closeStatisticsModal();
        }
    });



// INITIALIZE

if (activeGauntlet && activePuzzles.length === 10) {
    const startingPuzzle = restoreProgress();
    modeStates[GAME_MODES.EASY].restored = true;

    loadPuzzle(startingPuzzle);
    updateScore();

    if (solvedPuzzles.size === activePuzzles.length) {
        showStatisticsModal();
    }
} else {
    showUnavailableGauntlet();
}

// HOW TO PLAY TUTORIAL

const tutorialDialog = document.getElementById("tutorial-dialog");

function openTutorial() {
    if (!tutorialDialog.open) {
        tutorialDialog.showModal();
    }
}

function closeTutorial() {
    tutorialDialog.close();
}

document.getElementById("mode-easy")
    .addEventListener("click", () => {
        switchGameMode(GAME_MODES.EASY);
    });

document.getElementById("mode-advanced")
    .addEventListener("click", () => {
        switchGameMode(GAME_MODES.ADVANCED);
    });

document.getElementById("tutorial-open")
    .addEventListener("click", openTutorial);

document.getElementById("tutorial-close")
    .addEventListener("click", closeTutorial);

document.getElementById("tutorial-play")
    .addEventListener("click", closeTutorial);

// Close the tutorial when clicking outside the dialog.
tutorialDialog.addEventListener("click", (event) => {
    const rect = tutorialDialog.getBoundingClientRect();

    const clickedOutside =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;

    if (clickedOutside) {
        closeTutorial();
    }
});

// Local testing: show the tutorial on every page load.
// Show the tutorial once per browser, including existing players.
// This key is independent of all saved game progress and statistics.
const TUTORIAL_SEEN_KEY = "bloombatle_tutorial_seen_v1";

if (localStorage.getItem(TUTORIAL_SEEN_KEY) !== "true") {
    if (!document.getElementById("statistics-dialog").open) {
        openTutorial();
    }
}

// Remember that the tutorial has been seen when it is closed.
tutorialDialog.addEventListener("close", () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "true");
});
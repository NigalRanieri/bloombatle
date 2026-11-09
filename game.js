
const GAME_MODES = Object.freeze({
    EASY: "easy",
    ADVANCED: "advanced"
});

let currentGameMode = GAME_MODES.EASY;

const board = document.getElementById("board");

const selectedTorches = [];
const solvedPuzzles = new Set();
const savedSolutions = new Map();

const savedPlacements = new Map();
const startedPuzzles = new Set();

let torchPlacements = 0;


const storageKey = `bloombatle:${currentGauntlet?.date}:v1`;

function saveProgress() {
    if (!currentGauntlet || puzzles.length !== 10) {
        return;
    }

    const data = {
        torchPlacements,
        puzzleIndex,
        solved: [...solvedPuzzles],
        started: [...startedPuzzles],
        placements: [...savedPlacements],
        completedScore:
            solvedPuzzles.size === puzzles.length
                ? torchPlacements
                : null
    };

    try {
        localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
        console.warn("Could not save Gauntlet progress:", error);
    }
}

function restoreProgress() {
    if (!currentGauntlet || puzzles.length !== 10) {
        return 0;
    }

    try {
        const raw = localStorage.getItem(storageKey);

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
            index < puzzles.length;

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
                    positions.length <= 2 &&
                    positions.every(position =>
                        Number.isInteger(position) &&
                        position >= 1 &&
                        position <= 25
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

        if (solvedPuzzles.size === puzzles.length) {
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


const scoreBuckets = [
    { label: "Excellent", range: "20–30", min: 20, max: 30 },
    { label: "Good", range: "31–50", min: 31, max: 50 },
    { label: "Average", range: "51–80", min: 51, max: 80 },
    { label: "Challenging", range: "81–120", min: 81, max: 120 },
    { label: "Persistent", range: "121+", min: 121, max: Infinity }
];

function getCompletedScores() {
    const scores = [];
    const keyPattern = /^bloombatle:\d{4}-\d{2}-\d{2}:v1$/;

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
                data.completedScore >= 20
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
        `${solvedPuzzles.size} / ${puzzles.length} solved`;

    updateNavigation();

    if (solvedPuzzles.size === puzzles.length) {
        document.getElementById("score").classList.add("finished");
    }

    saveProgress();

    if (solvedPuzzles.size === puzzles.length) {
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



// ILLUMINATION

// Coordinates are expressed in a 100 x 100 cell.
// The first cell of a ray receives a half-beam:
// from the center toward the next cell.
// All later cells receive a full beam.

function rayDirection(ray, torchPosition, rayIndex) {
    if (ray.length > 1) {
        const difference = ray[1] - ray[0];

        if (difference === 5) return [0, 1];
        if (difference === -5) return [0, -1];
        if (difference === 1) return [1, 0];
        if (difference === -1) return [-1, 0];
        if (difference === 6) return [1, 1];
        if (difference === -6) return [-1, -1];
        if (difference === 4) return [-1, 1];
        if (difference === -4) return [1, -1];
    }

    // Single-cell rays occur at corner torch positions.
    // Their directions follow the torch's inward direction.
    if (torchPosition < 5) return [0, 1];
    if (torchPosition < 10) return [-1, 0];
    if (torchPosition < 15) return [0, -1];
    return [1, 0];
}

function illuminateTorch(position) {
    const illuminated = new Set();
    const segments = new Map();

    lightPaths[position].forEach((ray, rayIndex) => {
        const [dx, dy] = rayDirection(ray, position, rayIndex);

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

                if (position < 5) {
                    entryDy = -1;       // Torch above
                } else if (position < 10) {
                    entryDx = 1;        // Torch to the right
                } else if (position < 15) {
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

function createBeamOverlay(cell, firstSegments, secondSegments) {
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
        ...secondSegments.map(segment => ({ ...segment, order: "second" }))
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

        const color = segment.order === "first"
            ? "#f2a93b"
            : "#e3cc62";

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
    const emptyLight = () => ({
        illuminated: new Set(),
        segments: new Map()
    });

    const firstLight = selectedTorches.length > 0
        ? illuminateTorch(selectedTorches[0])
        : emptyLight();

    const secondLight = selectedTorches.length > 1
        ? illuminateTorch(selectedTorches[1])
        : emptyLight();

    document.querySelectorAll(".cell").forEach(element => {
        const cell = Number(element.dataset.cell);

        element.querySelectorAll(".beam-overlay")
            .forEach(overlay => overlay.remove());

        const firstSegments = firstLight.segments.get(cell) || [];
        const secondSegments = secondLight.segments.get(cell) || [];

        if (firstSegments.length > 0 || secondSegments.length > 0) {
            element.appendChild(
                createBeamOverlay(cell, firstSegments, secondSegments)
            );
        }

        const isLit =
            firstLight.illuminated.has(cell) ||
            secondLight.illuminated.has(cell);

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

    const illuminated = new Set([
        ...firstLight.illuminated,
        ...secondLight.illuminated
    ]);

    const allFlowersLit =
        puzzle.f.every(cell => illuminated.has(cell));

    const allBatsDark =
        puzzle.b.every(cell => !illuminated.has(cell));

    const won = selectedTorches.length === 2
        && allFlowersLit
        && allBatsDark;

    const status = document.getElementById("status");

    if (won) {
        status.textContent = "Puzzle solved!";
        status.className = "won";
        recordSolvedPuzzle();
    } else if (selectedTorches.length < 2) {
        status.textContent = "Place two torches to solve the puzzle.";
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

    const index = selectedTorches.indexOf(position);

    if (index >= 0) {
        selectedTorches.splice(index, 1);
    } else if (selectedTorches.length < 2) {
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
    document.querySelectorAll(".torch").forEach(element => {
        const position = Number(element.dataset.position);
        const index = selectedTorches.indexOf(position);

        element.classList.toggle("selected", index >= 0);
        element.classList.toggle("first", index === 0);
        element.classList.toggle("second", index === 1);


        element.replaceChildren();

        if (index >= 0) {
            let direction;

            if (position < 5) {
                direction = "down";
            } else if (position < 10) {
                direction = "left";
            } else if (position < 15) {
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

    // Board cells: 1–25
    for (let cell = 1; cell <= 25; cell++) {
        const row = Math.floor((cell - 1) / 5) + 2;
        const column = ((cell - 1) % 5) + 2;


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

    // Top: 0–4
    for (let i = 0; i < 5; i++) {
        addTorch(i, 1, i + 2);
    }

    // Right: 5–9
    for (let i = 0; i < 5; i++) {
        addTorch(i + 5, i + 2, 7);
    }

    // Bottom: 10–14, right to left
    for (let i = 0; i < 5; i++) {
        addTorch(i + 10, 7, 6 - i);
    }

    // Left: 15–19, bottom to top
    for (let i = 0; i < 5; i++) {
        addTorch(i + 15, 6 - i, 1);
    }
}

// PUZZLE NAVIGATION

function updateNavigation() {
    document.getElementById("puzzle-number").textContent =
        `Puzzle ${puzzleIndex + 1} / ${puzzles.length}`;

    document.getElementById("previous").disabled =
        puzzleIndex === 0;

    document.getElementById("next").disabled =
        puzzleIndex === puzzles.length - 1;

    updatePuzzleSelector();
}

function updatePuzzleSelector() {
    const container = document.getElementById("puzzle-selector");

    container.replaceChildren();

    for (let i = 0; i < puzzles.length; i++) {
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
    if (!currentGauntlet || puzzles.length !== 10) {
        return;
    }

    if (index < 0 || index >= puzzles.length) {
        return;
    }

    puzzleIndex = index;
    puzzle = puzzles[puzzleIndex];

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

if (currentGauntlet && puzzles.length === 10) {
    const startingPuzzle = restoreProgress();

    loadPuzzle(startingPuzzle);
    updateScore();

    if (solvedPuzzles.size === puzzles.length) {
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
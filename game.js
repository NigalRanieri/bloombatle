
const board = document.getElementById("board");

const selectedTorches = [];
const solvedPuzzles = new Set();
const savedSolutions = new Map();

let elapsedMilliseconds = 0;
let timerStartedAt = null;
let timerInterval = null;

// TIMER

function formatTime(milliseconds) {
    const tenths = Math.floor(milliseconds / 100);
    const minutes = Math.floor(tenths / 600);
    const seconds = Math.floor((tenths % 600) / 10);
    const decimal = tenths % 10;

    return `${String(minutes).padStart(2, "0")}:` +
        `${String(seconds).padStart(2, "0")}.${decimal}`;
}

function updateTimer() {
    const currentSegment = timerStartedAt === null
        ? 0
        : performance.now() - timerStartedAt;

    document.getElementById("timer").textContent =
        formatTime(elapsedMilliseconds + currentSegment);
}

function startTimer() {
    if (timerStartedAt !== null ||
        solvedPuzzles.size === puzzles.length) {
        return;
    }

    timerStartedAt = performance.now();
    timerInterval = setInterval(updateTimer, 100);
}

function pauseTimer() {
    if (timerStartedAt === null) {
        return;
    }

    elapsedMilliseconds += performance.now() - timerStartedAt;
    timerStartedAt = null;

    clearInterval(timerInterval);
    timerInterval = null;

    updateTimer();
}

function recordSolvedPuzzle() {
    if (solvedPuzzles.has(puzzleIndex)) {
        return;
    }

    solvedPuzzles.add(puzzleIndex);
    savedSolutions.set(puzzleIndex, [...selectedTorches]);

    pauseTimer();

    document.getElementById("progress").textContent =
        `${solvedPuzzles.size} / ${puzzles.length} solved`;

    updateNavigation();

    if (solvedPuzzles.size === puzzles.length) {
        document.getElementById("timer").classList.add("finished");
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
    // Completed puzzles cannot be changed.
    if (solvedPuzzles.has(puzzleIndex)) {
        return;
    }

    const index = selectedTorches.indexOf(position);

    if (index >= 0) {
        selectedTorches.splice(index, 1);
    } else if (selectedTorches.length < 2) {
        // Puzzle 1 starts on the first torch placement.
        if (puzzleIndex === 0) {
            startTimer();
        }

        selectedTorches.push(position);
    }

    updateTorchStyles();
    updateLighting();
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
    element.title = `Torch ${position}`;
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
        puzzleIndex === puzzles.length - 1 ||
        !solvedPuzzles.has(puzzleIndex);
}

function loadPuzzle(index) {
    if (index < 0 || index >= puzzles.length) {
        return;
    }

    // Only allow puzzles that have been unlocked.
    if (index > 0 && !solvedPuzzles.has(index - 1)) {
        return;
    }

    pauseTimer();

    puzzleIndex = index;
    puzzle = puzzles[puzzleIndex];

    // Restore winning placements on completed puzzles.
    selectedTorches.length = 0;

    if (savedSolutions.has(puzzleIndex)) {
        selectedTorches.push(...savedSolutions.get(puzzleIndex));
    }

    renderBoard();
    updateTorchStyles();
    updateLighting();
    updateNavigation();

    // Entering a new unfinished puzzle starts the timer.
    // Puzzle 1 is the exception: it starts on first placement.
    if (puzzleIndex > 0 && !solvedPuzzles.has(puzzleIndex)) {
        startTimer();
    }
}

document.getElementById("previous").addEventListener("click", () => {
    if (puzzleIndex > 0) {
        loadPuzzle(puzzleIndex - 1);
    }
});

document.getElementById("next").addEventListener("click", () => {
    if (puzzleIndex < puzzles.length - 1 &&
        solvedPuzzles.has(puzzleIndex)) {
        loadPuzzle(puzzleIndex + 1);
    }
});

// INITIALIZE

loadPuzzle(0);
updateTimer();

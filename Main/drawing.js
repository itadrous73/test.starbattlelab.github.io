/**
 **********************************************************************************
 *
 * Star Battle Puzzle - Drawing and Rendering
 *
 * @author Isaiah Tadrous
 * @version 2.0.0
 *
 * -------------------------------------------------------------------------------
 *
 * Description:
 * This file manages all visual rendering for the Star Battle puzzle application.
 * Its responsibilities include dynamically creating and styling the main puzzle
 * grid, drawing region borders, and placing player marks (stars, dots, X's).
 * It also handles all canvas-based overlays, such as free-form drawing, custom
 * region borders, and displaying the puzzle solution. A key feature is the
 * real-time error highlighting, which visually flags violations of the Star
 * Battle rules.
 *
 **********************************************************************************
 */

// --- RENDERING & DRAWING FUNCTIONS ---

/**
 * Converts an HSL color value to RGB.
 * @param {number} h - Hue.
 * @param {number} s - Saturation.
 * @param {number} l - Lightness.
 * @returns {Array<number>} - The RGB representation [r, g, b].
 */
function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs((h / 60) % 2 - 1)),
        m = l - c / 2,
        r = 0,
        g = 0,
        b = 0;
    if (0 <= h && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (60 <= h && h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (120 <= h && h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (180 <= h && h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (240 <= h && h < 300) {
        r = x;
        g = 0;
        b = c;
    } else if (300 <= h && h < 360) {
        r = c;
        g = 0;
        b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return [r, g, b];
}

/**
 * Converts an RGB color value to the LAB color space.
 * @param {number} r - Red value.
 * @param {number} g - Green value.
 * @param {number} b - Blue value.
 * @returns {Array<number>} - The LAB representation [l, a, b].
 */
function rgbToLab(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    x = (x > 0.008856) ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
    y = (y > 0.008856) ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
    z = (z > 0.008856) ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
}

/**
 * Calculates the perceptual difference between two LAB colors using the Delta E formula.
 * @param {Array<number>} labA - The first LAB color [l, a, b].
 * @param {Array<number>} labB - The second LAB color [l, a, b].
 * @returns {number} - The calculated color difference.
 */
function deltaE(labA, labB) {
    let deltaL = labA[0] - labB[0];
    let deltaA = labA[1] - labB[1];
    let deltaB = labA[2] - labB[2];
    let c1 = Math.sqrt(labA[1] * labA[1] + labA[2] * labA[2]);
    let c2 = Math.sqrt(labB[1] * labB[1] + labB[2] * labB[2]);
    let deltaC = c1 - c2;
    let deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
    deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
    return Math.sqrt(Math.pow(deltaL, 2) + Math.pow(deltaC, 2) + Math.pow(deltaH, 2));
}
/**
 * Analyzes the grid to assign distinct colors to adjacent regions and stores them in state.
 * This function should be called once when a new puzzle is loaded.
 * @returns {void}
 */
function assignAndStoreRegionColors() {
    if (!state.gridDim || !state.regionGrid) return;

    // 1. Find all unique regions and their neighbors.
    const regions = {};
    for (let r = 0; r < state.gridDim; r++) {
        for (let c = 0; c < state.gridDim; c++) {
            const id = state.regionGrid[r][c];
            if (!regions[id]) {
                regions[id] = {
                    id: id,
                    neighbors: new Set()
                };
            }

            // Check right neighbor
            if (c < state.gridDim - 1 && state.regionGrid[r][c + 1] !== id) {
                const neighborId = state.regionGrid[r][c + 1];
                regions[id].neighbors.add(neighborId);
                if (!regions[neighborId]) { // Ensure neighbor is initialized
                    regions[neighborId] = {
                        id: neighborId,
                        neighbors: new Set()
                    };
                }
                regions[neighborId].neighbors.add(id);
            }

            // Check bottom neighbor
            if (r < state.gridDim - 1 && state.regionGrid[r + 1][c] !== id) {
                const neighborId = state.regionGrid[r + 1][c];
                regions[id].neighbors.add(neighborId);
                if (!regions[neighborId]) { // Ensure neighbor is initialized
                    regions[neighborId] = {
                        id: neighborId,
                        neighbors: new Set()
                    };
                }
                regions[neighborId].neighbors.add(id);
            }
        }
    }
    const regionIds = Object.keys(regions).map(Number);

    // 2. Generate a color palette based on the number of unique regions.
    // The initial palette, now more diverse and designed for a larger number of regions if needed.
    const initialColorPalette = Array.from({
        length: Math.max(regionIds.length * 2, 25)
    }, (_, i) => { // Ensure enough colors
        const hue = (i * 67) % 360;
        const isSaturated = i % 2 === 1;
        const s = isSaturated ? 65 : 100;
        const l = isSaturated ? 77 : 90;
        return {
            h: hue,
            s: s,
            l: l
        };
    });

    // A more robust set of fallback colors.
    const fallbackColors = [{
            h: 0.0,
            s: 100,
            l: 90
        }, {
            h: 67.0,
            s: 65,
            l: 77
        }, {
            h: 134.0,
            s: 100,
            l: 90
        },
        {
            h: 201.0,
            s: 65,
            l: 77
        }, {
            h: 268.0,
            s: 100,
            l: 90
        }, {
            h: 335.0,
            s: 65,
            l: 77
        },
        {
            h: 42.0,
            s: 100,
            l: 90
        }, {
            h: 109.0,
            s: 65,
            l: 77
        }, {
            h: 176.0,
            s: 100,
            l: 90
        },
        {
            h: 275.0,
            s: 73,
            l: 78
        }, {
            h: 243.0,
            s: 65,
            l: 77
        }, {
            h: 275.0,
            s: 30,
            l: 60
        },
        {
            h: 190.0,
            s: 100,
            l: 50
        }, {
            h: 195.0,
            s: 100,
            l: 76
        }, {
            h: 0.0,
            s: 9,
            l: 60
        },
        {
            h: 137.5,
            s: 43,
            l: 77
        }, {
            h: 176.0,
            s: 32,
            l: 50
        }, {
            h: 190.0,
            s: 80,
            l: 32
        },
        {
            h: 0.0,
            s: 10,
            l: 50
        }, {
            h: 52.5,
            s: 27,
            l: 50
        }, {
            h: 52.5,
            s: 77,
            l: 50
        }
    ];

    // 3. Assign colors to regions using the smart placement logic.
    const regionColorMap = {};
    const assignedColors = {}; // Stores LAB values for quick lookup
    const availablePalette = [...initialColorPalette]; // Use a mutable copy of the palette

    for (const regionId of regionIds) {
        let placed = false;
        // Start with a high threshold and decrease it until a color can be placed.
        for (let threshold = 35; threshold >= 0 && !placed; threshold -= 3) {

            // Fallback if primary palette doesn't yield a valid color or threshold is very low
            if (!placed && threshold < 20) { // Only try fallback colors at low thresholds
                let assignedFallback = false;
                for (const fbColor of fallbackColors) { // Iterate through fallback colors
                    let isValidFallback = true;
                    const labFb = rgbToLab(...hslToRgb(fbColor.h, fbColor.s, fbColor.l));
                    const neighbors = regions[regionId].neighbors;

                    for (const neighborId of neighbors) {
                        if (assignedColors[neighborId]) {
                            if (deltaE(labFb, assignedColors[neighborId]) < threshold) {
                                isValidFallback = false;
                                break;
                            }
                        }
                    }

                    if (isValidFallback) {
                        regionColorMap[regionId] = fbColor;
                        assignedColors[regionId] = labFb;
                        placed = true;
                        assignedFallback = true;
                        break;
                    }
                }

                if (!assignedFallback) {
                    // If no fallback color works even with low threshold, use the hardcoded gray
                    regionColorMap[regionId] = {
                        h: 100,
                        s: 0,
                        l: 70
                    };
                    assignedColors[regionId] = rgbToLab(117, 117, 117);
                    placed = true;
                }
            }

            // Primary attempt: Use colors from the main palette
            for (let i = 0; i < availablePalette.length; i++) {
                const candidateColor = availablePalette[i];
                let isValid = true;

                const neighbors = regions[regionId].neighbors;
                for (const neighborId of neighbors) {
                    if (assignedColors[neighborId]) {
                        const lab1 = rgbToLab(...hslToRgb(candidateColor.h, candidateColor.s, candidateColor.l));
                        const lab2 = assignedColors[neighborId];
                        if (deltaE(lab1, lab2) < threshold) {
                            isValid = false;
                            break;
                        }
                    }
                }

                if (isValid) {
                    regionColorMap[regionId] = candidateColor;
                    assignedColors[regionId] = rgbToLab(...hslToRgb(candidateColor.h, candidateColor.s, candidateColor.l));
                    availablePalette.splice(i, 1); // Remove color from palette to ensure uniqueness among direct neighbors
                    placed = true;
                    break;
                }
            }
        }
    }

    // 4. Store the final map in the global state.
    state.regionColorMap = regionColorMap;
}
/**
 * Renders the main puzzle grid based on the current `state.regionGrid` and `state.gridDim`.
 * This function creates the cell elements, applies region coloring (or black/white mode),
 * draws region borders, and updates the marks (stars/X's) within each cell.
 * It also triggers canvas resizing and overlay redraws.
 * @returns {void}
 */
function renderGrid() {
    gridContainer.innerHTML = ''; // Clear existing grid cells.
    if (!state.gridDim || !state.regionGrid || state.regionGrid.length === 0) return;

    // Pre-calculate the color assignments for the regions.
    assignAndStoreRegionColors();
    // --------------------

    // Toggle a CSS class to switch between colored and black & white mode for regions.
    gridContainer.classList.toggle('bw-mode', state.isBwMode);
    // Set up CSS Grid properties dynamically based on grid dimensions.
    gridContainer.style.gridTemplateColumns = `repeat(${state.gridDim}, 1fr)`;
    gridContainer.style.gridTemplateRows = `repeat(${state.gridDim}, 1fr)`;
    gridContainer.style.setProperty('--grid-dim', state.gridDim);

    // Iterate through each cell in the grid to create and style its corresponding DOM element.
    for (let r = 0; r < state.gridDim; r++) {
        for (let c = 0; c < state.gridDim; c++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            cell.dataset.r = r; // Store row index as a data attribute.
            cell.dataset.c = c; // Store column index as a data attribute.

            // Apply background color based on region ID if not in black & white mode.
            if (!state.isBwMode) {
                const regionId = state.regionGrid[r][c];
                if (state.regionColorMap && state.regionColorMap[regionId]) {
                    const color = state.regionColorMap[regionId];
                    cell.style.backgroundColor = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
                }
                // ----------------

            }

            // Add CSS classes for region borders based on adjacent cell region IDs.
            if (c > 0 && state.regionGrid[r][c - 1] !== state.regionGrid[r][c]) cell.classList.add('region-border-l');
            if (c < state.gridDim - 1 && state.regionGrid[r][c + 1] !== state.regionGrid[r][c]) cell.classList.add('region-border-r');
            if (r > 0 && state.regionGrid[r - 1][c] !== state.regionGrid[r][c]) cell.classList.add('region-border-t');
            if (r < state.gridDim - 1 && state.regionGrid[r + 1][c] !== state.regionGrid[r][c]) cell.classList.add('region-border-b');

            // Update the visual mark (star, X, or dot) inside the cell.
            updateCellMark(cell, state.playerGrid[r][c]);
            gridContainer.appendChild(cell);
        }
    }
    resizeCanvas(); // Adjust canvas dimensions to match the grid.
    redrawAllOverlays(); // Redraw all canvas overlays (drawings, borders, solution).
}

/**
 * Updates the visual mark (star, 'X', or dot) displayed within a specific grid cell's DOM element.
 * @param {HTMLElement} cellElement - The DOM element representing the grid cell.
 * @param {number} markState - The numerical state of the mark (0: empty, 1: star, 2: X/dot).
 * @returns {void}
 */
function updateCellMark(cellElement, markState) {
    if (!cellElement) return; // Exit if the cell element is not provided.
    switch (markState) {
        case 1: // State 1: Star
            cellElement.innerHTML = STAR_SVG; // Insert SVG for a star.
            break;
        case 2: // State 2: X or Dot (based on user preference)
            cellElement.innerHTML = state.markIsX ? X_SVG : DOT_SVG; // Insert SVG for X or dot.
            break;
        default: // State 0: Empty
            cellElement.innerHTML = ''; // Clear the cell's content.
            break;
    }
}

/**
 * Iterates through the entire `playerGrid` and updates the visual marks for all cells.
 * This is typically called after an action that changes multiple cell marks or when the mark type (X/dot) is toggled.
 * @returns {void}
 */
function renderAllMarks() {
    for (let r = 0; r < state.gridDim; r++) {
        for (let c = 0; c < state.gridDim; c++) {
            const cell = gridContainer.querySelector(`[data-r='${r}'][data-c='${c}']`);
            updateCellMark(cell, state.playerGrid[r][c]);
        }
    }
}

/**
 * Updates the UI to highlight cells that violate Star Battle rules.
 * It checks for:
 * 1. Adjacent stars.
 * 2. More than `starsPerRegion` stars in any row.
 * 3. More than `starsPerRegion` stars in any column.
 * 4. More than `starsPerRegion` stars in any region.
 * Invalid stars are given an 'error-star' CSS class for visual feedback, which is cleared first.
 * This function is skipped if `state.highlightErrors` is false.
 * @returns {void}
 */
function updateErrorHighlightingUI() {
    // A set to store the string coordinates 'r,c' of stars that are invalid.
    const invalidStarCoords = new Set();

    // First, clear all existing error highlights from every cell to ensure a clean slate for the current check.
    for (let r = 0; r < state.gridDim; r++) {
        for (let c = 0; c < state.gridDim; c++) {
            const cell = gridContainer.querySelector(`[data-r='${r}'][data-c='${c}']`);
            if (cell) cell.classList.remove('error-star');
        }
    }

    // If the error highlighting setting is turned off or grid is not initialized, exit early after clearing.
    if (!state.highlightErrors || state.gridDim === 0) {
        return;
    }

    // Initialize data structures to count stars for rule checking.
    const stars = []; // Stores {r, c} for all stars.
    const rowCounts = Array(state.gridDim).fill(0); // Counts stars per row.
    const colCounts = Array(state.gridDim).fill(0); // Counts stars per column.
    const regionStars = {}; // Stores { regionId: [{r, c}, ...] } for stars within each region.

    // Populate the counting structures by iterating through the player grid.
    for (let r = 0; r < state.gridDim; r++) {
        for (let c = 0; c < state.gridDim; c++) {
            if (state.playerGrid[r][c] === 1) { // If a star is found.
                const starPos = { r, c };
                stars.push(starPos);
                rowCounts[r]++;
                colCounts[c]++;
                const regionId = state.regionGrid[r][c];
                if (!regionStars[regionId]) regionStars[regionId] = [];
                regionStars[regionId].push(starPos);
            }
        }
    }

    // RULE 1: Check for adjacent stars.
    // Iterate through each star and check its 8 surrounding cells.
    stars.forEach(star => {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue; // Skip the star itself.
                const nr = star.r + dr; // Neighbor row.
                const nc = star.c + dc; // Neighbor column.
                // If a neighboring cell is within bounds and also contains a star, mark the current star as invalid.
                if (nr >= 0 && nr < state.gridDim && nc >= 0 && nc < state.gridDim && state.playerGrid[nr][nc] === 1) {
                    invalidStarCoords.add(`${star.r},${star.c}`);
                }
            }
        }
    });

    // RULE 2: Check for too many stars in a row.
    for (let r = 0; r < state.gridDim; r++) {
        if (rowCounts[r] > state.starsPerRegion) {
            // If a row exceeds the star limit, mark all stars in that row as invalid.
            stars.forEach(star => {
                if (star.r === r) invalidStarCoords.add(`${star.r},${star.c}`);
            });
        }
    }

    // RULE 3: Check for too many stars in a column.
    for (let c = 0; c < state.gridDim; c++) {
        if (colCounts[c] > state.starsPerRegion) {
            // If a column exceeds the star limit, mark all stars in that column as invalid.
            stars.forEach(star => {
                if (star.c === c) invalidStarCoords.add(`${star.r},${star.c}`);
            });
        }
    }

    // RULE 4: Check for too many stars in a region.
    for (const regionId in regionStars) {
        if (regionStars[regionId].length > state.starsPerRegion) {
            // If a region exceeds the star limit, mark all stars in that region as invalid.
            regionStars[regionId].forEach(star => {
                invalidStarCoords.add(`${star.r},${star.c}`);
            });
        }
    }

    // Finally, apply the 'error-star' CSS class to all cells containing invalid stars for visual highlighting.
    invalidStarCoords.forEach(coord => {
        const [r, c] = coord.split(',');
        const cellElement = gridContainer.querySelector(`[data-r='${r}'][data-c='${c}']`);
        if (cellElement) {
            cellElement.classList.add('error-star');
        }
    });
}


/**
 * Resizes the drawing and buffer canvases to match the current dimensions of the grid container.
 * This ensures that drawings and overlays scale correctly with the grid.
 * It also copies the current drawing from the main canvas to the buffer canvas to preserve it during resize,
 * and then triggers a full redraw of all overlays.
 * @returns {void}
 */
function resizeCanvas() {
    const rect = gridContainer.getBoundingClientRect();

    if (state.bufferCtx) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = drawCanvas.width;
        tempCanvas.height = drawCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(drawCanvas, 0, 0);

        drawCanvas.width = rect.width;
        drawCanvas.height = rect.height;
        state.bufferCanvas.width = rect.width;
        state.bufferCanvas.height = rect.height;
        state.bufferCtx = state.bufferCanvas.getContext('2d');
        
        // Add this line
        state.bufferCtx.imageSmoothingEnabled = false;

        if (tempCanvas.width > 0 && tempCanvas.height > 0) {
            state.bufferCtx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
        }
    } else {
        // Fallback for initial load
        drawCanvas.width = rect.width;
        drawCanvas.height = rect.height;
        state.bufferCanvas.width = rect.width;
        state.bufferCanvas.height = rect.height;
        state.bufferCtx = state.bufferCanvas.getContext('2d');
    }

    redrawAllOverlays();
}

/**
 * Draws the puzzle solution as semi-transparent, glowing yellow circles on the `drawCtx` (main canvas).
 * This overlay is displayed only when `state.isViewingSolution` is true.
 * @returns {void}
 */
function drawSolutionOverlay() {
    if (!state.solution) return; // Do not draw if no solution is available.

    // Calculate cell dimensions based on canvas size and grid dimensions.
    const cellWidth = drawCanvas.width / state.gridDim;
    const cellHeight = drawCanvas.height / state.gridDim;

    drawCtx.fillStyle = 'rgba(252, 211, 77, 0.7)'; // Set fill color to semi-transparent amber.
    drawCtx.shadowColor = 'white'; // Set shadow color for a glowing effect.
    drawCtx.shadowBlur = 15; // Set shadow blur radius.

    // Iterate through the solution grid and draw a circle for each star.
    for (let r = 0; r < state.gridDim; r++) {
        for (let c = 0; c < state.gridDim; c++) {
            if (state.solution[r][c] === 1) { // If the solution indicates a star at this cell.
                const x = c * cellWidth + cellWidth / 2; // Calculate center X coordinate.
                const y = r * cellHeight + cellHeight / 2; // Calculate center Y coordinate.
                const radius = cellWidth / 4; // Set circle radius relative to cell size.

                drawCtx.beginPath(); // Start a new path.
                drawCtx.arc(x, y, radius, 0, 2 * Math.PI); // Draw a full circle.
                drawCtx.fill(); // Fill the circle.
            }
        }
    }
    drawCtx.shadowBlur = 0; // Reset shadow blur to prevent affecting subsequent drawings.
}

/**
 * Clears the main drawing canvas and then redraws all active overlays in the correct order:
 * 1. The buffered drawing content (from `state.bufferCanvas`).
 * 2. Custom user-drawn borders.
 * 3. The solution overlay if `state.isViewingSolution` is true.
 * @returns {void}
 */
function redrawAllOverlays() {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height); // Clear the entire main drawing canvas.

    drawCustomBorders(); // Draw any custom borders defined by the user.
    
    // Draw the content from the off-screen buffer canvas onto the main canvas.
    if (state.bufferCtx) {
        drawCtx.drawImage(state.bufferCanvas, 0, 0);
    }

    // If the user is currently viewing the solution, draw the solution overlay.
    if (state.isViewingSolution) {
        drawSolutionOverlay();
    }
}

/**
 * Draws all custom user-defined borders and the currently drawn border path onto the main drawing canvas.
 * Borders are rendered as thick lines along the edges of the specified cells.
 * @returns {void}
 */
function drawCustomBorders() {
    if (!state.gridDim || state.gridDim === 0) return; // Exit if grid dimensions are not set.

    // Calculate cell dimensions for drawing.
    const cellWidth = drawCanvas.width / state.gridDim;
    const cellHeight = drawCanvas.height / state.gridDim;
    const thickness = 8; // Define the thickness of the borders.

    // Combine existing custom borders with the border currently being drawn (if any).
    const allBorders = [...state.customBorders];
    if (state.currentBorderPath.size > 0) {
        allBorders.push({ path: state.currentBorderPath, color: state.currentColor });
    }

    // Iterate through each border set and draw its segments.
    allBorders.forEach(border => {
        drawCtx.fillStyle = border.color; // Set the fill color for the current border.
        border.path.forEach(cellPos => {
            const [r, c] = cellPos.split(',').map(Number); // Parse row and column from the cell position string.
            const x = c * cellWidth; // Calculate top-left X coordinate of the cell.
            const y = r * cellHeight; // Calculate top-left Y coordinate of the cell.

            // Draw border segments around the cell if an adjacent cell is not part of the same border path.
            if (!border.path.has(`${r - 1},${c}`)) drawCtx.fillRect(x, y, cellWidth, thickness); // Top border.
            if (!border.path.has(`${r + 1},${c}`)) drawCtx.fillRect(x, y + cellHeight - thickness, cellWidth, thickness); // Bottom border.
            if (!border.path.has(`${r},${c - 1}`)) drawCtx.fillRect(x, y, thickness, cellHeight); // Left border.
            if (!border.path.has(`${r},${c + 1}`)) drawCtx.fillRect(x + cellWidth - thickness, y, thickness, cellHeight); // Right border.
        });
    });
}

/**
 * **********************************************************************************
 * Title: Star Battle API and Data Management
 * **********************************************************************************
 * @author Isaiah Tadrous
 * @version 1.0.0
 * *-------------------------------------------------------------------------------
 * This script manages all asynchronous communication with the backend API for the
 * Star Battle puzzle application. Its responsibilities include fetching new
 * puzzles, sending the current puzzle to be solved by the server, and verifying
 * the correctness of a player's solution. It also implements the import and
 * export functionality, converting game states to and from a portable string
 * format (SBN) via API calls. Furthermore, it handles the client-side persistence
 * of game states by saving and loading puzzles, including player progress and
 * drawings, to and from the browser's local storage.
 * **********************************************************************************
 */

// --- API & PUZZLE DATA FUNCTIONS ---

// --- CORE API COMMUNICATION ---

/**
 * Fetches a new puzzle from the backend API based on the selected size.
 * On success, it clears the current game state, updates the state with the new
 * puzzle data, and renders the new grid.
 * @async
 * @returns {Promise<void>} A promise that resolves when the new puzzle is fetched and rendered.
 */
async function fetchNewPuzzle() {
    setLoading(true);
    const sizeId = sizeSelect.value;
    try {
        const response = await fetch(`${API_BASE_URL}/new_puzzle?size_id=${sizeId}`);
        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
        const data = await response.json();
        // Update global state with new puzzle data
        state.regionGrid = data.regionGrid;
        state.starsPerRegion = data.starsPerRegion;
        state.sourcePuzzleData = data.sourcePuzzleData;
        state.gridDim = data.regionGrid ? data.regionGrid.length : 0;
        state.solution = null;
        updateSolutionButtonUI();
        // Reset and render the game board
        clearPuzzleState();
        renderGrid();
        showScreen('game');
    } catch (error) {
        console.error("Error fetching new puzzle:", error);
        setStatus("Failed to load puzzle.", false);
    } finally {
        setLoading(false);
    }
}

/**
 * Sends the current puzzle's definition to the backend API to find a solution.
 * If a solution is found, it is stored in the state, and the UI is updated.
 * @async
 * @returns {Promise<void>} A promise that resolves when the solution attempt is complete.
 */
async function findSolution() {
    if (state.solution) return; // Don't re-fetch if solution is already known
    setLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/solve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                regionGrid: state.regionGrid,
                starsPerRegion: state.starsPerRegion,
                sourcePuzzleData: state.sourcePuzzleData
            })
        });
        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
        const data = await response.json();
        if (data.solution) {
            setStatus("Solution found! Tap 'View' to see it.", true);
            state.solution = data.solution;
            updateSolutionButtonUI();
        } else {
            setStatus("No solution exists for this puzzle.", false);
        }
    } catch (error) {
        console.error("Error finding solution:", error);
        setStatus("Solver failed.", false);
    } finally {
        setLoading(false);
    }
}

/**
 * Sends the current player's grid to the backend API to check if it's a correct solution.
 * Updates the status message based on the API's validation response.
 * @async
 * @returns {Promise<void>} A promise that resolves when the check is complete.
 */
async function checkSolution() {
    setLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                regionGrid: state.regionGrid,
                playerGrid: state.playerGrid,
                starsPerRegion: state.starsPerRegion,
                sourcePuzzleData: state.sourcePuzzleData
            })
        });
        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
        const data = await response.json();
        if (data.isCorrect) {
            let message = "Correct!";
            if (data.hashValidated) message += " (Hash Validated)";
            setStatus(message, true);
        } else {
            setStatus("Incorrect. Keep trying!", false);
        }
    } catch (error) {
        console.error("Error checking solution:", error);
        setStatus("Check failed.", false);
    } finally {
        setLoading(false);
    }
}

// --- IMPORT / EXPORT FUNCTIONALITY ---

/**
 * Imports a puzzle from a given string by sending it to the backend for parsing.
 * On success, it loads the puzzle definition and any included player progress.
 * @async
 * @param {string} importString - The puzzle data string (SBN or Web Task format).
 * @returns {Promise<boolean>} A promise that resolves to true on successful import, false otherwise.
 */
async function importPuzzleString(importString) {
    if (!importString) return;
    setLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/import`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ importString })
        });
        if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Invalid format'); }
        const data = await response.json();
        // Update state with imported puzzle data
        state.gridDim = data.regionGrid.length;
        state.starsPerRegion = data.starsPerRegion;
        state.regionGrid = data.regionGrid;
        state.sourcePuzzleData = data.sourcePuzzleData || {};
        state.solution = null;
        clearPuzzleState(); // Clear old state before loading new

        // If the import string includes player progress, reconstruct the state
        if (data.history && data.history.changes && Array.isArray(data.history.changes)) {
            const importedMarkHistory = data.history.changes;
            const newMarkStack = [];

            importedMarkHistory.forEach(change => {
                if (change.r < state.gridDim && change.c < state.gridDim) {
                    newMarkStack.push({ type: 'mark', r: change.r, c: change.c, from: change.from, to: change.to });
                }
            });

            state.playerGrid = data.playerGrid;
            state.history.mark.stack = newMarkStack;
            state.history.mark.pointer = newMarkStack.length - 1;
        }

        // Render the newly loaded puzzle and update UI
        renderGrid();
        updateErrorHighlightingUI();
        updateSolutionButtonUI();
        updateUndoRedoButtons();
        setStatus("Puzzle loaded successfully!", true);
        showScreen('game');
        return true;
    } catch (error) {
        console.error("Error importing puzzle:", error);
        setStatus(`Import failed: ${error.message}`, false);
        return false;
    } finally {
        setLoading(false);
    }
}

/**
 * Handles the user-facing import process by prompting for a puzzle string
 * and then calling the main import function.
 * @async
 * @returns {Promise<void>}
 */
async function handleImport() {
    const importString = prompt("Paste your puzzle string (SBN or Web Task format):");
    await importPuzzleString(importString);
}

/**
 * Exports the current game state to an SBN string via the backend API.
 * The resulting string is then copied to the user's clipboard.
 * @async
 * @returns {Promise<void>} A promise that resolves when the export process is complete.
 */
async function handleExport() {
    try {
        // Consolidate history into a simple list of changes for export
        const historyForExport = [];
        const stackToExport = state.history.mark.stack.slice(0, state.history.mark.pointer + 1);

        stackToExport.forEach(action => {
            if (action.type === 'mark') {
                historyForExport.push({ r: action.r, c: action.c, from: action.from, to: action.to });
            }
            else if (action.type === 'compoundMark') {
                action.changes.forEach(change => {
                    historyForExport.push({ r: change.r, c: change.c, from: change.from, to: change.to });
                });
            }
        });

        const response = await fetch(`${API_BASE_URL}/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                regionGrid: state.regionGrid,
                playerGrid: state.playerGrid,
                starsPerRegion: state.starsPerRegion,
                sourcePuzzleData: state.sourcePuzzleData,
                history: { changes: historyForExport }
            })
        });
        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
        const data = await response.json();
        // Copy to clipboard with a fallback prompt
        navigator.clipboard.writeText(data.exportString).then(() => {
            setStatus("SBN string copied to clipboard!", true);
        }, () => {
            prompt("Could not auto-copy. Here is your SBN string:", data.exportString);
        });
    } catch (error) {
        console.error("Error exporting puzzle:", error);
        setStatus("Export failed.", false);
    }
}

// --- LOCAL SAVE & LOAD MANAGEMENT ---

/**
 * Saves the current game state to the browser's local storage.
 * It first generates an SBN string via the API, then stores it along with
 * a user comment, timestamp, and canvas drawing data.
 * @async
 * @returns {Promise<void>} A promise that resolves when the save operation is complete.
 */
async function handleSave() {
    const comment = prompt("Enter a comment for this save:", "");
    if (comment === null) { // User cancelled the prompt
        setStatus("Save cancelled.", null, 1500);
        return;
    }
    try {
        // Create the exportable history object (same as in handleExport)
        const historyForExport = [];
        const stackToExport = state.history.mark.stack.slice(0, state.history.mark.pointer + 1);

        stackToExport.forEach(action => {
            if (action.type === 'mark') {
                historyForExport.push({ r: action.r, c: action.c, from: action.from, to: action.to });
            }
            else if (action.type === 'compoundMark') {
                action.changes.forEach(change => {
                    historyForExport.push({ r: change.r, c: change.c, from: change.from, to: change.to });
                });
            }
        });

        // Get the SBN string from the export endpoint
        const response = await fetch(`${API_BASE_URL}/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                regionGrid: state.regionGrid,
                playerGrid: state.playerGrid,
                starsPerRegion: state.starsPerRegion,
                sourcePuzzleData: state.sourcePuzzleData,
                history: { changes: historyForExport }
            })
        });
        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
        const data = await response.json();

        // Retrieve existing saves and prepend the new one
        const saves = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
        const newSave = {
            sbn: data.exportString,
            comment: comment || 'No comment',
            date: new Date().toISOString(),
            drawingData: state.bufferCanvas.toDataURL(), // Save canvas drawings
            borderData: state.customBorders.map(border => ({ // Save custom borders
                color: border.color,
                path: Array.from(border.path)
            }))
        };
        saves.unshift(newSave); // Add to the beginning of the list
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saves));
        setStatus("Puzzle saved successfully!", true);
    } catch (error) {
        console.error("Error saving puzzle:", error);
        setStatus("Save failed.", false);
    }
}

/**
 * Populates the "Load Game" modal with a list of puzzles saved in local storage.
 * It creates interactive HTML elements for each saved game.
 * @returns {void}
 */
function populateLoadModal() {
    const saves = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    modalContent.innerHTML = '';
    if (saves.length === 0) {
        modalContent.innerHTML = '<p class="text-gray-400 text-center">No puzzles saved yet.</p>';
        return;
    }
    saves.forEach((save, index) => {
        const saveDate = new Date(save.date);
        const dateString = saveDate.toLocaleString();
        const item = document.createElement('div');
        item.className = 'save-item';
        item.dataset.sbn = save.sbn;
        item.dataset.index = index;
        item.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-semibold text-lg text-gray-200">${save.comment}</p>
                    <p class="save-date">${dateString}</p>
                </div>
                <button class="delete-save-btn text-red-500 hover:text-red-400 font-bold text-2xl" data-index="${index}">&times;</button>
            </div>
        `;
        modalContent.appendChild(item);
    });
}
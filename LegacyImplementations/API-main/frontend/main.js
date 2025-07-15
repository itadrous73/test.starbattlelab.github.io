/**
 **********************************************************************************
 *
 * Star Battle Puzzle - Main Application Logic
 *
 * @author Joseph Bryant
 * @refactored by Isaiah Tadrous
 * @version 1.7.4
 *
 * -------------------------------------------------------------------------------
 *
 * Description:
 * This script serves as the main entry point and orchestrator for the Star
 * Battle puzzle application. It initializes all components once the DOM is
 * fully loaded, sets up event listeners for all UI controls (buttons, modals,
 * inputs), and coordinates communication with the backend API for fetching
 * puzzles, checking solutions, and handling import/export functionality. It
 * connects the user interface to the core application state and logic.
 *
 **********************************************************************************
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- UI & STATUS FUNCTIONS ---

    /**
     * Updates the loading spinner visibility based on the application's loading state.
     * @param {boolean} isLoading - True if the application is loading, false otherwise.
     */
    function setLoading(isLoading) {
        state.isLoading = isLoading;
        loadingSpinner.style.display = isLoading ? 'flex' : 'none';
    }

    /**
     * Displays a status message to the user, with optional success/error styling and auto-hide.
     * @param {string} message - The message to display.
     * @param {boolean|null} isSuccess - True for success, false for error, null/undefined for warning.
     * @param {number} [duration=3000] - Duration in milliseconds before the message fades. Set to 0 to keep visible.
     */
    function setStatus(message, isSuccess, duration = 3000) {
        solverStatus.textContent = message;
        solverStatus.classList.remove('text-green-400', 'text-red-400', 'text-yellow-400', 'opacity-0');
        if (isSuccess === true) {
            solverStatus.classList.add('text-green-400');
        } else if (isSuccess === false) {
            solverStatus.classList.add('text-red-400');
        } else {
            solverStatus.classList.add('text-yellow-400');
        }
        if (duration > 0) {
            setTimeout(() => solverStatus.classList.add('opacity-0'), duration);
        }
    }

    /**
     * Populates the puzzle size selection dropdown with available puzzle definitions.
     */
    function populateSizeSelector() {
        state.puzzleDefs.forEach((def, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = def.text;
            sizeSelect.appendChild(option);
        });
        // Sets a default selection, e.g., the 6x6 puzzle.
        sizeSelect.value = 5;
    }

    /**
     * Updates the text and color of the 'Find Solution' button based on whether a solution is currently loaded.
     */
    function updateSolutionButtonUI() {
        if (state.solution) {
            findSolutionBtn.textContent = 'View Solution';
            findSolutionBtn.style.backgroundColor = '#b5b538'; // Yellow-ish color for 'View'
        } else {
            findSolutionBtn.textContent = 'Find Solution';
            findSolutionBtn.style.backgroundColor = 'rgb(147 51 234)'; // Original purple color
        }
    }

    /**
     * Adjusts the UI elements (buttons, panels, canvas pointer events) based on the currently active interaction mode (mark, draw, border).
     */
    function updateModeUI() {
        const isMarking = state.activeMode === 'mark';
        const isDrawing = state.activeMode === 'draw';
        const isBordering = state.activeMode === 'border';

        markModeBtn.classList.toggle('selected', isMarking);
        drawModeBtn.classList.toggle('selected', isDrawing);
        borderModeBtn.classList.toggle('selected', isBordering);

        toggleMarkBtn.style.display = isMarking ? 'block' : 'none';

        document.getElementById('color-picker-wrapper').style.display = (isDrawing || isBordering) ? 'block' : 'none';
        document.getElementById('brush-size-wrapper').style.display = isDrawing ? 'block' : 'none';

        drawCanvas.style.pointerEvents = (isDrawing || isBordering) ? 'auto' : 'none';

        if (isDrawing) {
            clearBtn.title = 'Clear all drawings from the canvas (Undoable)';
        } else if (isBordering) {
            clearBtn.title = 'Clear all custom borders (Undoable)';
        } else {
            clearBtn.title = 'Clear all stars and marks (Undoable)';
        }
    }

    // --- API & DATA HANDLING FUNCTIONS ---

    /**
     * Fetches a new puzzle from the API based on the selected size.
     * Updates the application state with the new puzzle data and re-renders the grid.
     */
    async function fetchNewPuzzle() {
        setLoading(true);
        const sizeId = sizeSelect.value;
        try {
            const response = await fetch(`${API_BASE_URL}/new_puzzle?size_id=${sizeId}`);
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const data = await response.json();
            state.regionGrid = data.regionGrid;
            state.starsPerRegion = data.starsPerRegion;
            state.sourcePuzzleData = data.sourcePuzzleData;
            state.gridDim = data.regionGrid ? data.regionGrid.length : 0;
            state.solution = null;
            updateSolutionButtonUI();
            clearPuzzleState();
            renderGrid();
        } catch (error) {
            console.error("Error fetching new puzzle:", error);
            setStatus("Failed to load puzzle.", false);
        } finally {
            setLoading(false);
        }
    }

    /**
     * Requests a solution for the current puzzle from the API.
     * If a solution is found, it updates the application state and UI.
     */
    async function findSolution() {
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
                console.log("--- Solution Found ---");
                setStatus("Solution found!", true);
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
     * Sends the player's current grid state to the API for verification.
     * Updates the UI with the check result (correct or incorrect).
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

    /**
     * Imports a puzzle from a given string (SBN or Web Task format).
     * Updates the game state and UI, including player marks and history if provided in the string.
     * @param {string} importString - The puzzle string to import.
     * @returns {Promise<boolean>} True if import was successful, false otherwise.
     */
    async function importPuzzleString(importString) {
        if (!importString) return false;
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ importString })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Invalid format');
            }
            const data = await response.json();

            state.gridDim = data.regionGrid.length;
            state.starsPerRegion = data.starsPerRegion;
            state.regionGrid = data.regionGrid;
            state.sourcePuzzleData = data.sourcePuzzleData || {};
            state.solution = null;

            clearPuzzleState();

            if (data.history && data.history.changes && Array.isArray(data.history.changes)) {
                const importedMarkHistory = data.history.changes;
                const markHistoryStack = [];

                importedMarkHistory.forEach(change => {
                    if (change.r < state.gridDim && change.c < state.gridDim) {
                        state.playerGrid[change.r][change.c] = change.to;
                        markHistoryStack.push({
                            type: 'mark',
                            r: change.r,
                            c: change.c,
                            from: change.from,
                            to: change.to
                        });
                    }
                });

                state.history.mark.stack = markHistoryStack;
                state.history.mark.pointer = markHistoryStack.length - 1;
            }

            renderGrid();
            updateErrorHighlightingUI();
            updateSolutionButtonUI();
            updateUndoRedoButtons();
            setStatus("Puzzle loaded successfully!", true);
            return true;
        } catch (error) {
            console.error("Error importing puzzle:", error);
            setStatus(`Import failed: ${error.message}`, false);
            // Fallback to fetching a new puzzle if import fails
            await fetchNewPuzzle();
            return false;
        } finally {
            setLoading(false);
        }
    }

    /**
     * Prompts the user for a puzzle string and attempts to import it.
     */
    async function handleImport() {
        const importString = prompt("Paste your puzzle string (SBN or Web Task format):");
        await importPuzzleString(importString);
    }

    /**
     * Exports the current puzzle state (including player marks and history) to an SBN string.
     * Copies the string to the clipboard or prompts the user if auto-copy fails.
     */
    async function handleExport() {
        try {
            // Create a flat list of history changes suitable for export.
            const historyForExport = [];
            // Only export actions up to the current pointer to avoid redoing undone actions.
            const stackToExport = state.history.mark.stack.slice(0, state.history.mark.pointer + 1);

            stackToExport.forEach(action => {
                if (action.type === 'mark') {
                    // Simple mark action.
                    historyForExport.push({
                        r: action.r,
                        c: action.c,
                        from: action.from,
                        to: action.to
                    });
                } else if (action.type === 'compoundMark') {
                    // Compound mark action, iterate through its inner changes.
                    action.changes.forEach(change => {
                        historyForExport.push({
                            r: change.r,
                            c: change.c,
                            from: change.from,
                            to: change.to
                        });
                    });
                }
                // 'clearMarks' actions are not directly exported; the final state of playerGrid reflects the clear.
            });

            const response = await fetch(`${API_BASE_URL}/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    regionGrid: state.regionGrid,
                    playerGrid: state.playerGrid,
                    starsPerRegion: state.starsPerRegion,
                    sourcePuzzleData: state.sourcePuzzleData,
                    history: {
                        changes: historyForExport // Send the flattened history.
                    }
                })
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const data = await response.json();
            navigator.clipboard.writeText(data.exportString).then(() => {
                setStatus("SBN string copied to clipboard!", true);
            }, () => {
                // Fallback if clipboard API fails (e.g., due to permissions).
                prompt("Could not auto-copy. Here is your SBN string:", data.exportString);
            });
        } catch (error) {
            console.error("Error exporting puzzle:", error);
            setStatus("Export failed.", false);
        }
    }

    /**
     * Saves the current puzzle state, including player marks, drawings, and borders, to local storage.
     * Prompts the user for an optional comment for the save entry.
     */
    async function handleSave() {
        const comment = prompt("Enter a comment for this save:", "");
        if (comment === null) {
            setStatus("Save cancelled.", null, 1500);
            return;
        }

        try {
            // Create a flat history list for export, similar to handleExport.
            const historyForExport = [];
            const stackToExport = state.history.mark.stack.slice(0, state.history.mark.pointer + 1);

            stackToExport.forEach(action => {
                if (action.type === 'mark') {
                    historyForExport.push({
                        r: action.r, c: action.c, from: action.from, to: action.to
                    });
                } else if (action.type === 'compoundMark') {
                    action.changes.forEach(change => {
                        historyForExport.push({
                            r: change.r, c: change.c, from: change.from, to: change.to
                        });
                    });
                }
            });

            // Call the /export endpoint to get the SBN string for saving.
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

            // Retrieve existing saves, add the new save, and store back to local storage.
            const saves = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');

            const newSave = {
                sbn: data.exportString,
                comment: comment || 'No comment',
                date: new Date().toISOString(),
                drawingData: state.bufferCanvas.toDataURL(), // Save drawing canvas content as Data URL.
                borderData: state.customBorders.map(border => ({
                    color: border.color,
                    path: Array.from(border.path) // Convert Set to Array for serialization.
                }))
            };

            saves.unshift(newSave); // Add new save to the beginning of the array.
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saves));

            setStatus("Puzzle saved successfully!", true);
        } catch (error) {
            console.error("Error saving puzzle:", error);
            setStatus("Save failed.", false);
        }
    }

    /**
     * Populates the load puzzle modal with a list of saved puzzles from local storage.
     * Includes options to load or delete saved entries.
     */
    function populateLoadModal() {
        const saves = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
        modalContent.innerHTML = ''; // Clear previous content.

        if (saves.length === 0) {
            modalContent.innerHTML = '<p class="text-gray-400 text-center">No puzzles saved yet.</p>';
            return;
        }

        saves.forEach((save, index) => {
            const saveDate = new Date(save.date);
            const dateString = saveDate.toLocaleString(); // Format date for display.

            const item = document.createElement('div');
            item.className = 'save-item';
            item.dataset.sbn = save.sbn; // Store SBN string for loading.
            item.dataset.index = index; // Store index for deletion.

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

    // --- INITIALIZATION ---

    /**
     * Initializes the application by setting up event listeners and fetching the initial puzzle.
     */
    function init() {
        populateSizeSelector();

        // Attach event listeners to main control buttons.
        newPuzzleBtn.addEventListener('click', fetchNewPuzzle);
        savePuzzleBtn.addEventListener('click', handleSave);
        checkSolutionBtn.addEventListener('click', checkSolution);
        importBtn.addEventListener('click', handleImport);
        exportBtn.addEventListener('click', handleExport);
        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);

        // Clear button functionality based on active mode.
        clearBtn.addEventListener('click', () => {
            let action = { type: null };
            switch (state.activeMode) {
                case 'draw':
                    if (!state.bufferCtx || state.bufferCanvas.width === 0) return;
                    action = {
                        type: 'clearDraw',
                        before: state.bufferCtx.getImageData(0, 0, state.bufferCanvas.width, state.bufferCanvas.height)
                    };
                    state.bufferCtx.clearRect(0, 0, state.bufferCanvas.width, state.bufferCanvas.height);
                    redrawAllOverlays();
                    break;
                case 'border':
                    if (state.customBorders.length === 0) return;
                    action = {
                        type: 'clearBorder',
                        before: deepCopyBorders(state.customBorders) // Make a deep copy for undo.
                    };
                    state.customBorders = [];
                    redrawAllOverlays();
                    break;
                case 'mark':
                    if (confirm('Are you sure you want to clear all stars and marks? This CAN be undone. (click Undo)')) {
                        action = {
                            type: 'clearMarks',
                            before: JSON.parse(JSON.stringify(state.playerGrid)) // Deep copy player grid for undo.
                        };
                        _internalClearMarks();
                        renderAllMarks();
                        updateErrorHighlightingUI();
                    }
                    break;
            }

            if (action.type) {
                pushHistory(action); // Record clear action for undo/redo.
            }
        });

        // Toggle between dot and 'X' marks.
        toggleMarkBtn.addEventListener('click', () => {
            state.markIsX = !state.markIsX;
            toggleMarkBtn.textContent = state.markIsX ? "Dots" : "Xs";
            renderAllMarks();
            updateErrorHighlightingUI();
        });

        /**
         * Switches the active interaction mode and updates the UI accordingly.
         * @param {string} newMode - The mode to switch to ('mark', 'draw', or 'border').
         */
        function switchMode(newMode) {
            state.activeMode = newMode;
            updateModeUI();
            updateUndoRedoButtons();
        }

        markModeBtn.addEventListener('click', () => switchMode('mark'));
        drawModeBtn.addEventListener('click', () => switchMode('draw'));
        borderModeBtn.addEventListener('click', () => switchMode('border'));

        // 'Find Solution' button behavior: find or view.
        findSolutionBtn.addEventListener('mousedown', () => {
            if (state.solution) {
                state.isViewingSolution = true;
                redrawAllOverlays();
            } else {
                findSolution();
            }
        });
        const stopViewingSolution = () => {
            if (state.isViewingSolution) {
                state.isViewingSolution = false;
                redrawAllOverlays();
            }
        };
        findSolutionBtn.addEventListener('mouseup', stopViewingSolution);
        findSolutionBtn.addEventListener('mouseleave', stopViewingSolution);

        // Modal for loading saved puzzles.
        loadPuzzleBtn.addEventListener('click', () => {
            populateLoadModal();
            loadModal.classList.remove('hidden');
        });

        modalCloseBtn.addEventListener('click', () => {
            loadModal.classList.add('hidden');
        });

        // Modal for settings.
        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.remove('hidden');
        });
        settingsModalCloseBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });

        // Settings toggles.
        bwModeToggle.addEventListener('change', (e) => {
            state.isBwMode = e.target.checked;
            renderGrid();
        });
        highlightErrorsToggle.addEventListener('change', (e) => {
            state.highlightErrors = e.target.checked;
            updateErrorHighlightingUI();
        });
        autoXAroundToggle.addEventListener('change', (e) => {
            state.autoXAroundStars = e.target.checked;
        });
        autoXMaxLinesToggle.addEventListener('change', (e) => {
            state.autoXOnMaxLines = e.target.checked;
        });
        autoXMaxRegionsToggle.addEventListener('change', (e) => {
            state.autoXOnMaxRegions = e.target.checked;
        });

        // Event delegation for load modal content (load and delete saves).
        modalContent.addEventListener('click', async (e) => {
            const saveItem = e.target.closest('.save-item');
            const deleteBtn = e.target.closest('.delete-save-btn');

            if (deleteBtn) {
                e.stopPropagation(); // Prevent save item click event.
                const indexToDelete = parseInt(deleteBtn.dataset.index, 10);
                if (confirm('Are you sure you want to delete this save?')) {
                    let saves = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
                    saves.splice(indexToDelete, 1); // Remove the save at the specified index.
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saves));
                    populateLoadModal(); // Refresh modal content.
                }
            } else if (saveItem) {
                const indexToLoad = parseInt(saveItem.dataset.index, 10);
                const saves = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
                const saveToLoad = saves[indexToLoad];
                if (!saveToLoad) return;

                const success = await importPuzzleString(saveToLoad.sbn);

                if (success) {
                    // Restore custom borders.
                    if (saveToLoad.borderData) {
                        state.customBorders = saveToLoad.borderData.map(border => ({
                            color: border.color,
                            path: new Set(border.path) // Convert array back to Set.
                        }));
                    }

                    // Restore drawing canvas.
                    if (saveToLoad.drawingData) {
                        const img = new Image();
                        img.onload = () => {
                            if (state.bufferCtx) {
                                state.bufferCtx.drawImage(img, 0, 0);
                            }
                            redrawAllOverlays();
                        };
                        img.src = saveToLoad.drawingData;
                    }

                    redrawAllOverlays();
                    loadModal.classList.add('hidden');
                }
            }
        });

        // Brush size slider for drawing/bordering modes.
        brushSizeSlider.addEventListener('input', (e) => {
            const newSize = parseInt(e.target.value, 10);
            state.brushSize = newSize;
            brushSizeValue.textContent = newSize;
        });

        // Color picker functionality.
        customColorBtn.addEventListener('click', () => {
            state.colorToReplace = state.currentColor; // Store current color to replace for custom color slot.
            htmlColorPicker.click(); // Programmatically click the hidden HTML color input.
        });
        htmlColorPicker.addEventListener('input', (e) => selectColor(e.target.value));
        htmlColorPicker.addEventListener('change', (e) => saveCustomColor(e.target.value));
        presetColorsContainer.addEventListener('click', (e) => {
            if (e.target.dataset.color) selectColor(e.target.dataset.color);
        });
        customColorsContainer.addEventListener('click', (e) => {
            if (e.target.dataset.color) {
                selectColor(e.target.dataset.color);
            } else if (e.target.dataset.customIndex) {
                state.colorToReplace = null; // Don't replace current, just pick.
                htmlColorPicker.click();
            }
        });

        // Mouse and resize event listeners for grid interaction and rendering.
        gridContainer.addEventListener('mousedown', handleMouseDown);
        drawCanvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        gridContainer.addEventListener('contextmenu', e => e.preventDefault()); // Prevent right-click context menu.
        drawCanvas.addEventListener('contextmenu', e => e.preventDefault());
        window.addEventListener('resize', resizeCanvas);

        // Keyboard shortcuts for Undo/Redo (Ctrl/Cmd + Z/Y).
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) { // Check for Ctrl or Command key.
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault(); // Prevent browser's default undo.
                        undo();
                        break;
                    case 'y':
                        e.preventDefault(); // Prevent browser's default redo.
                        redo();
                        break;
                }
            }
        });

        // Initial setup calls.
        fetchNewPuzzle();
        updateModeUI();
        renderColorPicker();
    }

    init(); // Run the initialization function when the DOM is ready.
});
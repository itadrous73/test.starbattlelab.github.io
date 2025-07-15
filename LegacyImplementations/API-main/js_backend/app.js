/**
 **********************************************************************************
 *
 * Star Battle Puzzle - Node.js API Server
 *
 * @author Isaiah Tadrous
 * @version 1.0.0
 *
 * -------------------------------------------------------------------------------
 *
 * Description:
 * This file defines a lightweight Express.js server that acts as the backend API
 * for the Star Battle puzzle platform. It serves as a communication bridge between
 * the client and puzzle-solving logic, offering endpoints to:
 *   - Fetch random puzzles from local storage
 *   - Solve puzzles using the Z3 SMT solver (via WebAssembly)
 *   - Check player solutions for correctness
 *   - Import/export puzzles using SBN (Star Battle Notation) format
 *
 * The server is stateless and optimized for fast interactions with a static front-end.
 * It is designed to run alongside or in place of a Python backend.
 *
 * Logic referenced from a Python implementation developed by Joseph Bryant.
 *
 **********************************************************************************
 */


import express from 'express';
import cors from 'cors';
import * as pz from './puzzleHandler.js';
import { HistoryManager } from './historyManager.js';
import { Z3StarBattleSolver, Z3_AVAILABLE } from './z3Solver.js';
import * as consts from './constants.js';

const app = express();
const PORT = 5001; // Same port as your Python backend

app.use(cors());
app.use(express.json()); // Middleware to parse JSON bodies

// --- API ENDPOINTS ---

app.get('/api/new_puzzle', (req, res) => {
    try {
        const sizeId = parseInt(req.query.size_id || 5, 10);
        if (sizeId < 0 || sizeId >= consts.PUZZLE_DEFINITIONS.length) {
            return res.status(400).json({ error: 'Invalid size_id' });
        }
        const puzzleData = pz.getPuzzleFromLocalFile(sizeId);
        if (puzzleData) {
            const [regionGrid] = pz.getGridFromPuzzleTask(puzzleData);
            if (regionGrid) {
                return res.json({
                    regionGrid: regionGrid,
                    starsPerRegion: puzzleData.stars,
                    sourcePuzzleData: puzzleData
                });
            }
        }
        res.status(500).json({ error: 'Failed to fetch puzzle from local files' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'An internal error occurred' });
    }
});

app.post('/api/solve', async (req, res) => {
    if (!Z3_AVAILABLE) {
        return res.status(503).json({ error: 'Z3 Solver not available on the server' });
    }
    try {
        const { regionGrid, starsPerRegion } = req.body;
        if (!regionGrid || !starsPerRegion) {
            return res.status(400).json({ error: 'Missing regionGrid or starsPerRegion' });
        }
        const solver = new Z3StarBattleSolver(regionGrid, starsPerRegion);
        const [solutions] = await solver.solve(); // Await the async solve method
        res.json({ solution: solutions.length > 0 ? solutions[0] : null });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'An internal error occurred' });
    }
});

app.post('/api/check', async (req, res) => {
    if (!Z3_AVAILABLE) {
        return res.status(503).json({ error: 'Z3 Solver not available on the server' });
    }
    try {
        const { regionGrid, playerGrid, starsPerRegion } = req.body;
        if (!regionGrid || !playerGrid || starsPerRegion === undefined) {
            return res.status(400).json({ error: 'Missing data in request' });
        }
        
        const solver = new Z3StarBattleSolver(regionGrid, starsPerRegion);
        const [solutions] = await solver.solve();
        
        let isCorrect = false;
        if (solutions.length > 0) {
            const playerSolution = playerGrid.map(row => row.map(cell => (cell === consts.STATE_STAR ? 1 : 0)));
            // Check if player's solution matches any of the valid solutions
            if (solutions.some(sol => JSON.stringify(sol) === JSON.stringify(playerSolution))) {
                 isCorrect = true;
            }
        }
        res.json({ isCorrect });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'An internal error occurred' });
    }
});


app.post('/api/export', (req, res) => {
    try {
        const { regionGrid, playerGrid, starsPerRegion, history } = req.body;
        if (!regionGrid || !playerGrid || starsPerRegion === undefined) {
            return res.status(400).json({ error: 'Missing data in request' });
        }

        let sbnString = pz.encodeToSbn(regionGrid, starsPerRegion, playerGrid);
        
        if (history && history.changes) {
            const manager = new HistoryManager([[]]); // Dummy initial state
            manager.changes = history.changes;
            manager.pointer = history.pointer || history.changes.length;
            const historyStr = manager.serialize();
            if (historyStr) {
                sbnString += `~${historyStr}`;
            }
        }
        res.json({ exportString: sbnString });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'An internal error occurred' });
    }
});

app.post('/api/import', (req, res) => {
    try {
        const { importString } = req.body;
        if (!importString) {
            return res.status(400).json({ error: 'No import string provided' });
        }
        const puzzleData = pz.universalImport(importString);
        if (!puzzleData) {
            return res.status(400).json({ error: 'Could not recognize puzzle format' });
        }
        const [regionGrid] = pz.parseAndValidateGrid(puzzleData.task);
        res.json({
            regionGrid,
            playerGrid: puzzleData.player_grid,
            starsPerRegion: puzzleData.stars,
            history: puzzleData.history
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'An internal error occurred' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});
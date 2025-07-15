/**
 **********************************************************************************
 *
 * Star Battle Puzzle - Puzzle File & SBN Handler
 *
 * @author Isaiah Tadrous
 * @version 1.0.0
 *
 * -------------------------------------------------------------------------------
 *
 * Description:
 * This file manages the loading and processing of Star Battle puzzles from local
 * storage and encoded SBN (Star Battle Notation) strings. It supports:
 *   - Random puzzle selection from `.txt` files
 *   - Decoding and encoding of SBN region and annotation data
 *   - Parsing puzzle metadata, including player history and annotations
 *
 * It also includes logic for reconstructing region grids from compressed border
 * bitfields and validating puzzle dimensions. This acts as a bridge between raw
 * puzzle data and usable, in-memory representations for gameplay and UI logic.
 *
 * Logic referenced from a Python implementation developed by Joseph Bryant.
 *
 **********************************************************************************
 */


import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HistoryManager } from './historyManager.js';
import * as consts from './constants.js';

// Helper to get the directory name in ES Modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getPuzzleFromLocalFile(sizeId) {
    try {
        const filePath = path.join(__dirname, 'puzzles', `${sizeId}.txt`);
        if (!fs.existsSync(filePath)) return null;

        const puzzles = fs.readFileSync(filePath, 'utf-8').split('\n').filter(line => line.trim());
        if (puzzles.length === 0) return null;

        const randomSbnString = puzzles[Math.floor(Math.random() * puzzles.length)];
        return decodeSbn(randomSbnString);
    } catch (e) {
        console.error(`Error in getPuzzleFromLocalFile: ${e}`);
        return null;
    }
}

export function universalImport(inputString) {
    const parts = inputString.trim().split('~');
    const [mainPart, historyPart] = [parts[0], parts[1] || ""];
    let puzzleData = null;
    let rawAnnotationData = "";

    // Try SBN
    if (mainPart.length >= 4 && consts.SBN_CODE_TO_DIM_MAP[mainPart.substring(0, 2)]) {
        puzzleData = decodeSbn(mainPart);
        const [, dim] = parseAndValidateGrid(puzzleData.task);
        if (dim && mainPart[3] === 'e') {
            const borderCharsNeeded = Math.ceil((2 * dim * (dim - 1)) / 6);
            rawAnnotationData = mainPart.substring(4 + borderCharsNeeded);
        }
    }

    if (puzzleData) {
        const [, dim] = parseAndValidateGrid(puzzleData.task);
        if (dim) {
            puzzleData.player_grid = decodePlayerAnnotations(rawAnnotationData, dim);
            if (historyPart) {
                const mgr = HistoryManager.deserialize([[]], historyPart); // Initial state is dummy
                puzzleData.history = { "changes": mgr.changes, "pointer": mgr.pointer };
            }
        }
        return puzzleData;
    }
    return null; // Simplified to only support SBN for this example
}

export function encodePlayerAnnotations(playerGrid) {
    if (!playerGrid || playerGrid.length === 0) return "";
    const dim = playerGrid.length;
    const gameToSbn = { [consts.STATE_EMPTY]: 0, [consts.STATE_SECONDARY_MARK]: 1, [consts.STATE_STAR]: 2 };
    const flat = playerGrid.flat().map(cell => gameToSbn[cell] || 0);
    if (!flat.some(v => v > 0)) return "";
    
    let sbnStates = "";
    for (let i = 0; i < flat.length; i += 3) {
        const chunk = flat.slice(i, i + 3);
        while (chunk.length < 3) chunk.push(0);
        const value = chunk[0] * 16 + chunk[1] * 4 + chunk[2];
        sbnStates += consts.SBN_INT_TO_CHAR[value];
    }
    return sbnStates;
}


export function decodePlayerAnnotations(annotationDataStr, dim) {
    const grid = Array.from({ length: dim }, () => Array(dim).fill(consts.STATE_EMPTY));
    if (!annotationDataStr) return grid;
    
    const sbnToGame = { 0: consts.STATE_EMPTY, 1: consts.STATE_SECONDARY_MARK, 2: consts.STATE_STAR };
    let cellCursor = 0;
    
    for (const char of annotationDataStr) {
        const value = consts.SBN_CHAR_TO_INT[char] || 0;
        const states = [Math.floor(value / 16), Math.floor((value % 16) / 4), value % 4];
        for (let i = 0; i < 3 && cellCursor < dim * dim; i++, cellCursor++) {
            const r = Math.floor(cellCursor / dim);
            const c = cellCursor % dim;
            grid[r][c] = sbnToGame[states[i]];
        }
    }
    return grid;
}


export function encodeToSbn(regionGrid, stars, playerGrid = null) {
    const dim = regionGrid.length;
    const sbnCode = consts.DIM_TO_SBN_CODE_MAP[dim];
    if (!sbnCode) return null;

    const verticalBits = [];
    for (let r = 0; r < dim; r++) {
        for (let c = 0; c < dim - 1; c++) {
            verticalBits.push(regionGrid[r][c] !== regionGrid[r][c+1] ? '1' : '0');
        }
    }

    const horizontalBits = [];
    for (let c = 0; c < dim; c++) {
        for (let r = 0; r < dim - 1; r++) {
            horizontalBits.push(regionGrid[r][c] !== regionGrid[r+1][c] ? '1' : '0');
        }
    }
    
    let bitfield = verticalBits.join('') + horizontalBits.join('');
    const padding = (6 - bitfield.length % 6) % 6;
    bitfield = '0'.repeat(padding) + bitfield;

    let regionData = "";
    for (let i = 0; i < bitfield.length; i+= 6) {
        regionData += consts.SBN_INT_TO_CHAR[parseInt(bitfield.substring(i, i+6), 2)];
    }

    const rawAnnotationData = playerGrid ? encodePlayerAnnotations(playerGrid) : "";
    const flag = rawAnnotationData ? 'e' : 'W';

    return `${sbnCode}${stars}${flag}${regionData}${rawAnnotationData}`;
}


export function decodeSbn(sbnString) {
    try {
        const dim = consts.SBN_CODE_TO_DIM_MAP[sbnString.substring(0, 2)];
        const stars = parseInt(sbnString[2], 10);
        const borderBitsNeeded = 2 * dim * (dim - 1);
        const borderCharsNeeded = Math.ceil(borderBitsNeeded / 6);
        const regionData = sbnString.substring(4, 4 + borderCharsNeeded);

        const fullBitfield = Array.from(regionData)
            .map(c => (consts.SBN_CHAR_TO_INT[c] || 0).toString(2).padStart(6, '0'))
            .join('').slice(-borderBitsNeeded);
        
        const vBits = fullBitfield.substring(0, dim * (dim - 1));
        const hBits = fullBitfield.substring(dim * (dim - 1));

        const regionGrid = reconstructGridFromBorders(dim, vBits, hBits);
        const taskStr = regionGrid.flat().join(',');
        return { task: taskStr, stars };
    } catch (e) {
        console.error(`Failed to decode SBN: ${e}`);
        throw e;
    }
}

export function reconstructGridFromBorders(dim, vBits, hBits) {
    const grid = Array.from({ length: dim }, () => Array(dim).fill(0));
    let regionId = 1;
    for (let r_start = 0; r_start < dim; r_start++) {
        for (let c_start = 0; c_start < dim; c_start++) {
            if (grid[r_start][c_start] === 0) {
                const q = [{ r: r_start, c: c_start }]; // Use array as a queue (BFS)
                grid[r_start][c_start] = regionId;
                while (q.length > 0) {
                    const { r, c } = q.shift();
                    // Check neighbors
                    if (c < dim - 1 && grid[r][c + 1] === 0 && vBits[r * (dim - 1) + c] === '0') {
                        grid[r][c + 1] = regionId;
                        q.push({ r, c: c + 1 });
                    }
                    if (c > 0 && grid[r][c - 1] === 0 && vBits[r * (dim - 1) + c - 1] === '0') {
                        grid[r][c - 1] = regionId;
                        q.push({ r, c: c - 1 });
                    }
                    if (r < dim - 1 && grid[r + 1][c] === 0 && hBits[c * (dim - 1) + r] === '0') {
                        grid[r + 1][c] = regionId;
                        q.push({ r: r + 1, c });
                    }
                    if (r > 0 && grid[r - 1][c] === 0 && hBits[c * (dim - 1) + r - 1] === '0') {
                        grid[r - 1][c] = regionId;
                        q.push({ r: r - 1, c });
                    }
                }
                regionId++;
            }
        }
    }
    return grid;
}

export function parseAndValidateGrid(taskString) {
    if (!taskString) return [null, null];
    try {
        const nums = taskString.split(',').map(Number);
        if (nums.length === 0) return [null, null];
        const dim = Math.sqrt(nums.length);
        if (!Number.isInteger(dim)) return [null, null];
        
        const grid = [];
        for (let i = 0; i < dim; i++) {
            grid.push(nums.slice(i * dim, (i + 1) * dim));
        }
        return [grid, dim];
    } catch (e) {
        return [null, null];
    }
}

export function getGridFromPuzzleTask(puzzleData) {
    if (!puzzleData || !puzzleData.task) return [null, null];
    return parseAndValidateGrid(puzzleData.task);
}
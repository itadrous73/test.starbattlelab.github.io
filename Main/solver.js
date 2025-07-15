/**
 **********************************************************************************
 *
 * Star Battle Puzzle - Ultimate Client-Side Solver
 *
 * @author Isaiah Tadrous
 * @version 1.0.0
 *
 * -------------------------------------------------------------------------------
 *
 * Description:
 * This file contains a comprehensive, client-side backtracking solver for Star
 * Battle puzzles. It includes the UltimateStarBattleSolver class which can find
 * one or more solutions for a given puzzle definition. It also provides necessary
 * utility functions for combinations, memoization, and performance measurement,
 * translated from the original Python implementation.
 *
 **********************************************************************************
 */

// --- Constants & Utilities ---
const [EMPTY, STAR, ELIMINATED] = [0, 1, -1];

// Re-implementation of Python's itertools.combinations
function* combinations(arr, k) {
    const n = arr.length;
    if (k > n || k < 0) return;
    if (k === 0) {
        yield [];
        return;
    }
    const indices = Array.from({ length: k }, (_, i) => i);
    while (true) {
        yield indices.map(i => arr[i]);
        let i = k - 1;
        while (i >= 0 && indices[i] === i + n - k) {
            i--;
        }
        if (i < 0) return;
        indices[i]++;
        for (let j = i + 1; j < k; j++) {
            indices[j] = indices[j - 1] + 1;
        }
    }
}

// Re-implementation of Python's functools.lru_cache (memoization)
function memoize(fn) {
    const cache = new Map();
    const memoizedFn = function(...args) {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            memoizedFn.cacheInfo.hits++;
            return cache.get(key);
        }
        memoizedFn.cacheInfo.misses++;
        const result = fn.apply(this, args);
        cache.set(key, result);
        memoizedFn.cacheInfo.size = cache.size;
        return result;
    };
    memoizedFn.cache = cache;
    memoizedFn.cacheInfo = { hits: 0, misses: 0, size: 0 };
    return memoizedFn;
}

// --- The Ultimate Solver Class ---
class UltimateStarBattleSolver {
    constructor(regionGrid, starsPerRegion) {
        this.regionGrid = regionGrid;
        this.dim = regionGrid.length;
        this.stars_per_region = starsPerRegion;
        this.solutions = [];
        this.max_solutions = 2; // Find up to 2 to check for uniqueness
        this.stats = { nodes_visited: 0, max_recursion_depth: 0 };
        
        this.regions = new Map();
        for (let r = 0; r < this.dim; r++) {
            for (let c = 0; c < this.dim; c++) {
                const regionId = this.regionGrid[r][c];
                if (!this.regions.has(regionId)) {
                    this.regions.set(regionId, []);
                }
                this.regions.get(regionId).push([r, c]);
            }
        }
    }

    solve() {
        const initialBoard = Array(this.dim).fill(0).map(() => Array(this.dim).fill(EMPTY));
        const unsolvedRegions = new Set(this.regions.keys());
        // Reset cache stats for this run
        UltimateStarBattleSolver.getInternallyValidCombos.cacheInfo = { hits: 0, misses: 0, size: UltimateStarBattleSolver.getInternallyValidCombos.cache.size };
        this._backtrack(initialBoard, unsolvedRegions, 0);
        return { solutions: this.solutions, stats: this.stats };
    }

    _isPlacementValid(r, c, board) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const [nr, nc] = [r + dr, c + dc];
                if (nr >= 0 && nr < this.dim && nc >= 0 && nc < this.dim && board[nr][nc] === STAR) {
                    return false;
                }
            }
        }
        return true;
    }
    
    _propagate_constraints(board) {
        let madeChange = true;
        while (madeChange) {
            madeChange = false;

            for (let r = 0; r < this.dim; r++) {
                for (let c = 0; c < this.dim; c++) {
                    if (board[r][c] === STAR) {
                        for (let dr = -1; dr <= 1; dr++) {
                            for (let dc = -1; dc <= 1; dc++) {
                                const [nr, nc] = [r + dr, c + dc];
                                if (nr >= 0 && nr < this.dim && nc >= 0 && nc < this.dim && board[nr][nc] === EMPTY) {
                                    board[nr][nc] = ELIMINATED;
                                    madeChange = true;
                                }
                            }
                        }
                    }
                }
            }
            
            const groups = [
                ...Array.from({length: this.dim}, (_, r) => Array.from({length: this.dim}, (_, c) => [r, c])),
                ...Array.from({length: this.dim}, (_, c) => Array.from({length: this.dim}, (_, r) => [r, c])),
                ...Array.from(this.regions.values())
            ];

            for (const group of groups) {
                const starCount = group.reduce((sum, [r, c]) => sum + (board[r][c] === STAR ? 1 : 0), 0);
                const availableCells = group.filter(([r, c]) => board[r][c] === EMPTY);

                if (starCount > this.stars_per_region) return null;
                if (starCount + availableCells.length < this.stars_per_region) return null;

                if (starCount === this.stars_per_region) {
                    for (const [r, c] of availableCells) {
                        if (board[r][c] === EMPTY) {
                            board[r][c] = ELIMINATED;
                            madeChange = true;
                        }
                    }
                } else if (starCount + availableCells.length === this.stars_per_region) {
                    for (const [r, c] of availableCells) {
                         if (!this._isPlacementValid(r, c, board)) return null;
                         if (board[r][c] === EMPTY) {
                            board[r][c] = STAR;
                            madeChange = true;
                         }
                    }
                }
            }
        }
        return board;
    }
    
    _backtrack(board, unsolvedRegions, depth) {
        this.stats.nodes_visited++;
        this.stats.max_recursion_depth = Math.max(this.stats.max_recursion_depth, depth);

        let currentBoard = this._propagate_constraints(board.map(row => [...row]));
        if (currentBoard === null) {
            return;
        }
        
        const remainingUnsolved = new Set(unsolvedRegions);
        for (const regionId of unsolvedRegions) {
            const starsPlaced = this.regions.get(regionId).reduce((sum, [r, c]) => sum + (currentBoard[r][c] === STAR ? 1 : 0), 0);
            if (starsPlaced >= this.stars_per_region) {
                remainingUnsolved.delete(regionId);
            }
        }

        if (remainingUnsolved.size === 0) {
            const totalStars = currentBoard.flat().filter(cell => cell === STAR).length;
            if (totalStars === this.dim * this.stars_per_region) {
                this.solutions.push(currentBoard.map(row => row.map(cell => (cell === STAR ? 1 : 0))));
            }
            return;
        }

        const choices = [];
        for (const regionId of remainingUnsolved) {
            const starsPlaced = this.regions.get(regionId).reduce((sum, [r, c]) => sum + (currentBoard[r][c] === STAR ? 1 : 0), 0);
            const starsToPlace = this.stars_per_region - starsPlaced;
            const availableCells = this.regions.get(regionId).filter(([r, c]) => currentBoard[r][c] === EMPTY);
            if (availableCells.length < starsToPlace) return;
            
            const validCombos = UltimateStarBattleSolver.getInternallyValidCombos(availableCells, starsToPlace);
            if (validCombos.length === 0) return;
            
            choices.push({ id: regionId, combos: validCombos });
        }
        
        if (choices.length === 0) return;

        const bestChoice = choices.reduce((min, choice) => (choice.combos.length < min.combos.length ? choice : min), choices[0]);
        const regionId = bestChoice.id;

        for (const combo of bestChoice.combos) {
            let isExternallyValid = true;
            for (const [r_new, c_new] of combo) {
                if (!this._isPlacementValid(r_new, c_new, currentBoard)) {
                    isExternallyValid = false;
                    break;
                }
            }
            if (!isExternallyValid) continue;
            
            const nextBoard = currentBoard.map(row => [...row]);
            for (const [r, c] of combo) {
                nextBoard[r][c] = STAR;
            }
            
            const nextUnsolved = new Set(remainingUnsolved);
            nextUnsolved.delete(regionId);

            this._backtrack(nextBoard, nextUnsolved, depth + 1);
            if (this.solutions.length >= this.max_solutions) return;
        }
    }
}

UltimateStarBattleSolver.getInternallyValidCombos = memoize(function(availableCells, numToPlace) {
    const validCombos = [];
    for (const combo of combinations(availableCells, numToPlace)) {
        if (numToPlace <= 1) {
            validCombos.push(combo);
            continue;
        }
        let isInternallyValid = true;
        for (let i = 0; i < combo.length; i++) {
            for (let j = i + 1; j < combo.length; j++) {
                const [r1, c1] = combo[i];
                const [r2, c2] = combo[j];
                if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) {
                    isInternallyValid = false;
                    break;
                }
            }
            if (!isInternallyValid) break;
        }
        if (isInternallyValid) {
            validCombos.push(combo);
        }
    }
    return validCombos;
});
/**
 **********************************************************************************
 *
 * Star Battle Puzzle - Z3 Solver Logic (WebAssembly Integration)
 *
 * @author Isaiah Tadrous
 * @version 1.0.0
 *
 * -------------------------------------------------------------------------------
 *
 * Description:
 * This module implements a Star Battle puzzle solver using the Z3 theorem prover,
 * compiled to WebAssembly for full client-side execution. It encodes the standard
 * Star Battle constraints:
 *   - Exactly N stars per row and column
 *   - Exactly N stars per region
 *   - No adjacent stars (including diagonals)
 *
 * This file handles the initialization of the Z3 solver environment, and constructs
 * logical constraints based on a region grid and star count. All solving is done
 * within isolated contexts to ensure consistent results and memory safety.
 *
 * Logic referenced from a Python implementation developed by Joseph Bryant.
 *
 **********************************************************************************
 */


import { init } from 'z3-solver';

// The only thing we do globally is initialize the Z3 factory.
const z3FactoryPromise = init().catch(e => {
    console.error("FATAL: 'z3-solver' library failed to initialize.", e);
    return null;
});

export const Z3_AVAILABLE = (await z3FactoryPromise) !== null;
if (Z3_AVAILABLE) {
    console.log('Z3 Solver Factory Initialized Successfully.');
}

export class Z3StarBattleSolver {
    constructor(regionGrid, starsPerRegion) {
        this.regionGrid = regionGrid;
        this.dim = regionGrid.length;
        this.starsPerRegion = starsPerRegion;
    }

    async solve() {
        const factory = await z3FactoryPromise;
        if (!factory) {
            console.error("Attempted to solve, but Z3 factory is not available.");
            return [[], {}];
        }

        // Create a new, clean context for EVERY solve request for isolation.
        const ctx = factory.Context('main');
        
        const s = new ctx.Solver();
        const gridVars = Array.from({ length: this.dim }, (_, r) =>
            Array.from({ length: this.dim }, (_, c) => ctx.Bool.const(`c_${r}_${c}`))
        );

        const addSumConstraint = (vars, k) => {
            if (!vars || vars.length === 0) return;
            const z3Ints = vars.map(v => ctx.If(v, ctx.Int.val(1), ctx.Int.val(0)));
            s.add(ctx.Sum(...z3Ints).eq(ctx.Int.val(k)));
        };

        // Rule: N stars per row and column
        for (let i = 0; i < this.dim; i++) {
            addSumConstraint(gridVars[i], this.starsPerRegion);
            addSumConstraint(gridVars.map(row => row[i]), this.starsPerRegion);
        }

        // Rule: N stars per region
        const regions = {};
        for (let r = 0; r < this.dim; r++) {
            for (let c = 0; c < this.dim; c++) {
                const regionId = this.regionGrid[r][c];
                if (!regions[regionId]) regions[regionId] = [];
                regions[regionId].push(gridVars[r][c]);
            }
        }
        for (const regionId in regions) {
            addSumConstraint(regions[regionId], this.starsPerRegion);
        }

        // Rule: Stars cannot be adjacent
        for (let r = 0; r < this.dim; r++) {
            for (let c = 0; c < this.dim; c++) {
                const neighbors = [];
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < this.dim && nc >= 0 && nc < this.dim) {
                            neighbors.push(gridVars[nr][nc].not());
                        }
                    }
                }
                if (neighbors.length > 0) {
                    s.add(gridVars[r][c].implies(ctx.And(...neighbors)));
                }
            }
        }

        const solutions = [];
        if (await s.check() === 'sat') {
            const model = s.model();
            const solution = gridVars.map(row => row.map(cell => (model.get(cell).toString() === 'true' ? 1 : 0)));
            solutions.push(solution);
        }
        
        // FINAL FIX: There is no .delete() method. Memory is handled automatically by the JS garbage collector
        // when this function returns and the context/solver go out of scope.

        return [solutions, {}];
    }
}
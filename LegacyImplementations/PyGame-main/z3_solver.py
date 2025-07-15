"""**********************************************************************************
 * Title: z3_solver.py
 *
 * @author Joseph Bryant
 * @version 1.0.1
 * -------------------------------------------------------------------------------
 * Description:
 * This module provides the core logic for solving Star Battle puzzles using
 * the Z3 theorem prover. It defines the Z3StarBattleSolver class, which
 * translates the rules of the game (stars per row, column, and region, and
 * no adjacent stars) into a set of logical constraints. The solver then
 * attempts to find one or more models that satisfy these constraints, which
 * correspond to valid puzzle solutions. The module includes a graceful
 * fallback mechanism, allowing the application to run even if the 'z3-solver'
 * library is not installed, by disabling solver-dependent functionality.
 **********************************************************************************"""

# --- IMPORTS AND Z3 AVAILABILITY ---
import hashlib
import time
from collections import defaultdict

try:
    # Attempt to import the required components from the Z3 library.
    from z3 import Solver, Bool, PbEq, Implies, And, Not, Or, sat
    Z3_AVAILABLE = True
except ImportError:
    # If Z3 is not installed, print a warning and set up dummy objects/functions
    # to prevent the application from crashing when solver-related code is called.
    print("Warning: 'z3-solver' library not found.")
    Z3_AVAILABLE = False
    # Define placeholder classes and functions to avoid runtime errors.
    class Solver: pass
    def Bool(s): return None
    def PbEq(s, i): return None
    def Implies(a,b): return None
    def And(s): return None
    def Not(s): return None
    def Or(s): return None
    sat = "sat"

# --- HELPER FUNCTIONS ---
def format_duration(seconds):
    """
    Formats a time duration in seconds into a more human-readable string.

    :param float seconds: The duration in seconds to format.
    :returns: The formatted time string (e.g., "1.234 s", "5.67 ms", "1 min 30.00 s").
    :rtype: str
    """
    if seconds >= 60: return f"{int(seconds//60)} min {seconds%60:.2f} s"
    if seconds >= 1: return f"{seconds:.3f} s"
    return f"{seconds*1000:.2f} ms"

# --- SOLVER CLASS ---
class Z3StarBattleSolver:
    """A class to solve Star Battle puzzles using the Z3 SMT solver."""
    def __init__(self, region_grid, stars_per_region):
        """
        Initializes the solver with the puzzle's constraints.

        :param list[list[int]] region_grid: The 2D grid defining the puzzle regions.
        :param int stars_per_region: The number of stars required per region/row/column.
        """
        self.region_grid, self.dim, self.stars_per_region = region_grid, len(region_grid), stars_per_region

    def solve(self):
        """
        Formulates the puzzle constraints and uses Z3 to find up to two solutions.

        :returns: A tuple containing a list of solutions and an empty stats dictionary.
                  Each solution is a 2D grid of 0s and 1s.
        :rtype: tuple[list, dict]
        """
        if not Z3_AVAILABLE: return [], {}
        s = Solver()
        grid_vars = [[Bool(f"c_{r}_{c}") for c in range(self.dim)] for r in range(self.dim)]

        # Rule: N stars per row and column
        for i in range(self.dim):
            s.add(PbEq([(grid_vars[i][c], 1) for c in range(self.dim)], self.stars_per_region))
            s.add(PbEq([(grid_vars[r][i], 1) for r in range(self.dim)], self.stars_per_region))

        # Rule: N stars per region
        regions = defaultdict(list)
        for r in range(self.dim):
            for c in range(self.dim): regions[self.region_grid[r][c]].append(grid_vars[r][c])
        for r_vars in regions.values():
            s.add(PbEq([(var, 1) for var in r_vars], self.stars_per_region))

        # Rule: Stars cannot be adjacent (including diagonally)
        for r in range(self.dim):
            for c in range(self.dim):
                neighbors = []
                for dr in [-1, 0, 1]:
                    for dc in [-1, 0, 1]:
                        if dr == 0 and dc == 0: continue
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < self.dim and 0 <= nc < self.dim:
                            neighbors.append(Not(grid_vars[nr][nc]))
                if neighbors:
                    s.add(Implies(grid_vars[r][c], And(neighbors)))

        solutions = []
        # Find the first solution
        if s.check() == sat:
            model = s.model()
            solution = [[(1 if model.evaluate(grid_vars[r][c]) else 0) for c in range(self.dim)] for r in range(self.dim)]
            solutions.append(solution)
            
            # Block this solution and check for another to test for uniqueness
            s.add(Or([Not(v) if solution[r][c] else v for r, row in enumerate(grid_vars) for c, v in enumerate(row)]))
            if s.check() == sat:
                model2 = s.model()
                solutions.append([[(1 if model2.evaluate(grid_vars[r][c]) else 0) for c in range(self.dim)] for r in range(self.dim)])

        return solutions, {}

"""
**********************************************************************************
* Title: action_handlers.py
*
* Metadata:
* @author Joseph Bryant
* @refactored by Isaiah Tadrous
* @version 1.5.3
* -------------------------------------------------------------------------------
* Description:
* This module serves as the central hub for event and action handling in the
* Star Battle puzzle application. It contains all the functions that are
* triggered by user interactions with the Pygame UI, such as button clicks
* and menu selections. These handlers bridge the gap between the user
* interface (ui_manager), the core game logic (game_state), puzzle data
* operations (puzzle_handler), and the Z3 solver, effectively acting as the
* controller in the application's architecture.
*
**********************************************************************************
"""
# action_handlers.py
# Description: Contains all functions that handle UI events and actions.

import pygame
import time
import constants as const
import puzzle_handler as pz
import ui_manager as ui
from z3_solver import Z3StarBattleSolver, format_duration, Z3_AVAILABLE

# --- BUTTON ACTION HANDLERS ---
def handle_new_puzzle(game_state):
    """
    Loads a new puzzle from a local file based on the current size selection.

    It fetches the appropriate puzzle size from the game state, calls the
    puzzle handler to get a random puzzle, and then resets the game state
    with the new puzzle data.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    size_to_fetch = game_state.current_size_selection
    if size_to_fetch == -1:
        size_to_fetch = 5
    new_puzzle_data = pz.get_puzzle_from_local_file(size_to_fetch)
    if new_puzzle_data:
        game_state.reset_puzzle_state(new_puzzle_data)
        game_state.current_size_selection = size_to_fetch

def handle_save(game_state):
    """
    Saves the current puzzle state, including history, to a file.

    It prompts the user for a comment via the UI console and then calls the
    puzzle handler to write the complete puzzle data (SBN, Web Task, history)
    to the 'saved_puzzles.txt' file.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    comment = ui.get_comment_from_console()
    # FIXED: Call the restored save function from puzzle_handler
    pz.save_puzzle_entry(game_state.puzzle_data, game_state.player_grid, game_state.history, comment)
    game_state.screen = pygame.display.set_mode((const.WINDOW_WIDTH, const.WINDOW_HEIGHT))

def handle_import(game_state):
    """
    Imports a puzzle from a user-provided string.

    Prompts the user for an import string (SBN or Web Task format) and uses
    the universal import function to parse it. If successful, the game state
    is reset with the imported puzzle.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    input_string = ui.get_input_from_console()
    game_state.screen = pygame.display.set_mode((const.WINDOW_WIDTH, const.WINDOW_HEIGHT))
    if input_string:
        new_puzzle_data = pz.universal_import(input_string)
        if new_puzzle_data:
            game_state.reset_puzzle_state(new_puzzle_data)
            game_state.current_size_selection = -1

def handle_export(game_state):
    """
    Prints export strings for the current puzzle state to the console.

    Generates both SBN and Web Task format strings for the current puzzle,
    including player annotations and history, and prints them to the
    standard output for the user to copy.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    if game_state.region_grid:
        sbn_export = pz.encode_to_sbn(game_state.region_grid, game_state.stars_per_region, game_state.player_grid)
        raw_annotation_data = pz.encode_player_annotations(game_state.player_grid)
        web_task_export = f"{game_state.puzzle_data.get('task', '')}{raw_annotation_data}"
        history_str = game_state.history.serialize()
        if history_str:
            sbn_export += f"~{history_str}"
            web_task_export += f"~{history_str}"
        print(f"\n--- EXPORTED STRINGS ---\nSBN: {sbn_export}\nWeb Task: {web_task_export}\n----------------------")

def handle_clear(game_state):
    """
    Clears either drawings, borders, or player marks depending on the current mode.

    If in draw mode, it clears the drawing surface. If in border mode, it
    removes all custom borders. Otherwise, it resets the player's grid and
    the action history.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    if game_state.is_draw_mode:
        game_state.draw_surface.fill((0, 0, 0, 0))
    elif game_state.is_border_mode:
        game_state.custom_borders = []
    else:
        initial_grid = [[const.STATE_EMPTY] * game_state.grid_dim for _ in range(game_state.grid_dim)]
        game_state.history.reset(initial_grid)
        game_state.update_player_grid_from_history()

def handle_toggle_mark_type(game_state):
    """
    Toggles the secondary mark between an 'X' and a dot.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    game_state.mark_is_x = not game_state.mark_is_x

def handle_toggle_mode(game_state):
    """
    Toggles between marking mode and drawing mode.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    game_state.is_draw_mode = not game_state.is_draw_mode
    if game_state.is_draw_mode:
        game_state.is_border_mode = False

def handle_toggle_border_mode(game_state):
    """
    Toggles between marking mode and border drawing mode.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    game_state.is_border_mode = not game_state.is_border_mode
    if game_state.is_border_mode:
        game_state.is_draw_mode = False

def handle_undo(game_state):
    """
    Undoes the last action in the history manager.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    if game_state.history.can_undo():
        game_state.history.undo()
        game_state.update_player_grid_from_history()

def handle_redo(game_state):
    """
    Redoes the last undone action in the history manager.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    if game_state.history.can_redo():
        game_state.history.redo()
        game_state.update_player_grid_from_history()

def handle_check_solution(game_state):
    """
    Uses the Z3 solver to check if the user's solution is correct.

    It compares the player's current grid of stars against the set of all
    valid solutions found by the solver and provides visual feedback.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    if not Z3_AVAILABLE:
        game_state.solution_status = "Z3 Solver not available"
        return
    solver = Z3StarBattleSolver(game_state.region_grid, game_state.stars_per_region)
    start_time = time.monotonic()
    solutions, _ = solver.solve()
    duration = time.monotonic() - start_time
    print(f"Z3 solve time: {format_duration(duration)}")
    player_solution_grid = [[1 if cell == const.STATE_STAR else 0 for cell in row] for row in game_state.player_grid]
    is_correct = False
    if not solutions:
        game_state.solution_status = "Incorrect! (No solution exists)"
    elif player_solution_grid in solutions:
        is_correct = True
        game_state.solution_status = "Correct!" + (" (Multiple solutions exist)" if len(solutions) > 1 else "")
    else:
        game_state.solution_status = "Incorrect!"
    game_state.feedback_overlay_color = const.COLOR_CORRECT if is_correct else const.COLOR_INCORRECT
    game_state.feedback_overlay_alpha = 128

def handle_find_solution(game_state):
    """
    Uses the Z3 solver to find a valid solution.

    If a solution is found, it is printed to the terminal in a grid format.
    It does not alter the player's current grid.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    if not Z3_AVAILABLE:
        game_state.solution_status = "Z3 Solver not available"
        return
    solver = Z3StarBattleSolver(game_state.region_grid, game_state.stars_per_region)
    start_time = time.monotonic()
    solutions, _ = solver.solve()
    duration = time.monotonic() - start_time
    print(f"Z3 solve time: {format_duration(duration)}")
    if not solutions:
        print("RESULT: No solution found.")
    else:
        print(f"RESULT: Found {len(solutions)} solution(s).")
        # FIXED: Call the display function from ui_manager
        ui.display_terminal_grid(game_state.region_grid, "Solution 1", solutions[0])

# --- Other UI Handlers ---
def handle_select_size(game_state, size_id):
    """Handles the user clicking on a new puzzle size button."""
    game_state.current_size_selection = size_id
    handle_new_puzzle(game_state)

def handle_select_color(game_state, color_index):
    """Sets the current drawing color."""
    game_state.current_color_index = color_index

"""
**********************************************************************************
* Title: main.py
*
* Metadata:
* @author Joseph Bryant
* @refactored by Isaiah Tadrous
* @version 1.7.3
* -------------------------------------------------------------------------------
* Description:
* This script is the main entry point for the Star Battle Playground
* application. It is responsible for initializing the Pygame environment,
* setting up the main window, loading resources like fonts, and creating the
* initial game state. It defines the main game loop which continuously
* handles user input events, updates the game state accordingly by calling
* action handlers, and renders the entire UI and puzzle grid to the screen.
* It orchestrates the interactions between all other modules.
*
**********************************************************************************
"""
# --- SETUP AND INITIALIZATION ---
import os
import platform
import logging

# --- SETUP LOGGING ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


# Enable ANSI escape code support on Windows 10+
if platform.system() == "Windows":
    import ctypes
    kernel32 = ctypes.windll.kernel32
    ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
    STD_OUTPUT_HANDLE = -11

    handle = kernel32.GetStdHandle(STD_OUTPUT_HANDLE)
    mode = ctypes.c_ulong()
    kernel32.GetConsoleMode(handle, ctypes.byref(mode))
    mode.value |= ENABLE_VIRTUAL_TERMINAL_PROCESSING
    kernel32.SetConsoleMode(handle, mode)

import warnings
import pygame
import sys

# Suppress Pygame welcome message and warnings
os.environ['PYGAME_HIDE_SUPPORT_PROMPT'] = "1"
warnings.filterwarnings("ignore", category=RuntimeWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# --- MODULE IMPORTS ---
import constants as const
import puzzle_handler as pz
import ui_manager as ui
import action_handlers as actions
from game_state import GameState
from ui_elements import Button
from z3_solver import Z3_AVAILABLE

# --- MAIN APPLICATION FUNCTION ---
def main():
    """
    The main function to initialize and run the game application.

    This function sets up Pygame, fonts, the initial game state, and the UI layout.
    It contains the main game loop that processes events, updates the state,
    and draws the game to the screen.

    :returns None:
    """
    # --- PYGAME AND FONT INITIALIZATION ---
    pygame.init()
    pygame.display.set_caption("Star Battle Playground")
    clock = pygame.time.Clock()

    fonts = {
        'default': pygame.font.Font(None, 32),
        'small': pygame.font.Font(None, 24),
        'tiny': pygame.font.Font(None, 18)
    }

    # --- UI PANEL LAYOUT DEFINITION ---
    # Data-driven layout for the control panel
    panel_layout = [
        {'type': 'button', 'id': 'new', 'text': 'New Puzzle', 'ideal_height': 45},
        {'type': 'button', 'id': 'save', 'text': 'Save Puzzle', 'ideal_height': 45},
        {'type': 'button_group', 'ideal_height': 45, 'items': [
            {'id': 'import', 'text': 'Import', 'width_ratio': 0.5},
            {'id': 'export', 'text': 'Export', 'width_ratio': 0.5}
        ]},
        {'type': 'button_group', 'ideal_height': 45, 'items': [
            {'id': 'clear', 'text': 'Clear', 'width_ratio': 0.5},
            {'id': 'toggle', 'text': 'Xs', 'width_ratio': 0.5}
        ]},
        {'type': 'button_group', 'ideal_height': 45, 'items': [
            {'id': 'back', 'text': 'Undo', 'width_ratio': 0.5},
            {'id': 'forward', 'text': 'Redo', 'width_ratio': 0.5}
        ]},
        {'type': 'button', 'id': 'toggle_mode', 'text': 'Draw Mode', 'ideal_height': 45},
        {'type': 'button', 'id': 'border_mode', 'text': 'Add Border', 'ideal_height': 45},
        {'type': 'button_group', 'ideal_height': 45, 'items': [
            {'id': 'color_r', 'text': '', 'width_ratio': 0.25},
            {'id': 'color_b', 'text': '', 'width_ratio': 0.25},
            {'id': 'color_y', 'text': '', 'width_ratio': 0.25},
            {'id': 'color_g', 'text': '', 'width_ratio': 0.25}
        ]},
        {'type': 'title', 'id': 'size_title', 'text': 'Board Size', 'ideal_height': 25},
        {'type': 'size_grid', 'id': 'size_selector', 'ideal_height': 160},
        {'type': 'button', 'id': 'find', 'text': 'Find Solution', 'ideal_height': 45, 'fixed_bottom': True},
        {'type': 'button', 'id': 'check', 'text': 'Check Solution', 'ideal_height': 45, 'fixed_bottom': True}
    ]

    # --- INITIAL GAME STATE SETUP ---
    # UPDATED: Fetch initial puzzle from local file system
    initial_puzzle_data = pz.get_puzzle_from_local_file(5) # Default to size_id 5 (10x10 Medium)
    if not initial_puzzle_data:
        logging.critical("Failed to load initial puzzle. Make sure the 'puzzles' directory and files exist. Exiting.")
        sys.exit(1)

    game_state = GameState(initial_puzzle_data, fonts)
    ui_elements = ui.build_panel_from_layout(panel_layout, fonts)
    game_state.set_ui_elements(ui_elements)


    # --- ACTION HANDLER MAPPING ---
    # Map action IDs from the UI layout to their handler functions
    action_map = {
        'new': actions.handle_new_puzzle,
        'save': actions.handle_save,
        'import': actions.handle_import,
        'export': actions.handle_export,
        'clear': actions.handle_clear,
        'toggle': actions.handle_toggle_mark_type,
        'back': actions.handle_undo,
        'forward': actions.handle_redo,
        'toggle_mode': actions.handle_toggle_mode,
        'border_mode': actions.handle_toggle_border_mode,
        'check': actions.handle_check_solution,
        'find': actions.handle_find_solution,
    }

    # --- MAIN GAME LOOP ---
    running = True
    while running:
        # --- EVENT HANDLING ---
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
                break

            # --- UI BUTTON EVENT HANDLING ---
            action = None
            for name, elem in game_state.ui_elements.items():
                if isinstance(elem, Button) and elem.handle_event(event):
                    action = name
                    break

            if action in action_map:
                action_map[action](game_state)
                continue

            # --- SIZE AND COLOR SELECTOR EVENT HANDLING ---
            if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                pos = event.pos
                size_buttons = game_state.ui_elements.get('size_selector', {})
                if size_buttons:
                    for size_id, b_data in size_buttons.items():
                        if b_data['rect'].collidepoint(pos):
                            actions.handle_select_size(game_state, size_id)
                            break

                color_map = {'color_r': 0, 'color_b': 1, 'color_y': 2, 'color_g': 3}
                if action in color_map:
                    actions.handle_select_color(game_state, color_map[action])

            # --- DIRECT MOUSE-ON-GRID EVENT HANDLING ---
            handle_mouse_input(event, game_state)

        if not running: break

        # --- DRAWING ---
        ui.draw_game(game_state)
        clock.tick(60)

    # --- CLEANUP ---
    pygame.quit()
    sys.exit()

# --- MOUSE INPUT HANDLING ---
def handle_mouse_input(event, game_state):
    """
    Processes all direct mouse interactions with the grid area.

    This function routes mouse events (clicks, motion) to the correct logic
    based on the currently active mode (Border, Draw, or Mark).

    :param pygame.event.Event event: The Pygame event to process.
    :param GameState game_state: The current state of the game.
    :returns None:
    """
    if event.type not in [pygame.MOUSEBUTTONDOWN, pygame.MOUSEBUTTONUP, pygame.MOUSEMOTION]:
        return

    pos = event.pos
    # Ignore clicks outside the grid area (on the control panel)
    if pos[0] >= const.GRID_AREA_WIDTH:
        return

    # --- BORDER MODE LOGIC ---
    if game_state.is_border_mode:
        col = int(pos[0] // game_state.cell_size)
        row = int(pos[1] // game_state.cell_size)

        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1: # Left-click starts drawing a border
                game_state.is_left_down = True
                game_state.current_border_path = {(row, col)}
            elif event.button == 3: # Right-click erases a border
                game_state.is_right_down = True
                game_state.custom_borders = [shape for shape in game_state.custom_borders if (row, col) not in shape]

        elif event.type == pygame.MOUSEMOTION:
            if game_state.is_left_down and 0 <= row < game_state.grid_dim and 0 <= col < game_state.grid_dim:
                game_state.current_border_path.add((row, col))
            elif game_state.is_right_down:
                 game_state.custom_borders = [shape for shape in game_state.custom_borders if (row, col) not in shape]


        elif event.type == pygame.MOUSEBUTTONUP:
            if event.button == 1: # Finish drawing a border
                game_state.is_left_down = False
                if game_state.current_border_path:
                    game_state.custom_borders.append(game_state.current_border_path)
                game_state.current_border_path = set()
            elif event.button == 3:
                game_state.is_right_down = False
        return # Prevent fall-through to other modes

    # --- DRAW MODE LOGIC ---
    if game_state.is_draw_mode:
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1: game_state.is_left_down = True
            if event.button == 3: game_state.is_right_down = True # Right-click is eraser
            game_state.last_pos = pos
        elif event.type == pygame.MOUSEMOTION and (game_state.is_left_down or game_state.is_right_down):
            color = const.DRAWING_COLORS[game_state.current_color_index] if game_state.is_left_down else (0,0,0,0)
            current_brush_size = game_state.brush_size if game_state.is_left_down else game_state.brush_size * 6
            if game_state.last_pos is not None:
                # Draw a line to fill gaps between motion events
                pygame.draw.line(game_state.draw_surface, color, game_state.last_pos, pos, current_brush_size * 2 + 1)
            pygame.draw.circle(game_state.draw_surface, color, pos, current_brush_size)
            game_state.last_pos = pos
        elif event.type == pygame.MOUSEBUTTONUP:
            if event.button == 1: game_state.is_left_down = False
            if event.button == 3: game_state.is_right_down = False
            game_state.last_pos = None
        return # Prevent fall-through to other modes

    # --- MARK MODE LOGIC ---
    if event.type == pygame.MOUSEBUTTONDOWN:
        if event.button == 1: game_state.is_left_down = True
        if event.button == 3: game_state.is_right_down = True
        col = int(pos[0] // game_state.cell_size)
        row = int(pos[1] // game_state.cell_size)
        if 0 <= row < game_state.grid_dim and 0 <= col < game_state.grid_dim:
            if event.button == 1: # Left-click prepares for a click or drag
                game_state.is_dragging = False
                game_state.click_cell = (row, col)
            elif event.button == 3: # Right-click places a star
                from_state = game_state.player_grid[row][col]
                to_state = const.STATE_EMPTY if from_state == const.STATE_STAR else const.STATE_STAR
                game_state.add_player_grid_change(row, col, from_state, to_state)

    elif event.type == pygame.MOUSEMOTION:
        if game_state.is_left_down: # Dragging with left-click down
            game_state.is_dragging = True
            col = int(pos[0] // game_state.cell_size)
            row = int(pos[1] // game_state.cell_size)
            if 0 <= row < game_state.grid_dim and 0 <= col < game_state.grid_dim:
                from_state = game_state.player_grid[row][col]
                if from_state != const.STATE_SECONDARY_MARK:
                    game_state.add_player_grid_change(row, col, from_state, const.STATE_SECONDARY_MARK)

    elif event.type == pygame.MOUSEBUTTONUP:
        if event.button == 1: game_state.is_left_down = False
        if event.button == 3: game_state.is_right_down = False

        # Process a simple click (not a drag)
        if not game_state.is_dragging and game_state.click_cell and event.button == 1:
            row, col = game_state.click_cell
            from_state = game_state.player_grid[row][col]
            click_cycle_map = {
                const.STATE_EMPTY: const.STATE_SECONDARY_MARK,
                const.STATE_SECONDARY_MARK: const.STATE_STAR,
                const.STATE_STAR: const.STATE_EMPTY,
            }
            to_state = click_cycle_map.get(from_state, const.STATE_EMPTY)
            game_state.add_player_grid_change(row, col, from_state, to_state)

        # Reset drag state
        game_state.click_cell = None
        game_state.is_dragging = False

# --- SCRIPT ENTRY POINT ---
if __name__ == "__main__":
    if not Z3_AVAILABLE:
        logging.warning("'z3-solver' library not found. 'Find/Check Solution' buttons will be disabled.")
    main()

"""
**********************************************************************************
* Title: game_state.py
*
* Metadata:
* @author Joseph Bryant
* @refactored by Isaiah Tadrous
* @version 1.5.0
* -------------------------------------------------------------------------------
* Description:
* This module defines the GameState class, which serves as the centralized
* model for the entire Star Battle application. It encapsulates all dynamic
* data, including the current puzzle's structure (region grid, dimensions),
* the user's progress (player grid), interaction modes (drawing, border
* creation), UI state (selections, feedback messages), and the complete
* action history via the HistoryManager. By acting as a single source of
* truth, it simplifies state management and ensures consistency across all
* other modules.
*
**********************************************************************************
"""
# game_state.py
# Description: A centralized class to manage the entire state of the application.

import pygame
import constants as const
import puzzle_handler as pz
from history_manager import HistoryManager

# --- GAMESTATE CLASS DEFINITION ---
class GameState:
    """
    Manages the complete, centralized state of the Star Battle application,
    acting as a single source of truth for all dynamic data.
    """
    def __init__(self, puzzle_data, fonts):
        """
        Initializes the game state with the first puzzle and core settings.

        :param dict puzzle_data: - The initial puzzle data dictionary to load.
        :param dict fonts: - A dictionary of pre-loaded Pygame font objects.
        """
        # --- UI AND CORE SETUP ---
        self.fonts = fonts
        self.ui_elements = {}
        self.current_size_selection = 5
        self.screen = pygame.display.set_mode((const.WINDOW_WIDTH, const.WINDOW_HEIGHT))

        # --- PUZZLE STATE ---
        self.puzzle_data = {}
        self.region_grid = None
        self.player_grid = None
        self.grid_dim = 0
        self.cell_size = 0
        self.stars_per_region = 0
        self.history = HistoryManager([[]]) # Dummy init, reset with actual puzzle

        # --- DRAWING MODE STATE ---
        self.is_draw_mode = False
        self.draw_surface = pygame.Surface((const.GRID_AREA_WIDTH, const.GRID_AREA_HEIGHT), pygame.SRCALPHA)
        self.current_color_index = 0
        self.brush_size = 3
        self.last_pos = None

        # --- BORDER MODE STATE ---
        self.is_border_mode = False
        self.custom_borders = [] # List of sets, where each set contains (r, c) tuples for a shape
        self.current_border_path = set() # Holds the (r,c) tuples for the border being drawn

        # --- GENERAL GAMEPLAY STATE ---
        self.mark_is_x = True
        self.solution_status = None
        self.feedback_overlay_alpha = 0
        self.feedback_overlay_color = const.COLOR_CORRECT

        # --- MOUSE AND INPUT STATE ---
        self.is_left_down = False
        self.is_right_down = False

        # --- MARK MODE SPECIFIC STATE ---
        self.is_dragging = False
        self.click_cell = None

        # --- INITIALIZE WITH FIRST PUZZLE ---
        self.reset_puzzle_state(puzzle_data)


    def set_ui_elements(self, ui_elements):
        """
        Stores the dictionary of created UI elements for later access.

        :param dict ui_elements: - A dictionary mapping element names to their objects.
        :returns None:
        """
        self.ui_elements = ui_elements

    def reset_puzzle_state(self, puzzle_data):
        """
        Resets the game state with new puzzle data, correctly handling imported
        history and annotations. This method is the primary entry point for
        loading any new puzzle into the application.

        :param dict puzzle_data: - The new puzzle data to load, from a file or import.
        :returns None:
        """
        if not puzzle_data or 'task' not in puzzle_data:
            print("Error: Invalid puzzle data provided for reset.")
            return

        self.puzzle_data = puzzle_data
        
        # --- PARSE AND VALIDATE CORE PUZZLE DATA ---
        region_grid, dimension = pz.parse_and_validate_grid(puzzle_data['task'])
        if not region_grid:
            print("Failed to load puzzle from data. State not reset.")
            return
            
        self.region_grid = region_grid
        self.grid_dim = dimension
        self.stars_per_region = puzzle_data.get('stars', 1)
        self.cell_size = const.GRID_AREA_WIDTH / self.grid_dim if self.grid_dim > 0 else 0
        
        # --- INITIALIZE PLAYER GRID AND HISTORY ---
        # Handle player grid from imported data or create a new one
        self.player_grid = puzzle_data.get('player_grid') or [[const.STATE_EMPTY] * self.grid_dim for _ in range(self.grid_dim)]
        
        # Handle history manager from imported data or create a new one
        restored_manager = puzzle_data.get('history_manager')
        if restored_manager:
            self.history = restored_manager
            self.player_grid = self.history.get_current_grid() # Ensure grid is synced with history
        else:
            self.history = HistoryManager(self.player_grid)

        # --- RESET TEMPORARY VISUALS AND MODES ---
        self.draw_surface.fill((0, 0, 0, 0))
        self.custom_borders = []
        self.current_border_path = set()
        self.is_draw_mode = False
        self.is_border_mode = False
        self.reset_feedback()
        print(f"Game state reset for a {self.grid_dim}x{self.grid_dim} puzzle.")


    def update_player_grid_from_history(self):
        """
        Safely updates the player grid from the history manager. This ensures
        the displayed grid always matches the current state after an undo or redo.

        :returns None:
        """
        self.player_grid = self.history.get_current_grid()
        self.reset_feedback()

    def add_player_grid_change(self, r, c, from_state, to_state):
        """
        Records a single cell change in the history manager and updates the grid.

        :param int r: - The row index of the change.
        :param int c: - The column index of the change.
        :param int from_state: - The original state of the cell before the change.
        :param int to_state: - The new state of the cell after the change.
        :returns None:
        """
        if from_state != to_state:
            self.history.add_change((r, c, from_state, to_state))
            self.update_player_grid_from_history()

    def reset_feedback(self):
        """
        Resets the solution feedback overlay, hiding it and clearing the status message.

        :returns None:
        """
        self.solution_status = None
        self.feedback_overlay_alpha = 0

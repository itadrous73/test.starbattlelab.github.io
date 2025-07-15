"""
**********************************************************************************
* Title: ui_manager.py
*
* Metadata:
* @author Joseph Bryant
* @refactored by Isaiah Tadrous
* @version 1.5.0
* -------------------------------------------------------------------------------
* Description:
* This module is responsible for all visual rendering and UI construction in
* the Star Battle application. It contains functions for drawing every aspect
* of the game, including the puzzle grid, region backgrounds, player marks,
* and custom borders. Its most significant feature is the data-driven
* `build_panel_from_layout` function, which dynamically creates and positions
* all control panel elements based on a layout definition, ensuring a
* flexible and easily modifiable UI. It also handles console interactions
* for importing and saving puzzles.
*
**********************************************************************************
"""
# ui_manager.py
# Description: Manages all Pygame drawing functions and the data-driven UI layout.

# --- IMPORTS ---
import pygame
import math
from ui_elements import Button
from z3_solver import Z3_AVAILABLE

from constants import (
    GRID_AREA_WIDTH, GRID_AREA_HEIGHT, PANEL_WIDTH, WINDOW_HEIGHT, GUTTER,
    BORDER_NORMAL, BORDER_THICK, PYGAME_UNIFIED_COLORS, COLOR_GRID_LINES,
    COLOR_BLACK, COLOR_STAR, COLOR_X, COLOR_DOT, COLOR_PANEL, COLOR_BUTTON,
    COLOR_BUTTON_HOVER, COLOR_BUTTON_TEXT, COLOR_CORRECT, COLOR_INCORRECT,
    COLOR_SELECTED, COLOR_STAR_NUM, DIFFICULTY_COLORS, STATE_STAR,
    STATE_SECONDARY_MARK, PUZZLE_DEFINITIONS, COLOR_DISABLED_BUTTON,
    COLOR_DISABLED_TEXT, DRAWING_COLORS, COLOR_CUSTOM_BORDER,
    BORDER_CUSTOM_THICKNESS, UNIFIED_COLORS_BG, BASE64_DISPLAY_ALPHABET
)

# --- CONSOLE INTERACTION ---
def get_input_from_console():
    """
    Minimizes the Pygame window and prompts for a puzzle string in the console.

    This function is used for the import feature, allowing users to paste
    a puzzle string directly into the terminal.

    :returns Optional[str]: The stripped input string, or None if the user cancels.
    """
    pygame.display.iconify()
    input_string = input("\n--- PASTE PUZZLE STRING (or 'q' to cancel) AND PRESS ENTER ---\n> ")
    if input_string.lower() == 'q': return None
    return input_string.strip()

def get_comment_from_console():
    """
    Minimizes the Pygame window and prompts for a comment in the console.

    Used when saving a puzzle to allow the user to add a descriptive comment.

    :returns str: The stripped comment string.
    """
    pygame.display.iconify()
    comment = input("\n--- ENTER A COMMENT FOR THE SAVED PUZZLE (or leave blank) ---\n> ")
    return comment.strip()

def display_terminal_grid(grid, title, content_grid=None):
    """
    Prints a colorized version of the grid to the terminal using ANSI escape codes.

    Can display either the region layout or a solution grid.

    :param list[list[int]] grid: The 2D list representing the region layout.
    :param str title: The title to print above the grid.
    :param Optional[list[list[int]]] content_grid: A grid of 1s and 0s to display as content (e.g., a solution).
    :returns None:
    """
    if not grid: return
    RESET = "\033[0m"
    print(f"\n--- {title} ---")
    dim = len(grid)
    for r in range(dim):
        colored_chars = []
        for c in range(dim):
            region_num = grid[r][c]
            color_ansi = UNIFIED_COLORS_BG[(region_num - 1) % len(UNIFIED_COLORS_BG)][2]
            if content_grid:
                symbol = '★' if content_grid[r][c] == 1 else '·'
            else:
                symbol = BASE64_DISPLAY_ALPHABET[(region_num - 1) % len(BASE64_DISPLAY_ALPHABET)]
            colored_chars.append(f"{color_ansi} {symbol} {RESET}")
        print("".join(colored_chars))
    print("-----------------\n")

# --- UI DRAWING AND LAYOUT ---
def draw_game(game_state):
    """
    Main drawing function that orchestrates all visual updates for each frame.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    game_state.screen.fill(COLOR_PANEL)
    if game_state.region_grid:
        draw_background_colors(game_state.screen, game_state.region_grid, game_state.cell_size)
        draw_custom_borders(game_state)
        draw_grid_lines(game_state.screen, game_state.region_grid, game_state.cell_size)
        draw_user_surface(game_state.screen, game_state.draw_surface)
        draw_player_marks(game_state.screen, game_state.player_grid, game_state.mark_is_x, game_state.cell_size)
        draw_feedback_overlay(game_state)
    if game_state.feedback_overlay_alpha > 0:
        fade_speed = 4
        game_state.feedback_overlay_alpha = max(0, game_state.feedback_overlay_alpha - fade_speed)
    draw_control_panel(game_state)
    pygame.display.set_caption(f"Star Battle ({game_state.stars_per_region} Stars)")
    pygame.display.flip()

def draw_control_panel(game_state):
    """
    Draws the entire right-hand control panel, including all buttons and indicators.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    screen = game_state.screen
    fonts = game_state.fonts
    ui_elements = game_state.ui_elements
    pygame.draw.rect(screen, COLOR_PANEL, (GRID_AREA_WIDTH, 0, PANEL_WIDTH, WINDOW_HEIGHT))
    mouse_pos = pygame.mouse.get_pos()
    for name, elem in ui_elements.items():
        if isinstance(elem, Button):
            # Update button text and disabled state based on game state
            if name == 'toggle': elem.text = "Xs" if game_state.mark_is_x else "Dots"
            if name == 'toggle_mode': elem.text = "Mark Mode" if game_state.is_draw_mode else "Draw Mode"
            if name == 'border_mode': elem.text = "Mark Mode" if game_state.is_border_mode else "Add Border"
            elem.is_disabled = (name in ['find', 'check'] and not Z3_AVAILABLE) or \
                               (name == 'back' and (not game_state.history.can_undo() or game_state.is_draw_mode or game_state.is_border_mode)) or \
                               (name == 'forward' and (not game_state.history.can_redo() or game_state.is_draw_mode or game_state.is_border_mode))
            elem.draw(screen)
    # Draw title text
    if 'size_title' in ui_elements:
        title_def = ui_elements['size_title']
        title_surf = fonts['default'].render(title_def['text'], True, COLOR_BUTTON_TEXT)
        title_rect = title_surf.get_rect(center=(GRID_AREA_WIDTH + PANEL_WIDTH // 2, title_def['y_pos']))
        screen.blit(title_surf, title_rect)
    # Draw size selector grid
    if 'size_selector' in ui_elements:
        size_buttons = ui_elements['size_selector']
        for size_id, b in size_buttons.items():
            puzzle_def = PUZZLE_DEFINITIONS[size_id]
            diff_colors = DIFFICULTY_COLORS[puzzle_def['difficulty']]
            color = diff_colors['hover'] if b['rect'].collidepoint(mouse_pos) else diff_colors['base']
            pygame.draw.circle(screen, color, b['rect'].center, b['radius'])
            if size_id == game_state.current_size_selection:
                pygame.draw.circle(screen, COLOR_SELECTED, b['rect'].center, b['radius'], 3)
            num_surf = fonts['small'].render(str(puzzle_def['dim']), True, COLOR_BUTTON_TEXT)
            screen.blit(num_surf, num_surf.get_rect(center=b['rect'].center))
            draw_star_indicator(screen, b['rect'], puzzle_def['stars'], fonts['tiny'])
    # Draw selection highlight for color/mode buttons
    if game_state.is_draw_mode:
        color_button_ids = ['color_r', 'color_b', 'color_y', 'color_g']
        selected_button_id = color_button_ids[game_state.current_color_index]
        if selected_button_id in ui_elements:
            selected_rect = ui_elements[selected_button_id].rect
            pygame.draw.rect(screen, COLOR_SELECTED, selected_rect, 3, border_radius=8)
    if game_state.is_border_mode and 'border_mode' in ui_elements:
        selected_rect = ui_elements['border_mode'].rect
        pygame.draw.rect(screen, COLOR_SELECTED, selected_rect, 3, border_radius=8)
    # Draw solution status text
    if game_state.solution_status:
        bottom_button_y = WINDOW_HEIGHT - 45 - 15 - 45 - 15
        color = COLOR_CORRECT if "Correct" in game_state.solution_status else COLOR_INCORRECT
        status_surf = fonts['default'].render(game_state.solution_status, True, color)
        status_rect = status_surf.get_rect(center=(GRID_AREA_WIDTH + PANEL_WIDTH // 2, bottom_button_y))
        screen.blit(status_surf, status_rect)

def build_panel_from_layout(layout_def, fonts):
    """
    Constructs a dictionary of UI elements based on a data-driven layout definition.

    This function dynamically calculates positions and sizes to create a responsive panel.

    :param list[dict] layout_def: A list of dictionaries defining each UI element.
    :param dict fonts: A dictionary of pre-loaded Pygame font objects.
    :returns dict: A dictionary mapping element IDs to their created objects.
    """
    ui_elements = {}
    # --- DYNAMIC LAYOUT CALCULATION ---
    ideal_flowing_height = sum(e.get('ideal_height', 0) for e in layout_def if 'fixed_bottom' not in e)
    num_gaps = len([e for e in layout_def if 'fixed_bottom' not in e and e['type'] != 'title'])
    ideal_gap_height = 15
    ideal_flowing_height += num_gaps * ideal_gap_height
    bottom_buttons = [e for e in layout_def if 'fixed_bottom' in e]
    total_bottom_height = sum(b.get('ideal_height', 45) + 15 for b in bottom_buttons)
    top_padding, final_buffer = 15, 15
    available_space = WINDOW_HEIGHT - top_padding - total_bottom_height - final_buffer
    scaling_factor = min(1.0, available_space / ideal_flowing_height) if ideal_flowing_height > 0 else 1.0
    actual_gap_height = ideal_gap_height * scaling_factor
    current_y = top_padding
    h_padding = 15
    default_colors = {
        'base': COLOR_BUTTON, 'hover': COLOR_BUTTON_HOVER, 'text': COLOR_BUTTON_TEXT,
        'disabled_bg': COLOR_DISABLED_BUTTON, 'disabled_fg': COLOR_DISABLED_TEXT
    }
    # --- BUILD FLOWING ELEMENTS (TOP TO BOTTOM) ---
    flowing_elements = [elem for elem in layout_def if 'fixed_bottom' not in elem]
    for element_def in flowing_elements:
        elem_type = element_def['type']
        scaled_elem_height = element_def.get('ideal_height', 0) * scaling_factor
        if elem_type == 'button_group':
            group_width = PANEL_WIDTH - (h_padding * 2)
            items, num_buttons = element_def['items'], len(element_def['items'])
            spacing = 10
            width_available_for_buttons = group_width - ((num_buttons - 1) * spacing)
            current_x = GRID_AREA_WIDTH + h_padding
            for btn_def in items:
                btn_width = width_available_for_buttons * btn_def['width_ratio']
                rect = pygame.Rect(current_x, current_y, btn_width, scaled_elem_height)
                font = fonts.get(btn_def.get('font'), fonts['default'])
                if btn_def['id'].startswith('color_'):
                    color_index = ['r', 'b', 'y', 'g'].index(btn_def['id'][-1])
                    opaque_color = DRAWING_COLORS[color_index][:3]
                    custom_colors = {
                        'base': opaque_color, 'text': COLOR_BUTTON_TEXT,
                        'hover': tuple(min(c + 30, 255) for c in opaque_color),
                        'disabled_bg': COLOR_DISABLED_BUTTON, 'disabled_fg': COLOR_DISABLED_TEXT
                    }
                    ui_elements[btn_def['id']] = Button(rect, '', btn_def['id'], font, custom_colors)
                else:
                    ui_elements[btn_def['id']] = Button(rect, btn_def['text'], btn_def['id'], font, default_colors)
                current_x += btn_width + spacing
            current_y += scaled_elem_height + actual_gap_height
        elif elem_type == 'button':
            rect = pygame.Rect(GRID_AREA_WIDTH + h_padding, current_y, PANEL_WIDTH - (h_padding * 2), scaled_elem_height)
            ui_elements[element_def['id']] = Button(rect, element_def['text'], element_def['id'], fonts['default'], default_colors)
            current_y += scaled_elem_height + actual_gap_height
        elif elem_type == 'title':
            element_def['y_pos'] = current_y + (scaled_elem_height / 2)
            ui_elements[element_def['id']] = element_def
            current_y += scaled_elem_height + actual_gap_height
        elif elem_type == 'size_grid':
            size_buttons = {}
            s_radius, s_cols = 22, 4
            s_h_padding = (PANEL_WIDTH - (s_cols * s_radius * 2)) / (s_cols + 1)
            num_rows = 3
            v_padding = (scaled_elem_height - (num_rows * s_radius * 2)) / (num_rows - 1) if num_rows > 1 else 0
            for i in range(12):
                row, col = divmod(i, s_cols)
                y_pos = current_y + (row * (s_radius * 2 + v_padding)) + s_radius
                x_pos = GRID_AREA_WIDTH + s_h_padding + col * (s_radius * 2 + s_h_padding) + s_radius
                size_buttons[i] = {'rect': pygame.Rect(x_pos - s_radius, y_pos - s_radius, s_radius * 2, s_radius * 2), 'radius': s_radius}
            ui_elements[element_def['id']] = size_buttons
            current_y += scaled_elem_height + actual_gap_height
    # --- BUILD FIXED ELEMENTS (BOTTOM TO TOP) ---
    current_bottom_y = WINDOW_HEIGHT - 15
    for btn_def in reversed(bottom_buttons):
        height = btn_def.get('ideal_height', 45)
        rect = pygame.Rect(GRID_AREA_WIDTH + h_padding, current_bottom_y - height, PANEL_WIDTH - (h_padding * 2), height)
        ui_elements[btn_def['id']] = Button(rect, btn_def['text'], btn_def['id'], fonts['default'], default_colors)
        current_bottom_y -= (height + 15)
    return ui_elements

def draw_custom_borders(game_state):
    """
    Draws the user-created freeform borders on top of the grid.

    :param GameState game_state: The current state of the game.
    :returns None:
    """
    screen = game_state.screen
    cell_size = game_state.cell_size
    thickness = BORDER_CUSTOM_THICKNESS
    all_shapes = game_state.custom_borders + [game_state.current_border_path]
    for shape in all_shapes:
        if not shape: continue
        for r, c in shape:
            x, y = c * cell_size, r * cell_size
            # Only draw a line if there is no adjacent cell in the same shape
            if (r - 1, c) not in shape: pygame.draw.rect(screen, COLOR_CUSTOM_BORDER, (x, y, cell_size, thickness))
            if (r + 1, c) not in shape: pygame.draw.rect(screen, COLOR_CUSTOM_BORDER, (x, y + cell_size - thickness, cell_size, thickness))
            if (r, c - 1) not in shape: pygame.draw.rect(screen, COLOR_CUSTOM_BORDER, (x, y, thickness, cell_size))
            if (r, c + 1) not in shape: pygame.draw.rect(screen, COLOR_CUSTOM_BORDER, (x + cell_size - thickness, y, thickness, cell_size))

def calculate_star_points(center_x, center_y, outer_radius, inner_radius):
    """
    Calculates the vertices for a 5-pointed star polygon.

    :param float center_x: The x-coordinate of the star's center.
    :param float center_y: The y-coordinate of the star's center.
    :param float outer_radius: The distance from the center to the outer points.
    :param float inner_radius: The distance from the center to the inner points.
    :returns list[tuple[float, float]]: A list of (x, y) points for the star.
    """
    points = [];
    for i in range(10):
        angle = math.pi / 5 * i - math.pi / 2
        radius = outer_radius if i % 2 == 0 else inner_radius
        points.append((center_x + radius * math.cos(angle), center_y + radius * math.sin(angle)))
    return points

def draw_star_indicator(screen, rect, count, font):
    """
    Draws the small star icon with a number on the size selection buttons.

    :param pygame.Surface screen: The surface to draw on.
    :param pygame.Rect rect: The bounding rect of the size selection button.
    :param int count: The number of stars to display.
    :param pygame.font.Font font: The font to use for the number.
    :returns None:
    """
    star_radius = 12
    center_x = rect.right - star_radius + 5
    center_y = rect.top + star_radius - 8
    star_points = calculate_star_points(center_x, center_y, star_radius, star_radius/2)
    pygame.draw.polygon(screen, COLOR_STAR, star_points)
    num_surf = font.render(str(count), True, COLOR_STAR_NUM)
    screen.blit(num_surf, num_surf.get_rect(center=(center_x, center_y + 1)))

def draw_background_colors(screen, region_grid, cell_size):
    """
    Fills the background of each grid cell based on its region number.

    :param pygame.Surface screen: The surface to draw on.
    :param list[list[int]] region_grid: The 2D grid defining puzzle regions.
    :param float cell_size: The size of each cell in pixels.
    :returns None:
    """
    dim = len(region_grid)
    for r in range(dim):
        for c in range(dim):
            rect = pygame.Rect(c * cell_size, r * cell_size, cell_size, cell_size)
            if region_grid[r][c] > 0:
                color = PYGAME_UNIFIED_COLORS[(region_grid[r][c] - 1) % len(PYGAME_UNIFIED_COLORS)][1]
                pygame.draw.rect(screen, color, rect)

def draw_grid_lines(screen, region_grid, cell_size):
    """
    Draws the main grid lines and the thicker region borders.

    :param pygame.Surface screen: The surface to draw on.
    :param list[list[int]] region_grid: The 2D grid defining puzzle regions.
    :param float cell_size: The size of each cell in pixels.
    :returns None:
    """
    dim = len(region_grid)
    # Draw thin grid lines
    for i in range(dim + 1):
        pygame.draw.line(screen, COLOR_GRID_LINES, (i * cell_size, 0), (i * cell_size, GRID_AREA_HEIGHT), BORDER_NORMAL)
        pygame.draw.line(screen, COLOR_GRID_LINES, (0, i * cell_size), (GRID_AREA_WIDTH, i * cell_size), BORDER_NORMAL)
    # Draw thick region borders
    for r in range(dim):
        for c in range(dim):
            if c < dim - 1 and region_grid[r][c] != region_grid[r][c+1]:
                pygame.draw.line(screen, COLOR_BLACK, ((c + 1) * cell_size, r * cell_size), ((c + 1) * cell_size, (r + 1) * cell_size), BORDER_THICK)
            if r < dim - 1 and region_grid[r][c] != region_grid[r+1][c]:
                pygame.draw.line(screen, COLOR_BLACK, (c * cell_size, (r + 1) * cell_size), ((c + 1) * cell_size, (r + 1) * cell_size), BORDER_THICK)
    # Draw outer border
    pygame.draw.rect(screen, COLOR_BLACK, (0, 0, GRID_AREA_WIDTH, GRID_AREA_HEIGHT), BORDER_THICK)

def draw_player_marks(screen, player_grid, mark_is_x, cell_size):
    """
    Draws the stars and secondary marks (X's or dots) based on the player's grid.

    :param pygame.Surface screen: The surface to draw on.
    :param list[list[int]] player_grid: The 2D grid of the player's marks.
    :param bool mark_is_x: True to draw X's, False to draw dots.
    :param float cell_size: The size of each cell in pixels.
    :returns None:
    """
    if not player_grid: return
    dim = len(player_grid)
    for r in range(dim):
        for c in range(dim):
            cell_state = player_grid[r][c]
            center_x, center_y = c * cell_size + cell_size / 2, r * cell_size + cell_size / 2
            if cell_state == STATE_STAR:
                outer_rad = cell_size / 2 - GUTTER * 1.5
                inner_rad = outer_rad / 2
                pygame.draw.polygon(screen, COLOR_STAR, calculate_star_points(center_x, center_y, outer_rad, inner_rad))
            elif cell_state == STATE_SECONDARY_MARK:
                if mark_is_x:
                    margin = GUTTER * 2.5
                    line_width = max(1, int(cell_size / 15))
                    start1, end1 = (c * cell_size + margin, r * cell_size + margin), ((c+1) * cell_size - margin, (r+1) * cell_size - margin)
                    start2, end2 = ((c+1) * cell_size - margin, r * cell_size + margin), (c * cell_size + margin, (r+1) * cell_size - margin)
                    pygame.draw.line(screen, COLOR_X, start1, end1, line_width)
                    pygame.draw.line(screen, COLOR_X, start2, end2, line_width)
                else:
                    pygame.draw.circle(screen, COLOR_DOT, (center_x, center_y), cell_size / 6)

def draw_user_surface(screen, surface):
    """
    Draws the transparent surface used for free-form drawing onto the main screen.

    :param pygame.Surface screen: The main screen surface.
    :param pygame.Surface surface: The transparent drawing surface.
    :returns None:
    """
    if surface:
        screen.blit(surface, (0, 0))

def draw_feedback_overlay(_game_state):
    """
    Draws a semi-transparent colored overlay for solution feedback.

    :param GameState _game_state: The current state of the game.
    :returns None:
    """
    if _game_state.feedback_overlay_alpha > 0:
        overlay = pygame.Surface((GRID_AREA_WIDTH, GRID_AREA_HEIGHT), pygame.SRCALPHA)
        overlay.fill((*_game_state.feedback_overlay_color, _game_state.feedback_overlay_alpha))
        _game_state.screen.blit(overlay, (0, 0))

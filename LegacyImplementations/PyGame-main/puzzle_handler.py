"""
**********************************************************************************
* Title: puzzle_handler.py
*
* Metadata:
* @author Isaiah Tadrous
* @version 2.1.4
* -------------------------------------------------------------------------------
* Description:
* This module is responsible for all aspects of puzzle data management for a
* star battle puzzle game. Its primary features include fetching puzzles from
* local files, parsing and converting between different puzzle formats (a compact
* "SBN" format and a "Web Task" format), and saving the user's progress,
* including annotations and action history, to a file. It handles the intricate
* logic of encoding and decoding puzzle region layouts and player states into
* compressed string representations.
*
**********************************************************************************
"""
# puzzle_handler.py
# Description: Manages puzzle data, including local file fetching, SBN/task conversion, and saving.

# --- IMPORTS AND LOGGING ---
import re
import math
import os
import random
import logging
from collections import deque
from datetime import datetime # Import datetime for saving
from history_manager import HistoryManager
from constants import (
    PUZZLE_DEFINITIONS, STATE_EMPTY, STATE_STAR, STATE_SECONDARY_MARK,
    SBN_B64_ALPHABET, SBN_CHAR_TO_INT, SBN_INT_TO_CHAR,
    SBN_CODE_TO_DIM_MAP, DIM_TO_SBN_CODE_MAP
)

# --- PUZZLE FETCHING AND IMPORTING ---
def get_puzzle_from_local_file(size_id):
    """
    Fetches a random puzzle SBN string from a local text file based on size_id.

    If the file does not exist, it creates a dummy file to prevent errors.
    It reads all valid lines from the file, selects one at random, and decodes
    it into a standard puzzle data dictionary.

    :param int size_id: The identifier for the puzzle size, used to find the correct puzzle file (e.g., '0.txt').
    :returns Optional[dict]: A dictionary containing the puzzle 'task' and 'stars', or None if an error occurs.
    """
    try:
        file_path = os.path.join(os.path.dirname(__file__), 'puzzles', f'{size_id}.txt')
        logging.info(f"Attempting to fetch puzzle from: {file_path}")

        if not os.path.exists(file_path):
            logging.error(f"Puzzle file not found at {file_path}")
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, 'w') as f:
                if size_id == 0:
                    f.write("551W-G_q\n")
            logging.warning(f"Created a dummy puzzle file at: {file_path}")

        with open(file_path, 'r') as f:
            puzzles = [line.strip() for line in f if line.strip()]

        if not puzzles:
            logging.error(f"No puzzles found in {file_path}")
            return None

        random_sbn_string = random.choice(puzzles)
        puzzle_data = decode_sbn(random_sbn_string)
        return puzzle_data

    except Exception as e:
        logging.error(f"An exception occurred in get_puzzle_from_local_file: {e}")
        return None

def universal_import(input_string):
    """
    Decodes a puzzle string that can be in SBN or Web Task format.

    This function acts as a universal entry point for loading puzzles from strings.
    It can handle complex strings that include the main puzzle data, player
    annotations, and a serialized history of moves, separated by a tilde (~).

    :param str input_string: The string containing the puzzle data to import.
    :returns Optional[dict]: A comprehensive dictionary with all puzzle data, including player grid and history, or None if the format is not recognized.
    """
    logging.info("Attempting to import puzzle string...")
    parts = input_string.strip().split('~')
    main_part, history_part = parts[0], parts[1] if len(parts) > 1 else ""
    puzzle_data, raw_annotation_data = None, ""

    # --- Try parsing as SBN format first ---
    if len(main_part) >= 4 and main_part[0:2] in SBN_CODE_TO_DIM_MAP:
        try:
            puzzle_data = decode_sbn(main_part)
            _, dim = parse_and_validate_grid(puzzle_data['task'])
            if dim and main_part[3] == 'e': # 'e' flag indicates annotations are present
                border_chars_needed = math.ceil((2 * dim * (dim - 1)) / 6)
                base_sbn_len = 4 + border_chars_needed
                raw_annotation_data = main_part[base_sbn_len:]
        except Exception:
            puzzle_data = None

    # --- If SBN parsing fails, try parsing as WebTask format ---
    if not puzzle_data:
        result = _parse_as_webtask(main_part)
        if result and result[0]:
            puzzle_data, raw_annotation_data = result

    # --- If parsing succeeded, process annotations and history ---
    if puzzle_data:
        _, dim = parse_and_validate_grid(puzzle_data['task'])
        if dim:
            puzzle_data['player_grid'] = decode_player_annotations(raw_annotation_data, dim)
            if history_part:
                initial_grid = [[STATE_EMPTY] * dim for _ in range(dim)]
                puzzle_data['history_manager'] = HistoryManager.deserialize(initial_grid, history_part)
        return puzzle_data

    logging.error("Could not recognize puzzle format.")
    return None

# --- PUZZLE SAVING ---
def save_puzzle_entry(puzzle_data, player_grid, history_manager, comment):
    """
    Formats and appends a puzzle entry with annotations and history to a file.

    Creates a detailed, human-readable entry in 'saved_puzzles.txt'. The entry
    includes a timestamp, a user comment, and the puzzle state in both SBN and
    Web Task formats for maximum portability.

    :param dict puzzle_data: The core puzzle data dictionary.
    :param list[list[int]] player_grid: The 2D grid of the player's current state.
    :param HistoryManager history_manager: The history manager instance for the session.
    :param str comment: A user-provided comment to include in the saved entry.
    :returns None:
    """
    try:
        region_grid, _ = parse_and_validate_grid(puzzle_data['task'])
        if not region_grid:
            raise ValueError("Invalid puzzle data for saving.")

        stars = puzzle_data.get('stars', 1)
        sbn_export = encode_to_sbn(region_grid, stars, player_grid)
        
        raw_annotation_data = encode_player_annotations(player_grid)
        web_task_export = f"{puzzle_data.get('task', '')}{raw_annotation_data}"

        history_str = history_manager.serialize()
        if history_str:
            sbn_export += f"~{history_str}"
            web_task_export += f"~{history_str}"

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        entry = (
            f"#-{'-'*75}\n"
            f"# Puzzle saved on: {timestamp}\n"
            f"# Comment: {comment or 'N/A'}\n"
            f"#-{'-'*75}\n"
            f"SBN Format:      {sbn_export}\n"
            f"Web Task Format: {web_task_export}\n\n"
        )
        with open("saved_puzzles.txt", "a") as f:
            f.write(entry)
        print(f"\n✅ Puzzle successfully saved to 'saved_puzzles.txt'")
    except Exception as e:
        print(f"\n❌ Error saving puzzle: {e}")

# --- PARSING HELPERS ---
def _parse_as_webtask(main_part):
    """
    Internal helper to parse a string as a Web Task format puzzle.

    It intelligently splits the string into the core task (comma-separated numbers)
    and any trailing annotation data by finding the longest valid task string.

    :param str main_part: The main part of the puzzle string, excluding history.
    :returns tuple[Optional[dict], Optional[str]]: A tuple containing the decoded puzzle data and the raw annotation string, or (None, None) on failure.
    """
    try:
        best_split_index = -1
        # Iterate backwards to find the longest possible valid task string
        for i in range(len(main_part), 0, -1):
            potential_task = main_part[:i]
            if not potential_task or not potential_task[-1].isdigit(): continue
            if not re.fullmatch(r'[\d,]+', potential_task): continue
            try:
                numbers = [int(n) for n in potential_task.split(',')]
                # Check if the number of cells forms a perfect square grid
                if len(numbers) > 0 and math.isqrt(len(numbers))**2 == len(numbers):
                    best_split_index = i
                    break
            except (ValueError, TypeError): continue

        if best_split_index != -1:
            task_part, ann_part = main_part[:best_split_index], main_part[best_split_index:]
            puzzle_data = decode_web_task_string(task_part)
            if puzzle_data:
                return puzzle_data, ann_part
        return None, None
    except Exception as e:
        logging.error(f"Error during webtask parsing: {e}")
        return None, None

# --- SBN/TASK CONVERSION & ANNOTATION ---
def encode_player_annotations(player_grid):
    """
    Encodes the player's grid state into a compact SBN-style annotation string.

    It converts the 2D grid of player states (empty, star, mark) into a base-64
    character string for efficient storage and sharing. States are packed three
    at a time into a single character.

    :param list[list[int]] player_grid: The 2D grid of player states.
    :returns str: The encoded annotation string, or an empty string if the grid is empty or has no marks.
    """
    if not player_grid: return ""
    dim = len(player_grid)
    game_to_sbn_state = {STATE_EMPTY: 0, STATE_SECONDARY_MARK: 1, STATE_STAR: 2}
    flat_states = [game_to_sbn_state.get(player_grid[r][c], 0) for r in range(dim) for c in range(dim)]
    if not any(flat_states): return ""

    sbn_states = []
    # Process states in chunks of 3
    for i in range(0, len(flat_states), 3):
        chunk = flat_states[i:i+3]
        while len(chunk) < 3: chunk.append(0) # Pad if necessary
        s1, s2, s3 = chunk
        # Combine three 2-bit states into one 6-bit value
        value = s1 * 16 + s2 * 4 + s3
        sbn_states.append(SBN_INT_TO_CHAR[value])
    return "".join(sbn_states)

def decode_player_annotations(annotation_data_str, dim):
    """
    Decodes an SBN-style annotation string back into a 2D player grid.

    This function reverses the process of `encode_player_annotations`, unpacking
    each base-64 character into three cell states and reconstructing the grid.

    :param str annotation_data_str: The compact annotation string.
    :param int dim: The dimension of the grid to reconstruct.
    :returns list[list[int]]: The decoded 2D player grid. Returns an empty grid on error.
    """
    player_grid = [[STATE_EMPTY] * dim for _ in range(dim)]
    if not annotation_data_str: return player_grid
    try:
        flat_indices = [(r, c) for r in range(dim) for c in range(dim)]
        sbn_to_game_state = {0: STATE_EMPTY, 1: STATE_SECONDARY_MARK, 2: STATE_STAR}
        char_cursor, cell_cursor = 0, 0

        while cell_cursor < dim * dim and char_cursor < len(annotation_data_str):
            char = annotation_data_str[char_cursor]
            value = SBN_CHAR_TO_INT.get(char, 0)
            # Unpack the 6-bit value into three 2-bit states
            states = [(value // 16), (value % 16) // 4, value % 4]
            for i in range(3):
                if cell_cursor + i < dim * dim:
                    r, c = flat_indices[cell_cursor + i]
                    player_grid[r][c] = sbn_to_game_state.get(states[i], STATE_EMPTY)
            cell_cursor += 3
            char_cursor += 1
        return player_grid
    except (KeyError, IndexError, ValueError):
        # Return a clean grid in case of corrupted data
        return [[STATE_EMPTY] * dim for _ in range(dim)]

def encode_to_sbn(region_grid, stars, player_grid=None):
    """
    Encodes a puzzle's region layout and player state into the full SBN format.

    The SBN format consists of:
    - 2 chars for dimensions
    - 1 char for star count
    - 1 flag char ('W' for no annotations, 'e' for with annotations)
    - A base-64 string for region borders
    - An optional base-64 string for player annotations

    :param list[list[int]] region_grid: The grid defining the puzzle regions.
    :param int stars: The number of stars per region.
    :param Optional[list[list[int]]] player_grid: The optional player grid to include as annotations.
    :returns Optional[str]: The complete SBN string, or None if dimensions are invalid.
    """
    dim = len(region_grid)
    sbn_code = DIM_TO_SBN_CODE_MAP.get(dim)
    if not sbn_code: return None

    # Create bitfields for vertical and horizontal borders
    vertical_bits = ['1' if c < dim - 1 and region_grid[r][c] != region_grid[r][c+1] else '0' for r in range(dim) for c in range(dim - 1)]
    horizontal_bits = ['1' if r < dim - 1 and region_grid[r][c] != region_grid[r+1][c] else '0' for c in range(dim) for r in range(dim - 1)]
    clean_bitfield = "".join(vertical_bits) + "".join(horizontal_bits)

    # Pad the bitfield to be a multiple of 6 for base64 encoding
    padding_needed = (6 - len(clean_bitfield) % 6) % 6
    padded_bitfield = ('0' * padding_needed) + clean_bitfield
    region_data_chars = [SBN_INT_TO_CHAR[int(padded_bitfield[i:i+6], 2)] for i in range(0, len(padded_bitfield), 6)]
    region_data = "".join(region_data_chars)

    raw_annotation_data = encode_player_annotations(player_grid) if player_grid else ""
    flag = 'e' if raw_annotation_data else 'W'
    return f"{sbn_code}{stars}{flag}{region_data}{raw_annotation_data}"

def decode_sbn(sbn_string):
    """
    Decodes a core SBN string into its constituent puzzle data.

    This function handles the main puzzle structure (dimensions, stars, region layout)
    but does not process player annotations, which are handled by other functions.

    :param str sbn_string: The SBN string to decode.
    :raises Exception: Raises various exceptions (KeyError, IndexError, ValueError) on malformed input.
    :returns dict: A dictionary containing the 'task' string and 'stars' count.
    """
    try:
        dim = SBN_CODE_TO_DIM_MAP.get(sbn_string[0:2])
        stars = int(sbn_string[2])
        border_bits_needed = 2 * dim * (dim - 1)
        border_chars_needed = math.ceil(border_bits_needed / 6)
        region_data = sbn_string[4:4+border_chars_needed]

        # Decode base64 region data back to a bitfield
        full_bitfield = "".join(bin(SBN_CHAR_TO_INT.get(c,0))[2:].zfill(6) for c in region_data)[-border_bits_needed:]
        v_bits, h_bits = full_bitfield[:dim*(dim-1)], full_bitfield[dim*(dim-1):]

        region_grid = reconstruct_grid_from_borders(dim, v_bits, h_bits)
        task_str = ",".join(str(cell) for row in region_grid for cell in row)
        return {'task': task_str, 'stars': stars}
    except (KeyError, IndexError, ValueError) as e:
        raise e

def decode_web_task_string(task_string):
    """
    Decodes a Web Task string (comma-separated numbers) into puzzle data.

    It validates the string and determines the default star count based on the
    puzzle's dimensions as defined in constants.

    :param str task_string: The string of comma-separated region numbers.
    :returns Optional[dict]: A dictionary with 'task' and 'stars', or None on error.
    """
    try:
        region_grid, dim = parse_and_validate_grid(task_string)
        if not region_grid: return None
        # Find the default star count for this dimension
        stars = next((p['stars'] for p in PUZZLE_DEFINITIONS if p['dim'] == dim), 1)
        return {'task': task_string, 'stars': stars}
    except Exception:
        return None

# --- GRID UTILITIES ---
def reconstruct_grid_from_borders(dim, v_bits, h_bits):
    """
    Rebuilds the region grid using a flood-fill algorithm from border bitfields.

    This function is the core of the SBN decoding process. It takes bitfields
    representing vertical and horizontal borders and uses a breadth-first search
    (BFS) to identify and number the contiguous regions.

    :param int dim: The dimension of the grid.
    :param str v_bits: A bitstring representing the vertical borders between cells.
    :param str h_bits: A bitstring representing the horizontal borders between cells.
    :returns list[list[int]]: The reconstructed 2D region grid.
    """
    grid, region_id = [[0]*dim for _ in range(dim)], 1
    for r_start in range(dim):
        for c_start in range(dim):
            if grid[r_start][c_start] == 0: # Start a new region if cell is unvisited
                q = deque([(r_start, c_start)])
                grid[r_start][c_start] = region_id
                while q:
                    r, c = q.popleft()
                    # Check neighbors and expand region if no border exists
                    if c < dim-1 and grid[r][c+1]==0 and v_bits[r*(dim-1)+c]=='0': grid[r][c+1]=region_id; q.append((r,c+1))
                    if c > 0 and grid[r][c-1]==0 and v_bits[r*(dim-1)+c-1]=='0': grid[r][c-1]=region_id; q.append((r,c-1))
                    if r < dim-1 and grid[r+1][c]==0 and h_bits[c*(dim-1)+r]=='0': grid[r+1][c]=region_id; q.append((r+1,c))
                    if r > 0 and grid[r-1][c]==0 and h_bits[c*(dim-1)+r-1]=='0': grid[r-1][c]=region_id; q.append((r-1,c))
                region_id += 1
    return grid

def parse_and_validate_grid(task_string):
    """
    Parses a comma-separated task string into a 2D list and validates its dimensions.

    It ensures that the provided string contains numbers that can form a perfect
    square grid.

    :param str task_string: The string of comma-separated numbers.
    :returns tuple[Optional[list[list[int]]], Optional[int]]: A tuple containing the grid and its dimension, or (None, None) if the string is invalid.
    """
    if not task_string: return None, None
    try:
        nums = [int(n) for n in task_string.split(',')]
        if not nums: return None, None
        dim = math.isqrt(len(nums))
        if dim**2 != len(nums):
            # The number of elements doesn't form a perfect square
            return None, None
        # Reshape the flat list into a 2D grid
        return [nums[i*dim:(i+1)*dim] for i in range(dim)], dim
    except (ValueError, TypeError):
        return None, None

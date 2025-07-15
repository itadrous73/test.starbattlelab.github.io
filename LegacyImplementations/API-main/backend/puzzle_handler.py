"""**********************************************************************************
 * Title: puzzle_handler.py
 *
 * @author Isaiah Tadrous
 * @version 2.1.4
 * -------------------------------------------------------------------------------
 * Description:
 * This module serves as the primary logic center for handling Star Battle
 * puzzle data. It contains a comprehensive set of functions for managing the
 * entire lifecycle of a puzzle. This includes fetching new puzzles from local
 * files, providing a universal import function capable of decoding multiple
 * formats (SBN and webtask), and managing player progress and history. It
 * also features detailed functions for encoding and decoding puzzles to and from
 * the compact SBN (Star Battle Notation), handling player annotations, and
 * reconstructing puzzle grids from various data representations.
 **********************************************************************************"""

# --- IMPORTS ---
import re
import math
import os
import random
import logging
from collections import deque

# Use absolute imports from the 'backend' package
from backend.history_manager import HistoryManager
from backend.constants import (
    PUZZLE_DEFINITIONS, STATE_EMPTY, STATE_STAR, STATE_SECONDARY_MARK,
    SBN_B64_ALPHABET, SBN_CHAR_TO_INT, SBN_INT_TO_CHAR,
    SBN_CODE_TO_DIM_MAP, DIM_TO_SBN_CODE_MAP
)

# --- PUZZLE FETCHING AND IMPORTING ---
def get_puzzle_from_local_file(size_id):
    """
    Fetches a random puzzle SBN string from a local text file based on size_id.

    It constructs the file path to a corresponding '.txt' file inside the
    'puzzles' directory, reads all puzzle strings, and returns one at random.
    The SBN string is then decoded into the standard puzzle data dictionary format.

    :param int size_id: The identifier for the puzzle size, corresponding to a filename.
    :returns: A dictionary containing the decoded puzzle data, or None if an error occurs.
    :rtype: dict | None
    """
    try:
        # The filename is the size_id directly (e.g., '0.txt', '1.txt').
        file_path = os.path.join(os.path.dirname(__file__), 'puzzles', f'{size_id}.txt')
        logging.info(f"Attempting to fetch puzzle from: {file_path}")

        if not os.path.exists(file_path):
            logging.error(f"Puzzle file not found at {file_path}")
            return None

        with open(file_path, 'r') as f:
            puzzles = [line.strip() for line in f if line.strip()]
        
        if not puzzles:
            logging.error(f"No puzzles found in {file_path}")
            return None
            
        random_sbn_string = random.choice(puzzles)
        logging.info(f"Selected SBN: {random_sbn_string}")

        puzzle_data = decode_sbn(random_sbn_string)
        
        if puzzle_data:
            logging.info("Successfully decoded SBN puzzle from local file.")
            return puzzle_data

        logging.error("Failed to decode the SBN string from the local file.")
        return None

    except Exception as e:
        logging.error(f"An exception occurred in get_puzzle_from_local_file: {e}")
        return None

def _parse_as_webtask(main_part):
    """
    A helper function to parse a string that might be in the 'webtask' format.

    It intelligently splits the input string into a puzzle definition part
    (comma-separated numbers) and an optional annotation part.

    :param str main_part: The primary data string to parse.
    :returns: A tuple containing the decoded puzzle data and any leftover
              raw annotation data, or (None, None) on failure.
    :rtype: tuple[dict | None, str | None]
    """
    try:
        best_split_index = -1
        # Find the split point between region data and annotation data
        for i in range(len(main_part), 0, -1):
            potential_task = main_part[:i]
            if not potential_task or not potential_task[-1].isdigit(): continue
            if not re.fullmatch(r'[\d,]+', potential_task): continue
            try:
                numbers = [int(n) for n in potential_task.split(',')]
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

def universal_import(input_string):
    """
    Decodes a puzzle string that can be in SBN or Web Task format.

    This function acts as a universal entry point for importing puzzles. It
    tries to parse the input as SBN first, and if that fails, falls back to
    parsing it as a webtask. It also handles optional player progress
    (annotations) and history data appended to the main string.

    :param str input_string: The string to be decoded.
    :returns: A dictionary containing the full puzzle state (task, stars,
              player_grid, history), or None if the format is unrecognized.
    :rtype: dict | None
    """
    logging.info("Attempting to import puzzle string...")
    parts = input_string.strip().split('~')
    main_part, history_part = parts[0], parts[1] if len(parts) > 1 else ""
    puzzle_data, raw_annotation_data = None, ""

    # Try decoding as SBN format first
    if len(main_part) >= 4 and main_part[0:2] in SBN_CODE_TO_DIM_MAP:
        try:
            puzzle_data = decode_sbn(main_part)
            if not puzzle_data: raise ValueError("SBN decoding returned None.")
            logging.info("Successfully decoded as SBN format.")
            _, dim = parse_and_validate_grid(puzzle_data['task'])
            # If player annotation data is present, extract it
            if dim and main_part[3] == 'e':
                border_chars_needed = math.ceil((2 * dim * (dim - 1)) / 6)
                base_sbn_len = 4 + border_chars_needed
                raw_annotation_data = main_part[base_sbn_len:]
        except Exception as e:
            logging.warning(f"SBN parsing failed: {e}. Trying other formats.")
            puzzle_data = None # Reset on failure
    
    # If not SBN, try decoding as Web Task format
    if not puzzle_data:
        logging.info("Input not recognized as SBN, trying Web Task format...")
        result = _parse_as_webtask(main_part)
        if result and result[0]:
            puzzle_data, raw_annotation_data = result
            logging.info("Successfully decoded as Web Task format.")

    if puzzle_data:
        _, dim = parse_and_validate_grid(puzzle_data['task'])
        if dim:
            puzzle_data['player_grid'] = decode_player_annotations(raw_annotation_data, dim)
            if history_part:
                mgr = HistoryManager.deserialize([[]] * dim, history_part)
                puzzle_data['history'] = {"changes": mgr.changes, "pointer": mgr.pointer}
        logging.info("Puzzle import successful.")
        return puzzle_data
        
    logging.error("Could not recognize puzzle format.")
    return None

# --- PLAYER ANNOTATION HANDLING ---
def encode_player_annotations(player_grid):
    """
    Encodes the player's grid (stars and marks) into a compact string.

    Uses a Base-4 representation (0 for empty, 1 for mark, 2 for star) and
    packs three grid states into a single Base64 character for efficiency.

    :param list[list[int]] player_grid: The 2D grid of player moves.
    :returns: A compact string representing the player's annotations.
    :rtype: str
    """
    if not player_grid: return ""
    dim, game_to_sbn = len(player_grid), {STATE_EMPTY: 0, STATE_SECONDARY_MARK: 1, STATE_STAR: 2}
    flat = [game_to_sbn.get(player_grid[r][c], 0) for r in range(dim) for c in range(dim)]
    if not any(flat): return ""
    sbn_states = []
    # Base-4 encoding, packing three grid states into one Base64 character
    for i in range(0, len(flat), 3):
        chunk = flat[i:i+3]
        chunk.extend([0] * (3 - len(chunk)))
        value = chunk[0] * 16 + chunk[1] * 4 + chunk[2]
        sbn_states.append(SBN_INT_TO_CHAR[value])
    return "".join(sbn_states)

def decode_player_annotations(annotation_data_str, dim):
    """
    Decodes a compact annotation string into a full player grid.

    This function is the inverse of `encode_player_annotations`. It unpacks the
    Base64 characters back into individual cell states.

    :param str annotation_data_str: The compact string of player moves.
    :param int dim: The dimension of the grid.
    :returns: A 2D list representing the player's grid.
    :rtype: list[list[int]]
    """
    grid = [[STATE_EMPTY] * dim for _ in range(dim)]
    if not annotation_data_str: return grid
    try:
        flat_indices = [(r, c) for r in range(dim) for c in range(dim)]
        sbn_to_game = {0: STATE_EMPTY, 1: STATE_SECONDARY_MARK, 2: STATE_STAR}
        char_cursor, cell_cursor = 0, 0
        
        while cell_cursor < dim**2 and char_cursor < len(annotation_data_str):
            value = SBN_CHAR_TO_INT.get(annotation_data_str[char_cursor], 0)
            states = [(value // 16), (value % 16) // 4, value % 4] # Unpack base-4 values
            for i in range(3):
                if cell_cursor + i < dim**2:
                    r, c = flat_indices[cell_cursor + i]
                    grid[r][c] = sbn_to_game.get(states[i], STATE_EMPTY)
            cell_cursor, char_cursor = cell_cursor + 3, char_cursor + 1
        return grid
    except (KeyError, IndexError, ValueError):
        logging.error("Failed to decode player annotations, returning empty grid.")
        return [[STATE_EMPTY] * dim for _ in range(dim)]

# --- SBN ENCODING AND DECODING ---
def encode_to_sbn(region_grid, stars, player_grid=None):
    """
    Encodes a full puzzle definition (regions and player moves) into the SBN format.

    :param list[list[int]] region_grid: The 2D grid defining the puzzle regions.
    :param int stars: The number of stars per region.
    :param list[list[int]] | None player_grid: The optional 2D grid of player moves.
    :returns: The complete SBN string, or None on failure.
    :rtype: str | None
    """
    dim = len(region_grid)
    sbn_code = DIM_TO_SBN_CODE_MAP.get(dim)
    if not sbn_code: return None

    vertical_bits = ['1' if c < dim - 1 and region_grid[r][c] != region_grid[r][c+1] else '0' for r in range(dim) for c in range(dim - 1)]
    # **FIXED**: Horizontal borders must be stored column-by-column to match the decoder.
    horizontal_bits = ['1' if r < dim - 1 and region_grid[r][c] != region_grid[r+1][c] else '0' for c in range(dim) for r in range(dim - 1)]
    
    clean_bitfield = "".join(vertical_bits) + "".join(horizontal_bits)
    padding_needed = (6 - len(clean_bitfield) % 6) % 6
    padded_bitfield = ('0' * padding_needed) + clean_bitfield
    
    region_data_chars = [SBN_INT_TO_CHAR[int(padded_bitfield[i:i+6], 2)] for i in range(0, len(padded_bitfield), 6)]
    region_data = "".join(region_data_chars)

    raw_annotation_data = encode_player_annotations(player_grid) if player_grid else ""
    flag = 'e' if raw_annotation_data else 'W'
    
    return f"{sbn_code}{stars}{flag}{region_data}{raw_annotation_data}"

def decode_sbn(sbn_string):
    """
    Decodes an SBN string into a puzzle data dictionary.

    It parses the SBN header to determine dimensions and then reconstructs
    the region grid from the encoded border data.

    :param str sbn_string: The SBN string to decode.
    :returns: A dictionary with 'task' and 'stars' keys.
    :rtype: dict
    :raises Exception: Propagates exceptions on parsing errors.
    """
    try:
        dim = SBN_CODE_TO_DIM_MAP.get(sbn_string[0:2])
        stars = int(sbn_string[2])
        border_bits_needed = 2 * dim * (dim - 1)
        border_chars_needed = math.ceil(border_bits_needed / 6)
        region_data = sbn_string[4:4+border_chars_needed]
        
        full_bitfield = "".join(bin(SBN_CHAR_TO_INT.get(c,0))[2:].zfill(6) for c in region_data)[-border_bits_needed:]
        v_bits, h_bits = full_bitfield[:dim*(dim-1)], full_bitfield[dim*(dim-1):]
        
        region_grid = reconstruct_grid_from_borders(dim, v_bits, h_bits)
        task_str = ",".join(str(cell) for row in region_grid for cell in row)
        return {'task': task_str, 'stars': stars}
    except (KeyError, IndexError, ValueError) as e:
        logging.error(f"Failed to decode SBN string: {e}")
        raise e

# --- WEB TASK AND GRID HELPERS ---
def decode_web_task_string(task_string):
    """
    Decodes a web-task (comma-separated) string into a puzzle data dictionary.

    :param str task_string: The comma-separated string of region numbers.
    :returns: A dictionary with 'task' and 'stars' keys, or None on failure.
    :rtype: dict | None
    """
    try:
        region_grid, dim = parse_and_validate_grid(task_string)
        if not region_grid: return None
        # Default stars based on dimension if not otherwise specified
        stars = next((p['stars'] for p in PUZZLE_DEFINITIONS if p['dim'] == dim), 1)
        return {'task': task_string, 'stars': stars}
    except Exception as e:
        logging.error(f"Failed to decode web task string: {e}")
        return None

def reconstruct_grid_from_borders(dim, v_bits, h_bits):
    """
    Rebuilds the region grid from its vertical and horizontal border definitions.

    Uses a flood-fill (BFS) algorithm to assign region IDs to cells based
    on the absence of borders between them.

    :param int dim: The dimension of the grid.
    :param str v_bits: A bitstring for vertical borders.
    :param str h_bits: A bitstring for horizontal borders.
    :returns: A 2D list representing the reconstructed region grid.
    :rtype: list[list[int]]
    """
    grid, region_id = [[0]*dim for _ in range(dim)], 1
    for r_start in range(dim):
        for c_start in range(dim):
            if grid[r_start][c_start] == 0:
                q = deque([(r_start, c_start)])
                grid[r_start][c_start] = region_id
                while q:
                    r, c = q.popleft()
                    # Check neighbors using a flood-fill algorithm
                    if c < dim-1 and grid[r][c+1]==0 and v_bits[r*(dim-1)+c]=='0': grid[r][c+1]=region_id; q.append((r,c+1))
                    if c > 0 and grid[r][c-1]==0 and v_bits[r*(dim-1)+c-1]=='0': grid[r][c-1]=region_id; q.append((r,c-1))
                    if r < dim-1 and grid[r+1][c]==0 and h_bits[c*(dim-1)+r]=='0': grid[r+1][c]=region_id; q.append((r+1,c))
                    if r > 0 and grid[r-1][c]==0 and h_bits[c*(dim-1)+r-1]=='0': grid[r-1][c]=region_id; q.append((r-1,c))
                region_id += 1
    return grid

def parse_and_validate_grid(task_string):
    """
    Converts a comma-separated string into a 2D list (grid) and validates its dimensions.

    :param str task_string: The comma-separated string of region numbers.
    :returns: A tuple containing the 2D grid and its dimension, or (None, None) on failure.
    :rtype: tuple[list[list[int]] | None, int | None]
    """
    if not task_string: return None, None
    try:
        nums = [int(n) for n in task_string.split(',')]
        if not nums: return None, None
        dim = math.isqrt(len(nums))
        if dim**2 != len(nums):
            logging.warning("Invalid grid dimensions: not a perfect square.")
            return None, None
        return [nums[i*dim:(i+1)*dim] for i in range(dim)], dim
    except (ValueError, TypeError):
        logging.error("Failed to parse grid string into numbers.")
        return None, None

def get_grid_from_puzzle_task(puzzle_data):
    """
    A simple helper to extract the grid and dimension from puzzle data.

    :param dict puzzle_data: The puzzle data dictionary containing a 'task' string.
    :returns: A tuple containing the 2D grid and its dimension, or (None, None) on failure.
    :rtype: tuple[list[list[int]] | None, int | None]
    """
    if not puzzle_data or 'task' not in puzzle_data:
        return None, None
    return parse_and_validate_grid(puzzle_data['task'])

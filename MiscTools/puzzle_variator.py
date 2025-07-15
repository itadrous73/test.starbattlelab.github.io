# ==================================================================================================
#
#   Star Battle Puzzle Variator
#
#   Author: Isaiah Tadrous
#   Version: 2.0.0
#
# --------------------------------------------------------------------------------------------------
#
#   Description:
#   This script is a command-line utility for augmenting and managing datasets of
#   Star Battle puzzles. It supports three primary operations:
#
#   1.  Generate Variations: Reads puzzles in Star Battle Notation (SBN) and
#       creates all unique symmetrical variations (up to 8 per puzzle).
#   2.  Deduplicate Variations: Scans a file and removes isomorphic duplicates,
#       ensuring only one canonical version of each puzzle remains.
#   3.  Transform Puzzles: Applies a single, specified geometric transformation
#       (e.g., a 90-degree rotation) to every puzzle in a file.
#
# --------------------------------------------------------------------------------------------------
#
#   Usage:
#
#   To generate all variations:
#   python puzzle_variator.py generate <input_path> <output_path> [-a]
#
#   To remove variations from a file:
#   python puzzle_variator.py deduplicate <input_path> <output_path> [-a]
#
#   To apply a single transformation to a file:
#   python puzzle_variator.py transform <input_path> <output_path> --type <transformation> [-a]
#
#   Arguments:
#     input_path       Path to the source text file containing SBN puzzles.
#     output_path      Path to the file where results will be written.
#     -a, --append     Optional. Appends puzzles to the output file instead
#                      of overwriting it.
#     --type           Required for 'transform' mode. The transformation to apply.
#                      Choices: rotate90, rotate180, rotate270, flipH, flipV.
#
# ==================================================================================================

import sys
import math
from collections import deque
import argparse # Using argparse for a more robust and user-friendly CLI.

# --- SBN Format Constants ---
# These constants define the Star Battle Notation format and must be synchronized
# with any other tools in the ecosystem (e.g., solvers, GUI applications).

SBN_B64_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'
SBN_CHAR_TO_INT = {c: i for i, c in enumerate(SBN_B64_ALPHABET)}
SBN_INT_TO_CHAR = {i: c for i, c in enumerate(SBN_B64_ALPHABET)}
SBN_CODE_TO_DIM_MAP = {
    '55': 5,  '66': 6,  '77': 7,  '88': 8,  '99': 9, 'AA': 10, 'BB': 11, 'CC': 12, 'DD': 13,
    'EE': 14, 'FF': 15, 'GG': 16, 'HH': 17, 'II': 18, 'JJ': 19, 'KK': 20, 'LL': 21, 'MM': 22,
    'NN': 23, 'OO': 24, 'PP': 25
}
DIM_TO_SBN_CODE_MAP = {v: k for k, v in SBN_CODE_TO_DIM_MAP.items()}

# --- Grid Transformation Functions ---
# These functions perform the geometric operations on the puzzle grid.

def rotate_grid_90_clockwise(grid):
    """ Rotates a 2D list (grid) 90 degrees clockwise. """
    if not grid or not grid[0]:
        return grid
    return [list(reversed(row)) for row in zip(*grid)]

def flip_grid_horizontally(grid):
    """ Flips a 2D list (grid) horizontally. """
    if not grid or not grid[0]:
        return grid
    return [row[::-1] for row in grid]

def flip_grid_vertically(grid):
    """ Flips a 2D list (grid) vertically. """
    if not grid or not grid[0]:
        return grid
    return grid[::-1]


# --- SBN Handling Functions ---
# These functions handle the conversion between SBN strings and grid data.

def decode_sbn(sbn_string):
    """
    Decodes an SBN string into its constituent parts: a region grid and stars.
    """
    try:
        dim = SBN_CODE_TO_DIM_MAP.get(sbn_string[0:2])
        if dim is None:
            print(f"Warning: Could not determine dimension from SBN code '{sbn_string[0:2]}'. Skipping.")
            return None

        stars = int(sbn_string[2])
        border_bits_needed = 2 * dim * (dim - 1)
        border_chars_needed = math.ceil(border_bits_needed / 6)

        region_data_part = sbn_string[4 : 4 + border_chars_needed]
        region_data_part = region_data_part.ljust(border_chars_needed, SBN_B64_ALPHABET[0])

        full_bitfield = "".join(bin(SBN_CHAR_TO_INT.get(c, 0))[2:].zfill(6) for c in region_data_part)
        actual_bitfield = full_bitfield[-border_bits_needed:]

        v_bits = actual_bitfield[:dim * (dim - 1)]
        h_bits = actual_bitfield[dim * (dim - 1):]

        region_grid = reconstruct_grid_from_borders(dim, v_bits, h_bits)

        return {'grid': region_grid, 'stars': stars}
    except (KeyError, IndexError, ValueError) as e:
        print(f"Warning: Failed to decode SBN string '{sbn_string}'. Error: {e}. Skipping.")
        return None

def reconstruct_grid_from_borders(dim, v_bits, h_bits):
    """Reconstructs the region grid from its border definitions using a flood-fill algorithm."""
    grid, region_id = [[0] * dim for _ in range(dim)], 1
    for r_start in range(dim):
        for c_start in range(dim):
            if grid[r_start][c_start] == 0:
                q = deque([(r_start, c_start)])
                grid[r_start][c_start] = region_id
                while q:
                    r, c = q.popleft()
                    # Check right neighbor
                    if c < dim - 1 and grid[r][c+1] == 0 and v_bits[r * (dim - 1) + c] == '0':
                        grid[r][c+1] = region_id; q.append((r, c+1))
                    # Check left neighbor
                    if c > 0 and grid[r][c-1] == 0 and v_bits[r * (dim - 1) + c - 1] == '0':
                        grid[r][c-1] = region_id; q.append((r, c-1))
                    # Check bottom neighbor
                    if r < dim - 1 and grid[r+1][c] == 0 and h_bits[c * (dim - 1) + r] == '0':
                        grid[r+1][c] = region_id; q.append((r+1, c))
                    # Check top neighbor
                    if r > 0 and grid[r-1][c] == 0 and h_bits[c * (dim - 1) + r - 1] == '0':
                        grid[r-1][c] = region_id; q.append((r-1, c))
                region_id += 1
    return grid

def encode_to_sbn(region_grid, stars):
    """Encodes a region grid and star count back into a valid SBN string."""
    if not region_grid or not region_grid[0]:
        return None
    dim = len(region_grid)
    sbn_code = DIM_TO_SBN_CODE_MAP.get(dim)
    if not sbn_code:
        return None

    vertical_bits = ['1' if c < dim - 1 and region_grid[r][c] != region_grid[r][c+1] else '0' for r in range(dim) for c in range(dim - 1)]
    horizontal_bits = ['1' if r < dim - 1 and region_grid[r][c] != region_grid[r+1][c] else '0' for c in range(dim) for r in range(dim - 1)]

    clean_bitfield = "".join(vertical_bits) + "".join(horizontal_bits)
    padding_needed = (6 - len(clean_bitfield) % 6) % 6
    padded_bitfield = ('0' * padding_needed) + clean_bitfield

    region_data_chars = [SBN_INT_TO_CHAR[int(padded_bitfield[i:i+6], 2)] for i in range(0, len(padded_bitfield), 6)]
    region_data = "".join(region_data_chars)

    return f"{sbn_code}{stars}W{region_data}"


# --- Core Application Logic ---

def generate_puzzle_variations(sbn_string):
    """
    Takes a single SBN string and generates all unique symmetrical variations.
    """
    decoded_puzzle = decode_sbn(sbn_string)
    if not decoded_puzzle:
        return set()

    initial_grid = decoded_puzzle['grid']
    stars = decoded_puzzle['stars']
    generated_sbns = set()

    base_grids = [
        initial_grid,
        flip_grid_horizontally(initial_grid),
        flip_grid_vertically(initial_grid)
    ]

    for grid in base_grids:
        current_grid = grid
        for _ in range(4):
            sbn = encode_to_sbn(current_grid, stars)
            if sbn:
                generated_sbns.add(sbn)
            current_grid = rotate_grid_90_clockwise(current_grid)

    return generated_sbns

def deduplicate_variations(sbn_list):
    """
    Scans a list of SBNs and removes variations, keeping only one of each.
    """
    seen_sbns = set()
    unique_sbns = []
    for sbn in sbn_list:
        if sbn in seen_sbns:
            continue
        
        unique_sbns.append(sbn)
        variations = generate_puzzle_variations(sbn)
        seen_sbns.update(variations)
    return unique_sbns

def transform_puzzles(sbn_list, transform_type):
    """
    Applies a single specified transformation to a list of SBNs.
    """
    transformed_sbns = []
    
    # Define the mapping from CLI argument to function
    transformations = {
        'rotate90': lambda g: rotate_grid_90_clockwise(g),
        'rotate180': lambda g: rotate_grid_90_clockwise(rotate_grid_90_clockwise(g)),
        'rotate270': lambda g: rotate_grid_90_clockwise(rotate_grid_90_clockwise(rotate_grid_90_clockwise(g))),
        'flipH': lambda g: flip_grid_horizontally(g),
        'flipV': lambda g: flip_grid_vertically(g),
    }

    transform_func = transformations.get(transform_type)
    if not transform_func:
        print(f"Error: Unknown transformation type '{transform_type}'")
        sys.exit(1)

    for sbn in sbn_list:
        decoded = decode_sbn(sbn)
        if not decoded:
            continue
        
        transformed_grid = transform_func(decoded['grid'])
        new_sbn = encode_to_sbn(transformed_grid, decoded['stars'])
        if new_sbn:
            transformed_sbns.append(new_sbn)
            
    return transformed_sbns


def main():
    """
    Main function to run the script from the command line.
    """
    parser = argparse.ArgumentParser(
        description="A command-line tool for managing Star Battle puzzle datasets.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="command", required=True, help="Available commands")

    # --- Generate Variations Sub-parser ---
    parser_generate = subparsers.add_parser("generate", help="Generate all unique variations for each puzzle.")
    parser_generate.add_argument("input_path", help="Path to the source file with SBN puzzles.")
    parser_generate.add_argument("output_path", help="Path to write the generated variations.")
    parser_generate.add_argument("-a", "--append", action="store_true", help="Append puzzles to the output file instead of overwriting.")

    # --- Deduplicate Variations Sub-parser ---
    parser_deduplicate = subparsers.add_parser("deduplicate", help="Scan a file and remove all but one of each puzzle variation.")
    parser_deduplicate.add_argument("input_path", help="Path to the source file to clean.")
    parser_deduplicate.add_argument("output_path", help="Path to write the unique puzzles.")
    parser_deduplicate.add_argument("-a", "--append", action="store_true", help="Append puzzles to the output file.")

    # --- Transform Puzzles Sub-parser ---
    parser_transform = subparsers.add_parser("transform", help="Apply a single transformation to all puzzles in a file.")
    parser_transform.add_argument("input_path", help="Path to the source file to transform.")
    parser_transform.add_argument("output_path", help="Path to write the transformed puzzles.")
    parser_transform.add_argument(
        "--type", 
        required=True, 
        choices=['rotate90', 'rotate180', 'rotate270', 'flipH', 'flipV'],
        help="The specific transformation to apply to all puzzles."
    )
    parser_transform.add_argument("-a", "--append", action="store_true", help="Append puzzles to the output file.")

    args = parser.parse_args()

    # Read source puzzles from the input file.
    try:
        with open(args.input_path, 'r') as f:
            source_sbns = [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        print(f"Error: Input file not found at '{args.input_path}'")
        sys.exit(1)

    print(f"Reading {len(source_sbns)} puzzles from '{args.input_path}'...")
    
    output_sbns = []

    # Execute the logic based on the chosen command
    if args.command == "generate":
        all_generated_sbns = set()
        for sbn in source_sbns:
            variations = generate_puzzle_variations(sbn)
            all_generated_sbns.update(variations)
        output_sbns = sorted(list(all_generated_sbns))
        print(f"Generated {len(output_sbns)} unique puzzles.")

    elif args.command == "deduplicate":
        output_sbns = deduplicate_variations(source_sbns)
        print(f"Found {len(output_sbns)} unique puzzles after deduplication.")

    elif args.command == "transform":
        output_sbns = transform_puzzles(source_sbns, args.type)
        print(f"Applied transformation '{args.type}' to {len(output_sbns)} puzzles.")

    # Write the results to the output file
    file_mode = 'a' if args.append else 'w'
    action_word = "Appending" if args.append else "Writing"
    
    with open(args.output_path, file_mode) as f:
        for sbn in output_sbns:
            f.write(sbn + '\n')

    print(f"Successfully {action_word.lower()} puzzles to '{args.output_path}'.")


if __name__ == "__main__":
    main()

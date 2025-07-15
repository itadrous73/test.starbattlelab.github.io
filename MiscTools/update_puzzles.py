#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# =============================================================================
#
# Program:      update_puzzles.py
#
# Author:       Isaiah Tadrous
#
# Description:  A comprehensive command-line utility for managing a structured
#               JSON database of puzzles. This script provides a suite of
#               tools to initialize, inspect, and modify the puzzle file,
#               facilitating common data management tasks such as batch
#               conversion, insertion, addition, and deletion of puzzle data.
#
# -----------------------------------------------------------------------------
#
# Usage & Commands:
#
#   Global Options:
#     --dry-run          Show what would happen without modifying any files.
#     --no-backup        Disable automatic creation of a .bak file.
#
#   1. convert: Convert numbered .txt files to a puzzles.json file.
#      usage: python update_puzzles.py convert <json_file> --num-files <N> [options]
#      example: python update_puzzles.py convert puzzles.json --num-files 11
#      example: python update_puzzles.py convert levels.json --num-files 5 --prefix "level_"
#
#   2. list: List all puzzle indices and their counts.
#      usage: python update_puzzles.py list <json_file>
#      example: python update_puzzles.py list puzzles.json
#
#   3. add: Add one or more puzzles to an existing index.
#      usage: python update_puzzles.py add <json_file> --index <N> --puzzles "p1" ["p2" ...]
#      example: python update_puzzles.py add puzzles.json --index 4 --puzzles "puzzle_A" "puzzle_B"
#
#   4. insert: Insert puzzles from a file at an index, shifting others.
#      usage: python update_puzzles.py insert <json_file> --index <N> --from-file <path_to_txt>
#      example: python update_puzzles.py insert puzzles.json --index 5 --from-file new_puzzles.txt
#
#   5. delete: Delete an entire index or a specific puzzle within it.
#      usage: python update_puzzles.py delete <json_file> --index <N> [--puzzle <puzzle_str>]
#      example (delete index): python update_puzzles.py delete puzzles.json --index 7
#      example (delete puzzle): python update_puzzles.py delete puzzles.json --index 4 --puzzle "puzzle_A"
#
# =============================================================================

import argparse
import json
import os
import sys
import shutil
from pathlib import Path
from typing import Dict, List, Any

# --- Core Helper Functions for File I/O & Data Validation ---

def load_json_data(file_path: Path) -> Dict[str, Any]:
    """
    Safely loads and validates data from a specified JSON file.

    This function attempts to open and parse a JSON file. It performs critical
    validations to ensure the file exists and is well-formed. It specifically
    checks that all top-level keys in the JSON object can be interpreted as
    integers, which is a core requirement for the data structure.

    Args:
        file_path (Path): A pathlib.Path object pointing to the target JSON file.

    Returns:
        Dict[str, Any]: A dictionary containing the parsed JSON data. If the file
                        does not exist, it returns an empty dictionary, allowing
                        for graceful initialization of a new data file.

    Raises:
        SystemExit: The script will terminate with a status code of 1 if the
                    file contains invalid JSON, has non-integer keys, or if
                    an IOError occurs during reading.
    """
    # If the file does not exist, return an empty dictionary to signal the
    # creation of a new file.
    if not file_path.exists():
        return {}

    try:
        # Open the file with UTF-8 encoding for broad compatibility.
        with file_path.open('r', encoding='utf-8') as f:
            data = json.load(f)
            # --- Data Structure Validation ---
            # Ensure all top-level keys are strings that represent integers.
            # This is crucial for sorting and indexing operations.
            for key in data.keys():
                int(key)
            return data
    except json.JSONDecodeError:
        # Handle cases where the file is not a valid JSON document.
        print(f"Error: The file '{file_path}' contains invalid JSON. Please check its format.", file=sys.stderr)
        sys.exit(1)
    except ValueError:
        # Handle cases where a key like "level_1" cannot be cast to an integer.
        print(f"Error: All top-level keys in '{file_path}' must be strings representing integers.", file=sys.stderr)
        sys.exit(1)
    except IOError as e:
        # Handle file system errors (e.g., permissions).
        print(f"Error: Could not read file '{file_path}': {e}", file=sys.stderr)
        sys.exit(1)

def save_json_data(file_path: Path, data: Dict[str, Any], dry_run: bool, no_backup: bool) -> None:
    """
    Writes dictionary data to a JSON file with sorting, backup, and dry-run capabilities.

    Before writing, this function sorts the data by its integer keys to ensure
    a consistent and human-readable file structure. It provides a dry-run mode
    to preview changes and an automatic backup mechanism to prevent data loss.

    Args:
        file_path (Path): The target file path for saving the data.
        data (Dict[str, Any]): The dictionary object to serialize and write.
        dry_run (bool): If True, prints the potential output to the console
                        instead of writing to the file.
        no_backup (bool): If True, disables the automatic backup creation.

    Raises:
        SystemExit: The script will terminate if the file cannot be written due
                    to permissions or other I/O errors.
    """
    # --- Data Preparation ---
    # Sort the dictionary by integer-cast keys to maintain a logical order.
    # This is critical for consistency.
    sorted_data = dict(sorted(data.items(), key=lambda item: int(item[0])))

    # --- Dry-Run Mode ---
    if dry_run:
        print("--- DRY RUN MODE: No files will be modified. ---")
        print(f"File '{file_path}' would be updated with the following content:")
        # Pretty-print the JSON to the console for review.
        print(json.dumps(sorted_data, indent=4))
        return

    # --- Backup Mechanism ---
    # Create a backup before overwriting the original file, unless disabled.
    if not no_backup and file_path.exists():
        # Append a .bak extension to the original file name.
        backup_path = file_path.with_suffix(file_path.suffix + '.bak')
        try:
            # copy2 preserves file metadata.
            shutil.copy2(file_path, backup_path)
            print(f"Backup created at '{backup_path}'")
        except Exception as e:
            # A failed backup should not stop the main operation, but a warning is necessary.
            print(f"Warning: Could not create backup for '{file_path}': {e}", file=sys.stderr)

    # --- File Writing ---
    try:
        with file_path.open('w', encoding='utf-8') as f:
            # Write the sorted data with an indent of 4 for readability.
            json.dump(sorted_data, f, indent=4)
        print(f"Successfully saved changes to '{file_path}'.")
    except IOError as e:
        print(f"Error: Could not write to '{file_path}': {e}", file=sys.stderr)
        sys.exit(1)

# --- Command-Specific Functions ---

def do_convert(args: argparse.Namespace) -> None:
    """
    Controller function for the 'convert' command.
    Converts a series of numbered text files into a single JSON object.
    
    Args:
        args (argparse.Namespace): The command-line arguments object, containing
                                   input_dir, num_files, prefix, and file paths.
    """
    print(f"Starting conversion of text files in '{args.input_dir}'...")
    puzzles_data: Dict[str, List[str]] = {}
    
    # Iterate through the expected range of file numbers.
    for i in range(args.num_files):
        file_index = str(i)
        # Construct the filename based on the provided prefix and index.
        txt_filename = f"{args.prefix}{file_index}.txt" if args.prefix else f"{file_index}.txt"
        txt_filepath = args.input_dir / txt_filename

        if not txt_filepath.exists():
            print(f"Warning: File '{txt_filepath}' not found. Using empty list for index '{file_index}'.")
            puzzles_data[file_index] = []
            continue

        try:
            with txt_filepath.open('r', encoding='utf-8') as f:
                # Read each line, strip leading/trailing whitespace, and filter out empty lines.
                puzzles = [line.strip() for line in f if line.strip()]
                puzzles_data[file_index] = puzzles
                print(f"Processed '{txt_filepath}' ({len(puzzles)} puzzles).")
        except Exception as e:
            print(f"Error reading '{txt_filepath}': {e}", file=sys.stderr)
            puzzles_data[file_index] = []

    save_json_data(args.json_file, puzzles_data, args.dry_run, args.no_backup)

def do_insert(args: argparse.Namespace) -> None:
    """
    Controller function for the 'insert' command.
    Inserts new puzzles at a specified index, shifting all subsequent indices.
    
    Args:
        args (argparse.Namespace): The command-line arguments object.
    """
    if not args.puzzles_file.exists():
        print(f"Error: Puzzle file '{args.puzzles_file}' not found.", file=sys.stderr)
        sys.exit(1)

    # Read the new puzzles from the specified text file.
    with args.puzzles_file.open('r') as f:
        new_puzzles = [line.strip() for line in f if line.strip()]

    # Load the existing data and prepare a new dictionary for the restructured data.
    data = load_json_data(args.json_file)
    new_data: Dict[str, Any] = {}
    insert_idx = args.index

    # Sort keys in reverse numerical order to prevent overwriting data during the shift.
    sorted_keys = sorted([int(k) for k in data.keys()], reverse=True)

    # Re-populate the dictionary, shifting indices as needed.
    for key_int in sorted_keys:
        if key_int >= insert_idx:
            # Shift this entry's key up by one.
            new_data[str(key_int + 1)] = data[str(key_int)]
        else:
            # Keep this entry as is.
            new_data[str(key_int)] = data[str(key_int)]

    # Insert the new puzzles at the target index.
    new_data[str(insert_idx)] = new_puzzles
    
    print(f"Injecting {len(new_puzzles)} new puzzles from '{args.puzzles_file}' at index '{insert_idx}'.")
    print(f"Indices from '{insert_idx}' onwards will be shifted up by one.")
    save_json_data(args.json_file, new_data, args.dry_run, args.no_backup)

def do_add(args: argparse.Namespace) -> None:
    """
    Controller function for the 'add' command.
    Appends one or more puzzles to an existing or new index without shifting.
    
    Args:
        args (argparse.Namespace): The command-line arguments object.
    """
    data = load_json_data(args.json_file)
    index_str = str(args.index)

    # If the index does not exist, create it.
    if index_str not in data:
        print(f"Warning: Index '{index_str}' does not exist. It will be created.")
        data[index_str] = []
    
    # Extend the list of puzzles at the specified index.
    data[index_str].extend(args.puzzles)
    print(f"Appending {len(args.puzzles)} puzzle(s) to index '{index_str}'.")
    save_json_data(args.json_file, data, args.dry_run, args.no_backup)

def do_delete(args: argparse.Namespace) -> None:
    """
    Controller function for the 'delete' command.
    Deletes either an entire index or a specific puzzle within an index.
    
    Args:
        args (argparse.Namespace): The command-line arguments object.
    """
    data = load_json_data(args.json_file)
    index_str = str(args.index)

    if index_str not in data:
        print(f"Error: Index '{index_str}' not found in '{args.json_file}'.", file=sys.stderr)
        sys.exit(1)

    if args.puzzle:
        # --- Delete a specific puzzle string ---
        try:
            data[index_str].remove(args.puzzle)
            print(f"Removed puzzle from index '{index_str}'.")
        except ValueError:
            # This error occurs if the puzzle string is not in the list.
            print(f"Error: Puzzle '{args.puzzle}' not found in index '{index_str}'.", file=sys.stderr)
            sys.exit(1)
    else:
        # --- Delete the entire index ---
        del data[index_str]
        print(f"Deleted entire index '{index_str}'.")
        # Note: This operation can leave a gap in the numbering (e.g., 1, 2, 4, 5).
        # A future enhancement could be to add a '--renumber' flag to fix gaps.

    save_json_data(args.json_file, data, args.dry_run, args.no_backup)

def do_list(args: argparse.Namespace) -> None:
    """
    Controller function for the 'list' command.
    Displays a summary of the contents of the puzzle JSON file.
    
    Args:
        args (argparse.Namespace): The command-line arguments object.
    """
    data = load_json_data(args.json_file)
    if not data:
        print(f"File '{args.json_file}' is empty or does not exist.")
        return
        
    print(f"Contents of '{args.json_file}':")
    # Sort keys numerically for a clean, ordered report.
    sorted_keys = sorted([int(k) for k in data.keys()])
    for key in sorted_keys:
        count = len(data[str(key)])
        print(f"  - Index {key}: {count} puzzle(s)")

# --- Main Execution Block & Argument Parser Setup ---

def main():
    """
    Main entry point for the script.
    
    Configures the command-line argument parser, defines all available commands
    and their options, and dispatches execution to the appropriate controller function.
    """
    # Initialize the main parser with a description and a formatter class that
    # preserves whitespace in help messages for better readability.
    parser = argparse.ArgumentParser(
        description="A command-line tool to manage a JSON puzzle database.",
        formatter_class=argparse.RawTextHelpFormatter
    )

    # --- Global Arguments ---
    # These arguments are applicable to all commands that modify files.
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Show what would happen without modifying any files."
    )
    parser.add_argument(
        '--no-backup',
        action='store_true',
        help="Disable the automatic creation of a .bak file before saving."
    )

    # --- Subparser Configuration ---
    # Subparsers are used to create distinct commands (like git's `commit`, `push`, etc.).
    subparsers = parser.add_subparsers(dest='command', required=True, help='Available commands')

    # --- 'convert' Command ---
    p_convert = subparsers.add_parser('convert', help='Convert numbered .txt files to a puzzles.json file.')
    p_convert.add_argument('json_file', type=Path, help='Path to the output JSON file to create/overwrite.')
    p_convert.add_argument('--input-dir', type=Path, default=Path('.'), help='Directory containing the input .txt files (default: current directory).')
    p_convert.add_argument('--num-files', type=int, required=True, help='Number of text files to process (e.g., 11 for 0.txt to 10.txt).')
    p_convert.add_argument('--prefix', type=str, help='Optional filename prefix (e.g., "level_" for level_0.txt).')
    p_convert.set_defaults(func=do_convert)
    
    # --- 'list' Command ---
    p_list = subparsers.add_parser('list', help='List all puzzle indices and their counts.')
    p_list.add_argument('json_file', type=Path, help='Path to the JSON file to inspect.')
    p_list.set_defaults(func=do_list)

    # --- 'insert' Command ---
    p_insert = subparsers.add_parser('insert', help='Insert puzzles from a file at an index, shifting others down.')
    p_insert.add_argument('json_file', type=Path, help='Path to the JSON file to modify.')
    p_insert.add_argument('--index', type=int, required=True, help='The integer index at which to insert the puzzles.')
    p_insert.add_argument('--from-file', dest='puzzles_file', type=Path, required=True, help='The .txt file containing new puzzles, one per line.')
    p_insert.set_defaults(func=do_insert)

    # --- 'add' Command ---
    p_add = subparsers.add_parser('add', help='Add one or more puzzles to an existing index.')
    p_add.add_argument('json_file', type=Path, help='Path to the JSON file to modify.')
    p_add.add_argument('--index', type=int, required=True, help='The index to add the puzzle(s) to.')
    p_add.add_argument('--puzzles', type=str, nargs='+', required=True, help='The new puzzle string(s) to add.')
    p_add.set_defaults(func=do_add)

    # --- 'delete' Command ---
    p_delete = subparsers.add_parser('delete', help='Delete an entire index or a specific puzzle within it.')
    p_delete.add_argument('json_file', type=Path, help='Path to the JSON file to modify.')
    p_delete.add_argument('--index', type=int, required=True, help='The index to modify.')
    p_delete.add_argument('--puzzle', type=str, help='Optional: The specific puzzle string to remove from the index.')
    p_delete.set_defaults(func=do_delete)

    # Parse the command-line arguments provided by the user.
    args = parser.parse_args()
    
    # Call the function associated with the chosen command (set by `set_defaults`).
    args.func(args)

if __name__ == "__main__":
    # This standard Python construct ensures that the `main()` function is called
    # only when the script is executed directly, not when it's imported as a module.
    main()

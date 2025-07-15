"""**********************************************************************************
 * Title: constants.py
 *
 * @author Joseph Bryant
 * @refactored by Isaiah Tadrous
 * @version 2.0.1
 * -------------------------------------------------------------------------------
 * Description:
 * This file contains all the static data and constants for the Star Battle
 * puzzle application. It centralizes configuration values and definitions,
 * such as game state identifiers, alphabets and mappings for Star Battle
 * Notation (SBN) encoding/decoding, and the definitions for all available
 * puzzle sizes and their associated properties like difficulty and the
 * number of stars.
 **********************************************************************************"""

# --- GAME STATE CONSTANTS ---
# Defines the possible states for a single cell on the puzzle grid.
STATE_EMPTY = 0
STATE_STAR = 1
STATE_SECONDARY_MARK = 2

# --- SBN (STAR BATTLE NOTATION) CONSTANTS ---
# These constants are used for encoding and decoding the puzzle state to and from
# the compact Star Battle Notation string format.

# The custom Base64 alphabet used for SBN encoding.
SBN_B64_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'

# Pre-computed mapping from SBN characters to their integer equivalents for fast decoding.
SBN_CHAR_TO_INT = {c: i for i, c in enumerate(SBN_B64_ALPHABET)}

# Pre-computed mapping from integers to their SBN character equivalents for fast encoding.
SBN_INT_TO_CHAR = {i: c for i, c in enumerate(SBN_B64_ALPHABET)}

# Maps two-character SBN codes to their corresponding puzzle dimensions (grid size).
SBN_CODE_TO_DIM_MAP = {
    '55': 5,  '66': 6,  '77': 7,  '88': 8,  '99': 9, 'AA': 10, 'BB': 11, 'CC': 12, 'DD': 13,
    'EE': 14, 'FF': 15, 'GG': 16, 'HH': 17, 'II': 18, 'JJ': 19, 'KK': 20, 'LL': 21, 'MM': 22,
    'NN': 23, 'OO': 24, 'PP': 25
}

# The reverse mapping of SBN_CODE_TO_DIM_MAP for converting dimensions back to SBN codes.
DIM_TO_SBN_CODE_MAP = {v: k for k, v in SBN_CODE_TO_DIM_MAP.items()}

# The alphabet used for displaying Base64 encoded data.
BASE64_DISPLAY_ALPHABET = SBN_B64_ALPHABET

# --- PUZZLE DEFINITION CONSTANTS ---
# A list of dictionaries, where each dictionary defines a specific puzzle type
# available in the application. It includes dimensions, the number of stars per
# region, and a difficulty rating. The index of each entry serves as its 'size_id'.
PUZZLE_DEFINITIONS = [
    {'dim': 5,  'stars': 1, 'difficulty': 'easy'},   # 0
    {'dim': 6,  'stars': 1, 'difficulty': 'easy'},   # 1
    {'dim': 6,  'stars': 1, 'difficulty': 'medium'}, # 2
    {'dim': 8,  'stars': 1, 'difficulty': 'medium'}, # 3
    {'dim': 8,  'stars': 1, 'difficulty': 'hard'},   # 4
    {'dim': 10, 'stars': 2, 'difficulty': 'medium'}, # 5
    {'dim': 10, 'stars': 2, 'difficulty': 'hard'},   # 6
    {'dim': 14, 'stars': 3, 'difficulty': 'medium'}, # 7
    {'dim': 14, 'stars': 3, 'difficulty': 'hard'},   # 8
    {'dim': 17, 'stars': 4, 'difficulty': 'hard'},   # 9
    {'dim': 21, 'stars': 5, 'difficulty': 'hard'},   # 10
    {'dim': 25, 'stars': 6, 'difficulty': 'hard'}    # 11
]

# A list of valid size_ids, generated from the PUZZLE_DEFINITIONS.
WEBSITE_SIZE_IDS = list(range(len(PUZZLE_DEFINITIONS)))

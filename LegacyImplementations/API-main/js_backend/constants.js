/**
 **********************************************************************************
 *
 * Star Battle Puzzle - Global Constants & Notation Maps
 *
 * @author Isaiah Tadrous
 * @version 1.0.0
 *
 * -------------------------------------------------------------------------------
 *
 * Description:
 * This file defines all global constants used throughout the Star Battle application.
 * It includes:
 *   - Game state values for grid cells (empty, star, secondary mark)
 *   - SBN (Star Battle Notation) base64-like character encoding
 *   - Mappings between SBN codes and board dimensions
 *   - A registry of predefined puzzle configurations by size and difficulty
 *
 * These constants are used for consistent encoding, decoding, rendering logic,
 * and puzzle selection across both logic and UI modules.
 *
 * Information referenced from a Python implementation developed by Joseph Bryant.
 *
 **********************************************************************************
 */


// --- GAME STATE CONSTANTS ---
export const STATE_EMPTY = 0;
export const STATE_STAR = 1;
export const STATE_SECONDARY_MARK = 2;

// --- SBN (STAR BATTLE NOTATION) CONSTANTS ---
export const SBN_B64_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

// Pre-computed mappings for fast encoding/decoding
export const SBN_CHAR_TO_INT = Object.fromEntries(Array.from(SBN_B64_ALPHABET).map((c, i) => [c, i]));
export const SBN_INT_TO_CHAR = Object.fromEntries(Array.from(SBN_B64_ALPHABET).map((c, i) => [i, c]));

// Maps SBN codes to dimensions
export const SBN_CODE_TO_DIM_MAP = {
    '55': 5,  '66': 6,  '77': 7,  '88': 8,  '99': 9, 'AA': 10, 'BB': 11, 'CC': 12, 'DD': 13,
    'EE': 14, 'FF': 15, 'GG': 16, 'HH': 17, 'II': 18, 'JJ': 19, 'KK': 20, 'LL': 21, 'MM': 22,
    'NN': 23, 'OO': 24, 'PP': 25
};

// Reverse mapping from dimensions to SBN codes
export const DIM_TO_SBN_CODE_MAP = Object.fromEntries(Object.entries(SBN_CODE_TO_DIM_MAP).map(([k, v]) => [v, k]));

// --- PUZZLE DEFINITION CONSTANTS ---
export const PUZZLE_DEFINITIONS = [
    { dim: 5,  stars: 1, difficulty: 'easy' },   // 0
    { dim: 6,  stars: 1, difficulty: 'easy' },   // 1
    { dim: 6,  stars: 1, difficulty: 'medium' }, // 2
    { dim: 8,  stars: 1, difficulty: 'medium' }, // 3
    { dim: 8,  stars: 1, difficulty: 'hard' },   // 4
    { dim: 10, stars: 2, difficulty: 'medium' }, // 5
    { dim: 10, stars: 2, difficulty: 'hard' },   // 6
    { dim: 14, stars: 3, difficulty: 'medium' }, // 7
    { dim: 14, stars: 3, difficulty: 'hard' },   // 8
    { dim: 17, stars: 4, difficulty: 'hard' },   // 9
    { dim: 21, stars: 5, difficulty: 'hard' },   // 10
    { dim: 25, stars: 6, difficulty: 'hard' }    // 11
];
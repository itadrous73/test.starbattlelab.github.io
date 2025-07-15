"""
**********************************************************************************
* Title: history_manager.py
*
* Metadata:
* @author Joseph Bryant
* @refactored by Isaiah Tadrous
* @version 1.5.0
* -------------------------------------------------------------------------------
* Description:
* This module provides the HistoryManager class, a self-contained system for
* managing undo and redo functionality. It operates on a differential basis,
* storing an initial state and a list of subsequent changes. The current grid
* state is rebuilt on demand by applying these changes, ensuring data
* integrity. It also includes methods for serializing the entire history
* into a compact string for saving and exporting, and deserializing it back
* into a functional manager instance.
*
**********************************************************************************
"""
# history_manager.py
# Description: A class to manage a differential state history for undo/redo functionality.

# --- IMPORTS ---
import copy
from constants import SBN_CHAR_TO_INT, SBN_INT_TO_CHAR

# --- HISTORYMANAGER CLASS DEFINITION ---
class HistoryManager:
    """
    Manages a history of grid changes. It is self-contained and rebuilds the
    grid state on demand to ensure correctness.
    """
    def __init__(self, initial_state):
        """
        Initializes the history manager with a deep copy of the initial grid state.

        :param list[list[int]] initial_state: The starting grid configuration.
        """
        self.initial_state = copy.deepcopy(initial_state)
        self.changes = []  # List of tuples: (row, col, from_state, to_state)
        self.pointer = 0   # Points to the next position in the changes list to apply.

    def add_change(self, change):
        """
        Adds a new change to the history.

        If a change is added after an undo operation, it truncates the "redo"
        history before appending the new change.

        :param tuple change: A tuple representing the change (r, c, from_state, to_state).
        :returns None:
        """
        if self.pointer < len(self.changes):
            self.changes = self.changes[:self.pointer]
        self.changes.append(change)
        self.pointer += 1

    def get_current_grid(self):
        """
        Builds and returns the grid state at the current history pointer.

        It starts with the initial state and applies all changes sequentially
        up to the current pointer position.

        :returns list[list[int]]: A deep copy of the grid at the current state.
        """
        grid = copy.deepcopy(self.initial_state)
        for i in range(self.pointer):
            r, c, _, to_state = self.changes[i]
            grid[r][c] = to_state
        return grid

    def undo(self):
        """
        Moves the history pointer back by one step, if possible.

        :returns list[list[int]]: The grid state after the undo operation.
        """
        if self.can_undo():
            self.pointer -= 1
        return self.get_current_grid()

    def redo(self):
        """
        Moves the history pointer forward by one step, if possible.

        :returns list[list[int]]: The grid state after the redo operation.
        """
        if self.can_redo():
            self.pointer += 1
        return self.get_current_grid()

    def can_undo(self):
        """
        Checks if an undo operation is possible.

        :returns bool: True if the pointer is not at the beginning of the history.
        """
        return self.pointer > 0

    def can_redo(self):
        """
        Checks if a redo operation is possible.

        :returns bool: True if the pointer is not at the end of the changes list.
        """
        return self.pointer < len(self.changes)

    def reset(self, initial_state):
        """
        Resets the history manager to a new initial state, clearing all changes.

        :param list[list[int]] initial_state: The new starting grid configuration.
        :returns None:
        """
        self.initial_state = copy.deepcopy(initial_state)
        self.changes = []
        self.pointer = 0

    def serialize(self):
        """
        Serializes the entire history (changes and pointer) into a compact string.

        The format is "h:<changes_string>:<pointer_char>". Each change is encoded
        as a 4-character string using the SBN base64 alphabet.

        :returns str: The serialized history string, or an empty string if no changes exist.
        """
        if not self.changes: return ""
        change_strings = [f"{SBN_INT_TO_CHAR[r]}{SBN_INT_TO_CHAR[c]}{SBN_INT_TO_CHAR[f]}{SBN_INT_TO_CHAR[t]}" for r, c, f, t in self.changes]
        pointer_char = SBN_INT_TO_CHAR.get(self.pointer, '0')
        return f"h:{''.join(change_strings)}:{pointer_char}"

    @classmethod
    def deserialize(cls, initial_state, history_string):
        """
        Creates a HistoryManager instance from a serialized string.

        This class method parses the history string, reconstructs the list of
        changes, sets the pointer, and returns a new HistoryManager instance.

        :param list[list[int]] initial_state: The initial grid state to apply changes to.
        :param str history_string: The serialized history string to parse.
        :returns HistoryManager: A new instance populated with the deserialized data.
        """
        manager = cls(initial_state)
        try:
            parts = history_string.split(':')
            if len(parts) != 3 or parts[0] != 'h':
                return manager # Return a clean manager if format is wrong
            change_data, pointer_data = parts[1], parts[2]
            if change_data:
                for i in range(0, len(change_data), 4):
                    s = change_data[i:i+4]
                    if len(s) == 4:
                        r, c, from_s, to_s = (SBN_CHAR_TO_INT[s[0]], SBN_CHAR_TO_INT[s[1]],
                                              SBN_CHAR_TO_INT[s[2]], SBN_CHAR_TO_INT[s[3]])
                        manager.changes.append((r, c, from_s, to_s))
            manager.pointer = SBN_CHAR_TO_INT.get(pointer_data, 0)
        except (KeyError, IndexError, ValueError):
            # In case of corrupted data, return a fresh manager
            return cls(initial_state)
        return manager

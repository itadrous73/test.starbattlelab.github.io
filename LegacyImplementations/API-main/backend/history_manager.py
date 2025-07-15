"""**********************************************************************************
 * Title: history_manager.py
 *
 * @author Joseph Bryant
 * @refactored by Isaiah Tadrous
 * @version 2.0.1
 * -------------------------------------------------------------------------------
 * Description:
 * This file defines the HistoryManager class, which is responsible for managing
 * the state changes of the puzzle grid. It provides a robust undo/redo
 * functionality by tracking a list of changes applied to an initial state.
 * The class can reconstruct the grid at any point in its history and includes
 * methods to serialize the entire history into a compact string format and
 * deserialize it back into a manager instance, allowing for easy saving and
 * loading of game progress.
 **********************************************************************************"""

# --- IMPORTS ---
import copy
from backend.constants import SBN_CHAR_TO_INT, SBN_INT_TO_CHAR

# --- CLASS DEFINITION ---
class HistoryManager:
    """Manages the history of changes for undo/redo functionality."""
    def __init__(self, initial_state):
        """
        Initializes the HistoryManager with a starting grid state.

        :param list[list[int]] initial_state: The initial 2D grid of the puzzle.
        """
        self.initial_state = copy.deepcopy(initial_state)
        self.changes = []
        self.pointer = 0

    def add_change(self, change):
        """
        Adds a new change to the history.

        If a change is added after an undo operation, it truncates the
        "redo" history before appending the new change.

        :param dict change: A dictionary representing the change, e.g.,
                            {'r': row, 'c': col, 'from': old_state, 'to': new_state}.
        """
        if self.pointer < len(self.changes):
            self.changes = self.changes[:self.pointer]
        self.changes.append(change)
        self.pointer += 1

    def get_current_grid(self):
        """
        Reconstructs and returns the current grid based on the history.

        It starts with the initial state and applies all changes up to the
        current history pointer.

        :returns: The reconstructed 2D grid.
        :rtype: list[list[int]]
        """
        grid = copy.deepcopy(self.initial_state)
        for i in range(self.pointer):
            # This needs to access object properties if the format is a list of dicts
            change = self.changes[i]
            
            # --- BEFORE (This is incorrect and will crash) ---
            # r, c, _, to_state = change['r'], change['c'], change['from'], change['to']
            
            # --- AFTER (Corrected logic) ---
            r = change['r']
            c = change['c']
            to_state = change['to']
            
            grid[r][c] = to_state
        return grid

    def undo(self):
        """Moves the history pointer back one step if possible."""
        if self.can_undo(): self.pointer -= 1

    def redo(self):
        """Moves the history pointer forward one step if possible."""
        if self.can_redo(): self.pointer += 1

    def can_undo(self):
        """
        Checks if an undo operation can be performed.

        :returns: True if there are changes to undo, False otherwise.
        :rtype: bool
        """
        return self.pointer > 0

    def can_redo(self):
        """
        Checks if a redo operation can be performed.

        :returns: True if there are changes to redo, False otherwise.
        :rtype: bool
        """
        return self.pointer < len(self.changes)

    def reset(self, initial_state):
        """
        Resets the history manager to a new initial state.

        :param list[list[int]] initial_state: The new initial 2D grid.
        """
        self.initial_state, self.changes, self.pointer = copy.deepcopy(initial_state), [], 0

    def serialize(self):
        """
        Serializes the history of changes into a compact string format.

        The format is 'h:<changes_string>:<pointer_char>', where each change
        is encoded into a 4-character string representing (r, c, from, to).

        :returns: The serialized history string, or an empty string if no changes.
        :rtype: str
        """
        if not self.changes: return ""
        # Correctly serialize from a list of dictionaries
        changes = [
            f"{SBN_INT_TO_CHAR.get(c['r'], '0')}{SBN_INT_TO_CHAR.get(c['c'], '0')}"
            f"{SBN_INT_TO_CHAR.get(c['from'], '0')}{SBN_INT_TO_CHAR.get(c['to'], '0')}"
            for c in self.changes
        ]
        pointer = SBN_INT_TO_CHAR.get(self.pointer, '0')
        return f"h:{''.join(changes)}:{pointer}"
        
    @classmethod
    def deserialize(cls, initial_state, history_string):
        """
        Creates a HistoryManager instance from a serialized history string.

        It parses the string to reconstruct the list of changes and set the
        history pointer. Returns a fresh manager if the string is invalid.

        :param list[list[int]] initial_state: The initial grid state for the puzzle.
        :param str history_string: The serialized history string to parse.
        :returns: A new HistoryManager instance populated with the deserialized data.
        :rtype: HistoryManager
        """
        manager = cls(initial_state)
        try:
            # Check if history_string is valid and has the correct format
            if not history_string or not history_string.startswith('h:'):
                return manager
                
            _, change_data, pointer_data = history_string.split(':')
            if change_data:
                for i in range(0, len(change_data), 4):
                    s = change_data[i:i+4]
                    if len(s) == 4:
                        # FIXED: Create a dictionary instead of a tuple to match the frontend
                        change = {
                            'r': SBN_CHAR_TO_INT.get(s[0]),
                            'c': SBN_CHAR_TO_INT.get(s[1]),
                            'from': SBN_CHAR_TO_INT.get(s[2]),
                            'to': SBN_CHAR_TO_INT.get(s[3]),
                        }
                        manager.changes.append(change)

            manager.pointer = SBN_CHAR_TO_INT.get(pointer_data, 0)
        except (KeyError, IndexError, ValueError) as e:
            print(f"Error deserializing history: {e}")
            return cls(initial_state) # Return a fresh manager on error
        return manager

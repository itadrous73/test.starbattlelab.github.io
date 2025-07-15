/**
 **********************************************************************************
 *
 * Star Battle Puzzle - Player History Manager
 *
 * @author Isaiah Tadrous
 * @version 1.0.0
 *
 * -------------------------------------------------------------------------------
 *
 * Description:
 * This module provides a lightweight history tracking system for Star Battle puzzles,
 * enabling undo/redo functionality and state serialization. Each change is stored as
 * a 4-part entry (row, column, fromState, toState), which is encoded using SBN-safe
 * characters for compact storage and transmission.
 *
 * It supports:
 *   - Tracking incremental player actions
 *   - Serializing history state into a compact SBN string
 *   - Deserializing back into a usable in-memory history stack
 *
 * Used for client-side puzzle interaction and browser save states.
 *
 * Logic referenced from a Python implementation developed by Joseph Bryant.
 *
 **********************************************************************************
 */


import { SBN_CHAR_TO_INT, SBN_INT_TO_CHAR } from './constants.js';

export class HistoryManager {
    constructor(initialState) {
        this.initialState = JSON.parse(JSON.stringify(initialState)); // Deep copy
        this.changes = [];
        this.pointer = 0;
    }

    addChange(change) {
        if (this.pointer < this.changes.length) {
            this.changes = this.changes.slice(0, this.pointer);
        }
        this.changes.push(change);
        this.pointer++;
    }

    serialize() {
        if (this.changes.length === 0) return "";
        const changesStr = this.changes.map(c =>
            `${SBN_INT_TO_CHAR[c.r]}${SBN_INT_TO_CHAR[c.c]}${SBN_INT_TO_CHAR[c.from]}${SBN_INT_TO_CHAR[c.to]}`
        ).join('');
        const pointerChar = SBN_INT_TO_CHAR[this.pointer];
        return `h:${changesStr}:${pointerChar}`;
    }

    static deserialize(initialState, historyString) {
        const manager = new HistoryManager(initialState);
        if (!historyString || !historyString.startsWith('h:')) {
            return manager;
        }
        try {
            const [, changeData, pointerData] = historyString.split(':');
            if (changeData) {
                for (let i = 0; i < changeData.length; i += 4) {
                    const s = changeData.substring(i, i + 4);
                    if (s.length === 4) {
                        manager.changes.push({
                            r: SBN_CHAR_TO_INT[s[0]],
                            c: SBN_CHAR_TO_INT[s[1]],
                            from: SBN_CHAR_TO_INT[s[2]],
                            to: SBN_CHAR_TO_INT[s[3]],
                        });
                    }
                }
            }
            manager.pointer = SBN_CHAR_TO_INT[pointerData] || 0;
        } catch (e) {
            console.error(`Error deserializing history: ${e}`);
            return new HistoryManager(initialState);
        }
        return manager;
    }
}
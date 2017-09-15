'use strict';

var Feature = require('./Feature');
var CellEditor = require('../cellEditors/CellEditor');

var KEYS = {
    RETURN: 'RETURN',
    RETURNSHIFT: 'RETURNSHIFT',
    DELETE: 'DELETE',
    BACKSPACE: 'BACKSPACE',
    SPACE: 'SPACE',
    F2: 'F2'
};

/**
 * @constructor
 * @extends Feature
 */
var CellEditing = Feature.extend('CellEditing', {

    /**
     * @memberOf CellEditing.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleDoubleClick: function(grid, event) {
        if (
            grid.properties.editOnDoubleClick &&
            event.isDataCell
        ) {
            grid.onEditorActivate(event);
        } else if (this.next) {
            this.next.handleDoubleClick(grid, event);
        }
    },

    handleClick: function(grid, event) {
        if (
            !grid.properties.editOnDoubleClick &&
            event.isDataCell
        ) {
            grid.onEditorActivate(event);
        } else if (this.next) {
            this.next.handleClick(grid, event);
        }
    },

    /**
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     * @memberOf KeyPaging.prototype
     */
    handleKeyDown: function(grid, event) {
        var char = event.detail.char,
            cellEvent = grid.getGridCellFromLastSelection(),
            props = (cellEvent && cellEvent.properties) || {},
            isEditable = props.editOnKeydown && !grid.cellEditor,
            isVisibleChar = char.length === 1 && !(event.detail.meta || event.detail.ctrl),
            isSpaceChar = char === KEYS.SPACE,
            isDeleteChar = char === KEYS.DELETE || char === KEYS.BACKSPACE,
            isEditChar = char === KEYS.F2,
            isReturnChar = char === KEYS.RETURN || char === KEYS.RETURNSHIFT,
            isValidChar = isVisibleChar || isSpaceChar || isDeleteChar || isEditChar || isReturnChar,
            editor,
            value;

        if (isEditable && isValidChar) {
            editor = grid.onEditorActivate(cellEvent);

            if (editor instanceof CellEditor) {
                if (isSpaceChar || isVisibleChar) {
                    value = editor.getEditorValue();
                    value += isSpaceChar ? ' ' : char;
                    editor.setEditorValue(value);

                    if (props.selectAllOnEditorFocus) {
                        editor.selectAll();
                    } else {
                        editor.moveCaretToEnd();
                    }

                } else if (isDeleteChar) {
                    editor.setEditorValue('');

                    // quick cell content delete (if not errors were found)
                    if (props.deleteWithoutEditor && !editor.validate()) {
                        editor.stopEditing();
                        grid.canvas.takeFocus();
                        grid.repaint();
                    }
                }

                editor.setWasOpenedByReturnKey(isReturnChar);
                event.detail.primitiveEvent.preventDefault();
            }
        } else if (this.next) {
            this.next.handleKeyDown(grid, event);
        }
    }

});

module.exports = CellEditing;

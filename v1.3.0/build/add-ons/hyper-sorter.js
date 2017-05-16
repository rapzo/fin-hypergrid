(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* eslint-env browser */

'use strict';

var Column = window.fin.Hypergrid.behaviors.Column; // try require('fin-hypergrid/src/behaviors/Column') when externalized

function Hypersorter(grid, targets) {
    this.grid = grid;

    this.install(targets);

    this.sorts = [];

    grid.behavior.dataModel.charMap.mixIn({
        ASC: '\u25b2', // UPWARDS_BLACK_ARROW, aka '▲'
        DESC: '\u25bc' // DOWNWARDS_BLACK_ARROW, aka '▼'
    });

    grid.addInternalEventListener('fin-column-sort', function(c, keys){
        grid.toggleSort(c, keys);
    });
}

Hypersorter.prototype.name = 'Hypersorter';

Hypersorter.prototype.install = function(targets) {
    var Hypergrid = this.grid.constructor;
    Hypergrid.defaults.mixIn(require('./mix-ins/defaults'));
    Hypergrid.prototype.mixIn(require('./mix-ins/grid'));
    targets = targets || {};
    (targets.Behavior && targets.Behavior.prototype || Object.getPrototypeOf(this.grid.behavior)).mixIn(require('./mix-ins/behavior'));
    (targets.Column || Column).prototype.mixIn(require('./mix-ins/column'));
    (targets.DataModel && targets.DataModel.prototype || Object.getPrototypeOf(this.grid.behavior.dataModel)).mixIn(require('./mix-ins/dataModel'));
};

/** @typedef {object} sortSpecInterface
 * @property {number} columnIndex
 * @property {number} direction
 * @property {string} [type]
 */

/**
 * @implements dataControlInterface#properties
 * @desc See {@link sortSpecInterface} for available sort properties.
 * @memberOf Hypersorter.prototype
 */
Hypersorter.prototype.properties = function(properties) {
    var result, value,
        columnSort = this.grid.behavior.dataModel.getColumnSortState(properties.COLUMN.index);

    if (columnSort) {
        if (properties.GETTER) {
            result = columnSort[properties.GETTER];
            if (result === undefined) {
                result = null;
            }
        } else {
            for (var key in properties) {
                value = properties[key];
                columnSort[key] = typeof value === 'function' ? value() : value;
            }
        }
    }

    return result;
};

window.fin.Hypergrid.Hypersorter = Hypersorter;

},{"./mix-ins/behavior":2,"./mix-ins/column":3,"./mix-ins/dataModel":4,"./mix-ins/defaults":5,"./mix-ins/grid":6}],2:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @summary The behaviors's sorter data controller.
     * @desc This getter/setter is syntactic sugar for calls to `getController` and `setController`.
     * @memberOf Behavior#
     */
    get sorter() {
        return this.getController('sorter');
    },
    set sorter(sorter) {
        this.setController('sorter', sorter);
    },

    /**
     * @memberOf Behavior.prototype
     * @param {number} c - grid column index.
     * @param {string[]} keys
     */
    toggleSort: function(c, keys) {
        var column = this.getActiveColumn(c);
        if (column) {
            column.toggleSort(keys);
        }
    },
    sortChanged: function(hiddenColumns){
        if (removeHiddenColumns(
                this.sorter.sorts,
                hiddenColumns || this.getHiddenColumns()
        )) {
            this.reindex();
        }
    }

};
//Logic to moved to adapter layer outside of Hypergrid Core
function removeHiddenColumns(oldSorted, hiddenColumns){
    var dirty = false;
    oldSorted.forEach(function(i) {
        var j = 0,
            colIndex;
        while (j < hiddenColumns.length) {
            colIndex = hiddenColumns[j].index + 1; //hack to get around 0 index
            if (colIndex === i) {
                hiddenColumns[j].unSort();
                dirty = true;
                break;
            }
            j++;
        }
    });
    return dirty;
}

},{}],3:[function(require,module,exports){
'use strict';

module.exports = {
    toggleSort: function(keys) {
        this.dataModel.toggleSort(this, keys);
    },

    unSort: function(deferred) {
        this.dataModel.unSortColumn(this, deferred);
    }
};

},{}],4:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @summary The behaviors's sorter data controller.
     * @desc This getter/setter is syntactic sugar for calls to `getController` and `setController`.
     * @param {dataControlInterface|undefined|null} sorter
     * @memberOf Behavior#
     */
    get sorter() {
        return this.getController('sorter');
    },
    set sorter(sorter) {
        this.setController('sorter', sorter);
    },

    /**
     * @memberOf dataModels.JSON.prototype
     * @param column
     * @param keys
     */
    toggleSort: function(column, keys) {
        this.incrementSortState(column, keys);
        this.serializeSortState();
        this.reindex();
    },
    /**
     * @memberOf dataModels.JSON.prototype
     * @param column
     * @param {boolean} deferred
     */
    unSortColumn: function(column, deferred) {
        var sortSpec = this.getColumnSortState(column.index);

        if (sortSpec) {
            this.sorter.sorts.splice(sortSpec.rank, 1); //Removed from sorts
            if (!deferred) {
                this.reindex();
            }
        }

        this.serializeSortState();
    },

    /**
     * @param {number} columnIndex
     * @returns {sortSpecInterface}
     */
    getColumnSortState: function(columnIndex){
        var rank,
            sort = this.sorter.sorts.find(function(sort, index) {
                rank = index;
                return sort.columnIndex === columnIndex;
            });

        return sort && { sort: sort, rank: rank };
    },

    /**
     * @memberOf dataModels.JSON.prototype
     * @param column
     * @param {string[]} keys
     * @return {object[]} sorts
     */
    incrementSortState: function(column, keys) {
        var sorts = this.sorter.sorts,
            columnIndex = column.index,
            columnSchema = this.schema[columnIndex],
            sortSpec = this.getColumnSortState(columnIndex);

        if (!sortSpec) { // was unsorted
            if (keys.indexOf('CTRL') < 0) {
                sorts.length = 0;
            }
            sorts.unshift({
                columnIndex: columnIndex, // so define and...
                direction: 1, // ...make ascending
                type: columnSchema.type
            });
        } else if (sortSpec.sort.direction > 0) { // was ascending
            sortSpec.sort.direction = -1; // so make descending
        } else { // was descending
            this.unSortColumn(column, true); // so make unsorted
        }

        //Minor improvement, but this check can happen earlier and terminate earlier
        sorts.length = Math.min(sorts.length, this.grid.properties.maxSortColumns);
    },

    serializeSortState: function(){
        this.grid.properties.sorts = this.sorter.sorts;
    },

    /**
     * @memberOf dataModels.JSON.prototype
     * @param index
     * @param returnAsString
     * @desc Provides the unicode character used to denote visually if a column is a sorted state
     * @returns {*}
     */
    getSortImageForColumn: function(columnIndex) {
        var sorts = this.sorter.sorts,
            sortSpec = this.getColumnSortState(columnIndex),
            result, rank;

        if (sortSpec) {
            var directionKey = sortSpec.sort.direction > 0 ? 'ASC' : 'DESC',
                arrow = this.charMap[directionKey];

            result = arrow + ' ';

            if (sorts.length > 1) {
                rank = sorts.length - sortSpec.rank;
                result = rank + result;
            }
        }

        return result;
    }
};

},{}],5:[function(require,module,exports){
'use strict';

exports.maxSortColumns = 3;

},{}],6:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @summary The behaviors's sorter data controller.
     * @desc This getter/setter is syntactic sugar for calls to `getController` and `setController`.
     * @memberOf Hypergrid#
     */
    get sorter() {
        return this.getController('sorter');
    },
    set sorter(sorter) {
        this.setController('sorter', sorter);
    },

    /**
     * @memberOf Hypergrid#
     * @param event
     */
    toggleSort: function(event) {
        if (!this.abortEditing()) { return; }

        var behavior = this.behavior,
            self = this,
            c = event.detail.column,
            keys =  event.detail.keys;

        behavior.toggleSort(c, keys);

        setTimeout(function() {
            self.synchronizeScrollingBoundaries();
            behavior.autosizeAllColumns();
            self.repaint();
        }, 10);
    }

};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1zb3J0ZXIvZmFrZV9jYTU5ZmMyYy5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1zb3J0ZXIvbWl4LWlucy9iZWhhdmlvci5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1zb3J0ZXIvbWl4LWlucy9jb2x1bW4uanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvdGVtcC9maW4taHlwZXJncmlkL2FkZC1vbnMvaHlwZXItc29ydGVyL21peC1pbnMvZGF0YU1vZGVsLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL3RlbXAvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2h5cGVyLXNvcnRlci9taXgtaW5zL2RlZmF1bHRzLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL3RlbXAvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2h5cGVyLXNvcnRlci9taXgtaW5zL2dyaWQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pIQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyogZXNsaW50LWVudiBicm93c2VyICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIENvbHVtbiA9IHdpbmRvdy5maW4uSHlwZXJncmlkLmJlaGF2aW9ycy5Db2x1bW47IC8vIHRyeSByZXF1aXJlKCdmaW4taHlwZXJncmlkL3NyYy9iZWhhdmlvcnMvQ29sdW1uJykgd2hlbiBleHRlcm5hbGl6ZWRcblxuZnVuY3Rpb24gSHlwZXJzb3J0ZXIoZ3JpZCwgdGFyZ2V0cykge1xuICAgIHRoaXMuZ3JpZCA9IGdyaWQ7XG5cbiAgICB0aGlzLmluc3RhbGwodGFyZ2V0cyk7XG5cbiAgICB0aGlzLnNvcnRzID0gW107XG5cbiAgICBncmlkLmJlaGF2aW9yLmRhdGFNb2RlbC5jaGFyTWFwLm1peEluKHtcbiAgICAgICAgQVNDOiAnXFx1MjViMicsIC8vIFVQV0FSRFNfQkxBQ0tfQVJST1csIGFrYSAn4payJ1xuICAgICAgICBERVNDOiAnXFx1MjViYycgLy8gRE9XTldBUkRTX0JMQUNLX0FSUk9XLCBha2EgJ+KWvCdcbiAgICB9KTtcblxuICAgIGdyaWQuYWRkSW50ZXJuYWxFdmVudExpc3RlbmVyKCdmaW4tY29sdW1uLXNvcnQnLCBmdW5jdGlvbihjLCBrZXlzKXtcbiAgICAgICAgZ3JpZC50b2dnbGVTb3J0KGMsIGtleXMpO1xuICAgIH0pO1xufVxuXG5IeXBlcnNvcnRlci5wcm90b3R5cGUubmFtZSA9ICdIeXBlcnNvcnRlcic7XG5cbkh5cGVyc29ydGVyLnByb3RvdHlwZS5pbnN0YWxsID0gZnVuY3Rpb24odGFyZ2V0cykge1xuICAgIHZhciBIeXBlcmdyaWQgPSB0aGlzLmdyaWQuY29uc3RydWN0b3I7XG4gICAgSHlwZXJncmlkLmRlZmF1bHRzLm1peEluKHJlcXVpcmUoJy4vbWl4LWlucy9kZWZhdWx0cycpKTtcbiAgICBIeXBlcmdyaWQucHJvdG90eXBlLm1peEluKHJlcXVpcmUoJy4vbWl4LWlucy9ncmlkJykpO1xuICAgIHRhcmdldHMgPSB0YXJnZXRzIHx8IHt9O1xuICAgICh0YXJnZXRzLkJlaGF2aW9yICYmIHRhcmdldHMuQmVoYXZpb3IucHJvdG90eXBlIHx8IE9iamVjdC5nZXRQcm90b3R5cGVPZih0aGlzLmdyaWQuYmVoYXZpb3IpKS5taXhJbihyZXF1aXJlKCcuL21peC1pbnMvYmVoYXZpb3InKSk7XG4gICAgKHRhcmdldHMuQ29sdW1uIHx8IENvbHVtbikucHJvdG90eXBlLm1peEluKHJlcXVpcmUoJy4vbWl4LWlucy9jb2x1bW4nKSk7XG4gICAgKHRhcmdldHMuRGF0YU1vZGVsICYmIHRhcmdldHMuRGF0YU1vZGVsLnByb3RvdHlwZSB8fCBPYmplY3QuZ2V0UHJvdG90eXBlT2YodGhpcy5ncmlkLmJlaGF2aW9yLmRhdGFNb2RlbCkpLm1peEluKHJlcXVpcmUoJy4vbWl4LWlucy9kYXRhTW9kZWwnKSk7XG59O1xuXG4vKiogQHR5cGVkZWYge29iamVjdH0gc29ydFNwZWNJbnRlcmZhY2VcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjb2x1bW5JbmRleFxuICogQHByb3BlcnR5IHtudW1iZXJ9IGRpcmVjdGlvblxuICogQHByb3BlcnR5IHtzdHJpbmd9IFt0eXBlXVxuICovXG5cbi8qKlxuICogQGltcGxlbWVudHMgZGF0YUNvbnRyb2xJbnRlcmZhY2UjcHJvcGVydGllc1xuICogQGRlc2MgU2VlIHtAbGluayBzb3J0U3BlY0ludGVyZmFjZX0gZm9yIGF2YWlsYWJsZSBzb3J0IHByb3BlcnRpZXMuXG4gKiBAbWVtYmVyT2YgSHlwZXJzb3J0ZXIucHJvdG90eXBlXG4gKi9cbkh5cGVyc29ydGVyLnByb3RvdHlwZS5wcm9wZXJ0aWVzID0gZnVuY3Rpb24ocHJvcGVydGllcykge1xuICAgIHZhciByZXN1bHQsIHZhbHVlLFxuICAgICAgICBjb2x1bW5Tb3J0ID0gdGhpcy5ncmlkLmJlaGF2aW9yLmRhdGFNb2RlbC5nZXRDb2x1bW5Tb3J0U3RhdGUocHJvcGVydGllcy5DT0xVTU4uaW5kZXgpO1xuXG4gICAgaWYgKGNvbHVtblNvcnQpIHtcbiAgICAgICAgaWYgKHByb3BlcnRpZXMuR0VUVEVSKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBjb2x1bW5Tb3J0W3Byb3BlcnRpZXMuR0VUVEVSXTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gcHJvcGVydGllcykge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gcHJvcGVydGllc1trZXldO1xuICAgICAgICAgICAgICAgIGNvbHVtblNvcnRba2V5XSA9IHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyA/IHZhbHVlKCkgOiB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh5cGVyc29ydGVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IFRoZSBiZWhhdmlvcnMncyBzb3J0ZXIgZGF0YSBjb250cm9sbGVyLlxuICAgICAqIEBkZXNjIFRoaXMgZ2V0dGVyL3NldHRlciBpcyBzeW50YWN0aWMgc3VnYXIgZm9yIGNhbGxzIHRvIGBnZXRDb250cm9sbGVyYCBhbmQgYHNldENvbnRyb2xsZXJgLlxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvciNcbiAgICAgKi9cbiAgICBnZXQgc29ydGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRDb250cm9sbGVyKCdzb3J0ZXInKTtcbiAgICB9LFxuICAgIHNldCBzb3J0ZXIoc29ydGVyKSB7XG4gICAgICAgIHRoaXMuc2V0Q29udHJvbGxlcignc29ydGVyJywgc29ydGVyKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yLnByb3RvdHlwZVxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjIC0gZ3JpZCBjb2x1bW4gaW5kZXguXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0ga2V5c1xuICAgICAqL1xuICAgIHRvZ2dsZVNvcnQ6IGZ1bmN0aW9uKGMsIGtleXMpIHtcbiAgICAgICAgdmFyIGNvbHVtbiA9IHRoaXMuZ2V0QWN0aXZlQ29sdW1uKGMpO1xuICAgICAgICBpZiAoY29sdW1uKSB7XG4gICAgICAgICAgICBjb2x1bW4udG9nZ2xlU29ydChrZXlzKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc29ydENoYW5nZWQ6IGZ1bmN0aW9uKGhpZGRlbkNvbHVtbnMpe1xuICAgICAgICBpZiAocmVtb3ZlSGlkZGVuQ29sdW1ucyhcbiAgICAgICAgICAgICAgICB0aGlzLnNvcnRlci5zb3J0cyxcbiAgICAgICAgICAgICAgICBoaWRkZW5Db2x1bW5zIHx8IHRoaXMuZ2V0SGlkZGVuQ29sdW1ucygpXG4gICAgICAgICkpIHtcbiAgICAgICAgICAgIHRoaXMucmVpbmRleCgpO1xuICAgICAgICB9XG4gICAgfVxuXG59O1xuLy9Mb2dpYyB0byBtb3ZlZCB0byBhZGFwdGVyIGxheWVyIG91dHNpZGUgb2YgSHlwZXJncmlkIENvcmVcbmZ1bmN0aW9uIHJlbW92ZUhpZGRlbkNvbHVtbnMob2xkU29ydGVkLCBoaWRkZW5Db2x1bW5zKXtcbiAgICB2YXIgZGlydHkgPSBmYWxzZTtcbiAgICBvbGRTb3J0ZWQuZm9yRWFjaChmdW5jdGlvbihpKSB7XG4gICAgICAgIHZhciBqID0gMCxcbiAgICAgICAgICAgIGNvbEluZGV4O1xuICAgICAgICB3aGlsZSAoaiA8IGhpZGRlbkNvbHVtbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb2xJbmRleCA9IGhpZGRlbkNvbHVtbnNbal0uaW5kZXggKyAxOyAvL2hhY2sgdG8gZ2V0IGFyb3VuZCAwIGluZGV4XG4gICAgICAgICAgICBpZiAoY29sSW5kZXggPT09IGkpIHtcbiAgICAgICAgICAgICAgICBoaWRkZW5Db2x1bW5zW2pdLnVuU29ydCgpO1xuICAgICAgICAgICAgICAgIGRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGorKztcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBkaXJ0eTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgdG9nZ2xlU29ydDogZnVuY3Rpb24oa2V5cykge1xuICAgICAgICB0aGlzLmRhdGFNb2RlbC50b2dnbGVTb3J0KHRoaXMsIGtleXMpO1xuICAgIH0sXG5cbiAgICB1blNvcnQ6IGZ1bmN0aW9uKGRlZmVycmVkKSB7XG4gICAgICAgIHRoaXMuZGF0YU1vZGVsLnVuU29ydENvbHVtbih0aGlzLCBkZWZlcnJlZCk7XG4gICAgfVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBUaGUgYmVoYXZpb3JzJ3Mgc29ydGVyIGRhdGEgY29udHJvbGxlci5cbiAgICAgKiBAZGVzYyBUaGlzIGdldHRlci9zZXR0ZXIgaXMgc3ludGFjdGljIHN1Z2FyIGZvciBjYWxscyB0byBgZ2V0Q29udHJvbGxlcmAgYW5kIGBzZXRDb250cm9sbGVyYC5cbiAgICAgKiBAcGFyYW0ge2RhdGFDb250cm9sSW50ZXJmYWNlfHVuZGVmaW5lZHxudWxsfSBzb3J0ZXJcbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IjXG4gICAgICovXG4gICAgZ2V0IHNvcnRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0Q29udHJvbGxlcignc29ydGVyJyk7XG4gICAgfSxcbiAgICBzZXQgc29ydGVyKHNvcnRlcikge1xuICAgICAgICB0aGlzLnNldENvbnRyb2xsZXIoJ3NvcnRlcicsIHNvcnRlcik7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJPZiBkYXRhTW9kZWxzLkpTT04ucHJvdG90eXBlXG4gICAgICogQHBhcmFtIGNvbHVtblxuICAgICAqIEBwYXJhbSBrZXlzXG4gICAgICovXG4gICAgdG9nZ2xlU29ydDogZnVuY3Rpb24oY29sdW1uLCBrZXlzKSB7XG4gICAgICAgIHRoaXMuaW5jcmVtZW50U29ydFN0YXRlKGNvbHVtbiwga2V5cyk7XG4gICAgICAgIHRoaXMuc2VyaWFsaXplU29ydFN0YXRlKCk7XG4gICAgICAgIHRoaXMucmVpbmRleCgpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIGRhdGFNb2RlbHMuSlNPTi5wcm90b3R5cGVcbiAgICAgKiBAcGFyYW0gY29sdW1uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBkZWZlcnJlZFxuICAgICAqL1xuICAgIHVuU29ydENvbHVtbjogZnVuY3Rpb24oY29sdW1uLCBkZWZlcnJlZCkge1xuICAgICAgICB2YXIgc29ydFNwZWMgPSB0aGlzLmdldENvbHVtblNvcnRTdGF0ZShjb2x1bW4uaW5kZXgpO1xuXG4gICAgICAgIGlmIChzb3J0U3BlYykge1xuICAgICAgICAgICAgdGhpcy5zb3J0ZXIuc29ydHMuc3BsaWNlKHNvcnRTcGVjLnJhbmssIDEpOyAvL1JlbW92ZWQgZnJvbSBzb3J0c1xuICAgICAgICAgICAgaWYgKCFkZWZlcnJlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVpbmRleCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXJpYWxpemVTb3J0U3RhdGUoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNvbHVtbkluZGV4XG4gICAgICogQHJldHVybnMge3NvcnRTcGVjSW50ZXJmYWNlfVxuICAgICAqL1xuICAgIGdldENvbHVtblNvcnRTdGF0ZTogZnVuY3Rpb24oY29sdW1uSW5kZXgpe1xuICAgICAgICB2YXIgcmFuayxcbiAgICAgICAgICAgIHNvcnQgPSB0aGlzLnNvcnRlci5zb3J0cy5maW5kKGZ1bmN0aW9uKHNvcnQsIGluZGV4KSB7XG4gICAgICAgICAgICAgICAgcmFuayA9IGluZGV4O1xuICAgICAgICAgICAgICAgIHJldHVybiBzb3J0LmNvbHVtbkluZGV4ID09PSBjb2x1bW5JbmRleDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBzb3J0ICYmIHsgc29ydDogc29ydCwgcmFuazogcmFuayB9O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyT2YgZGF0YU1vZGVscy5KU09OLnByb3RvdHlwZVxuICAgICAqIEBwYXJhbSBjb2x1bW5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBrZXlzXG4gICAgICogQHJldHVybiB7b2JqZWN0W119IHNvcnRzXG4gICAgICovXG4gICAgaW5jcmVtZW50U29ydFN0YXRlOiBmdW5jdGlvbihjb2x1bW4sIGtleXMpIHtcbiAgICAgICAgdmFyIHNvcnRzID0gdGhpcy5zb3J0ZXIuc29ydHMsXG4gICAgICAgICAgICBjb2x1bW5JbmRleCA9IGNvbHVtbi5pbmRleCxcbiAgICAgICAgICAgIGNvbHVtblNjaGVtYSA9IHRoaXMuc2NoZW1hW2NvbHVtbkluZGV4XSxcbiAgICAgICAgICAgIHNvcnRTcGVjID0gdGhpcy5nZXRDb2x1bW5Tb3J0U3RhdGUoY29sdW1uSW5kZXgpO1xuXG4gICAgICAgIGlmICghc29ydFNwZWMpIHsgLy8gd2FzIHVuc29ydGVkXG4gICAgICAgICAgICBpZiAoa2V5cy5pbmRleE9mKCdDVFJMJykgPCAwKSB7XG4gICAgICAgICAgICAgICAgc29ydHMubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNvcnRzLnVuc2hpZnQoe1xuICAgICAgICAgICAgICAgIGNvbHVtbkluZGV4OiBjb2x1bW5JbmRleCwgLy8gc28gZGVmaW5lIGFuZC4uLlxuICAgICAgICAgICAgICAgIGRpcmVjdGlvbjogMSwgLy8gLi4ubWFrZSBhc2NlbmRpbmdcbiAgICAgICAgICAgICAgICB0eXBlOiBjb2x1bW5TY2hlbWEudHlwZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoc29ydFNwZWMuc29ydC5kaXJlY3Rpb24gPiAwKSB7IC8vIHdhcyBhc2NlbmRpbmdcbiAgICAgICAgICAgIHNvcnRTcGVjLnNvcnQuZGlyZWN0aW9uID0gLTE7IC8vIHNvIG1ha2UgZGVzY2VuZGluZ1xuICAgICAgICB9IGVsc2UgeyAvLyB3YXMgZGVzY2VuZGluZ1xuICAgICAgICAgICAgdGhpcy51blNvcnRDb2x1bW4oY29sdW1uLCB0cnVlKTsgLy8gc28gbWFrZSB1bnNvcnRlZFxuICAgICAgICB9XG5cbiAgICAgICAgLy9NaW5vciBpbXByb3ZlbWVudCwgYnV0IHRoaXMgY2hlY2sgY2FuIGhhcHBlbiBlYXJsaWVyIGFuZCB0ZXJtaW5hdGUgZWFybGllclxuICAgICAgICBzb3J0cy5sZW5ndGggPSBNYXRoLm1pbihzb3J0cy5sZW5ndGgsIHRoaXMuZ3JpZC5wcm9wZXJ0aWVzLm1heFNvcnRDb2x1bW5zKTtcbiAgICB9LFxuXG4gICAgc2VyaWFsaXplU29ydFN0YXRlOiBmdW5jdGlvbigpe1xuICAgICAgICB0aGlzLmdyaWQucHJvcGVydGllcy5zb3J0cyA9IHRoaXMuc29ydGVyLnNvcnRzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyT2YgZGF0YU1vZGVscy5KU09OLnByb3RvdHlwZVxuICAgICAqIEBwYXJhbSBpbmRleFxuICAgICAqIEBwYXJhbSByZXR1cm5Bc1N0cmluZ1xuICAgICAqIEBkZXNjIFByb3ZpZGVzIHRoZSB1bmljb2RlIGNoYXJhY3RlciB1c2VkIHRvIGRlbm90ZSB2aXN1YWxseSBpZiBhIGNvbHVtbiBpcyBhIHNvcnRlZCBzdGF0ZVxuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqL1xuICAgIGdldFNvcnRJbWFnZUZvckNvbHVtbjogZnVuY3Rpb24oY29sdW1uSW5kZXgpIHtcbiAgICAgICAgdmFyIHNvcnRzID0gdGhpcy5zb3J0ZXIuc29ydHMsXG4gICAgICAgICAgICBzb3J0U3BlYyA9IHRoaXMuZ2V0Q29sdW1uU29ydFN0YXRlKGNvbHVtbkluZGV4KSxcbiAgICAgICAgICAgIHJlc3VsdCwgcmFuaztcblxuICAgICAgICBpZiAoc29ydFNwZWMpIHtcbiAgICAgICAgICAgIHZhciBkaXJlY3Rpb25LZXkgPSBzb3J0U3BlYy5zb3J0LmRpcmVjdGlvbiA+IDAgPyAnQVNDJyA6ICdERVNDJyxcbiAgICAgICAgICAgICAgICBhcnJvdyA9IHRoaXMuY2hhck1hcFtkaXJlY3Rpb25LZXldO1xuXG4gICAgICAgICAgICByZXN1bHQgPSBhcnJvdyArICcgJztcblxuICAgICAgICAgICAgaWYgKHNvcnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICByYW5rID0gc29ydHMubGVuZ3RoIC0gc29ydFNwZWMucmFuaztcbiAgICAgICAgICAgICAgICByZXN1bHQgPSByYW5rICsgcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLm1heFNvcnRDb2x1bW5zID0gMztcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBUaGUgYmVoYXZpb3JzJ3Mgc29ydGVyIGRhdGEgY29udHJvbGxlci5cbiAgICAgKiBAZGVzYyBUaGlzIGdldHRlci9zZXR0ZXIgaXMgc3ludGFjdGljIHN1Z2FyIGZvciBjYWxscyB0byBgZ2V0Q29udHJvbGxlcmAgYW5kIGBzZXRDb250cm9sbGVyYC5cbiAgICAgKiBAbWVtYmVyT2YgSHlwZXJncmlkI1xuICAgICAqL1xuICAgIGdldCBzb3J0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldENvbnRyb2xsZXIoJ3NvcnRlcicpO1xuICAgIH0sXG4gICAgc2V0IHNvcnRlcihzb3J0ZXIpIHtcbiAgICAgICAgdGhpcy5zZXRDb250cm9sbGVyKCdzb3J0ZXInLCBzb3J0ZXIpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyT2YgSHlwZXJncmlkI1xuICAgICAqIEBwYXJhbSBldmVudFxuICAgICAqL1xuICAgIHRvZ2dsZVNvcnQ6IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5hYm9ydEVkaXRpbmcoKSkgeyByZXR1cm47IH1cblxuICAgICAgICB2YXIgYmVoYXZpb3IgPSB0aGlzLmJlaGF2aW9yLFxuICAgICAgICAgICAgc2VsZiA9IHRoaXMsXG4gICAgICAgICAgICBjID0gZXZlbnQuZGV0YWlsLmNvbHVtbixcbiAgICAgICAgICAgIGtleXMgPSAgZXZlbnQuZGV0YWlsLmtleXM7XG5cbiAgICAgICAgYmVoYXZpb3IudG9nZ2xlU29ydChjLCBrZXlzKTtcblxuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2VsZi5zeW5jaHJvbml6ZVNjcm9sbGluZ0JvdW5kYXJpZXMoKTtcbiAgICAgICAgICAgIGJlaGF2aW9yLmF1dG9zaXplQWxsQ29sdW1ucygpO1xuICAgICAgICAgICAgc2VsZi5yZXBhaW50KCk7XG4gICAgICAgIH0sIDEwKTtcbiAgICB9XG5cbn07XG4iXX0=

(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var SummarySubgrid = require('./js/SummarySubgrid');

var totalsToolkit = {
    preinstall: function(HypergridPrototype, BehaviorPrototype) {

        HypergridPrototype.mixIn(require('./mix-ins/grid'));
        BehaviorPrototype.mixIn(require('./mix-ins/behavior'));

        if (!BehaviorPrototype.dataModels.SummarySubgrid) {

            // Register in case a subgrid list is included in state object
            BehaviorPrototype.dataModels.SummarySubgrid = SummarySubgrid;

            // Add to default subgrid list in case no subgrid list is included in state object
            var specs = BehaviorPrototype.defaultSubgridSpecs;
            specs.splice(specs.indexOf('data'), 0, [SummarySubgrid, { name: 'topTotals' }]);
            specs.splice(specs.indexOf('data') + 1, 0, [SummarySubgrid, { name: 'bottomTotals' }]);

        }

    }
};

window.fin.Hypergrid.totalsToolkit = totalsToolkit;

},{"./js/SummarySubgrid":2,"./mix-ins/behavior":3,"./mix-ins/grid":4}],2:[function(require,module,exports){
'use strict';

/**
 * @implements dataModelAPI
 * @param {Hypergrid} grid
 * @param {object} [options]
 * @param {string} [options.name]
 * @constructor
 */
function SummarySubgrid(grid, options) {
    this.behavior = grid.behavior;

    /**
     * @type {Array<Array>}
     */
    this.data = [];

    if (options && options.name) {
        this.name = options.name;
    }
}

SummarySubgrid.prototype = {
    constructor: SummarySubgrid.prototype.constructor,

    type: 'summary',

    hasOwnData: true, // do not call setData implicitly

    getRowCount: function() {
        return this.getData().length;
    },

    getData: function() {
        var data = this.data;

        if (!data.length) {
            data = this.behavior.dataModel.dataSource.getGrandTotals() || data;
        }

        return data;
    },

    /**
     * @summary Set summary data rows.
     * @desc Set to an array of data row objects.
     * @param {Array<Array>} data - `[]` defers to data source's grand totals.
     */
    setData: function(data, schema) {
        this.data = data;
    },

    getValue: function(x, y) {
        var row = this.getRow(y);
        return row[x];
    },

    /**
     * @summary Set a value in a summary row.
     * @desc Setting a value on a non-extant row creates the row.
     * @param x
     * @param y
     * @param value
     */
    setValue: function(x, y, value) {
        var row = this.data[y] = this.data[y] || Array(this.behavior.getActiveColumnCount());
        row[x] = value;
    },

    getRow: function(y) {
        return this.getData()[y];
    }
};

module.exports = SummarySubgrid;

},{}],3:[function(require,module,exports){
'use strict';

module.exports = {

    /** @typedef {Array} valueList
     * @desc One of:
     * * `activeColumnsList` falsy - Array of row values semantically congruent to `this.columns`.
     * * `activeColumnsList` truthy - Array of row values semantically congruent to `this.allColumns`.
     */

    /**
     * @param {number} x - Column index. If you have an "active" column index, you can translate it with `this.getActiveColumn(x).index`.
     * @param {number} y - Totals row index, local to the totals area.
     * @param value
     * @param {string|string[]} [areas=['top', 'bottom']] - may include `'top'` and/or `'bottom'`
     * @memberOf Behavior.prototype
     */
    setTotalsValue: function(x, y, value, areas) {
        if (!areas) {
            areas = [];
            if (this.subgrids.lookup.topTotals) { areas.push('top'); }
            if (this.subgrids.lookup.bottomTotal) { areas.push('bottom'); }
        } else if (!Array.isArray(areas)) {
            areas = [areas];
        }
        areas.forEach(function(area) {
            this.getTotals(area)[y][x] = value;
        }, this);
        this.grid.setTotalsValueNotification(x, y, value, areas);
    },

    /**
     * @summary Set the top total row(s).
     * @param {valueList[]} [rows] - Array of 0 or more rows containing summary data. Omit to set to empty array.
     * @param {boolean} [activeColumnsList=false]
     * @memberOf Behavior.prototype
     */
    setTopTotals: function(rows, activeColumnsList) {
        return this.setTotals('top', rows, activeColumnsList);
    },

    /**
     * @summary Get the top total row(s).
     * @returns {valueList[]}
     * @param {boolean} [activeColumnsList=false]
     * @returns {valueList|Array} Full data row object, or object containing just the "active" columns, per `activeColumnsList`.
     * @memberOf Behavior.prototype
     */
    getTopTotals: function(activeColumnsList) {
        return this.getTotals('top', activeColumnsList);
    },

    /**
     * @summary Set the bottom totals.
     * @param {valueList[]} rows - Array of 0 or more rows containing summary data. Omit to set to empty array.
     * @param {boolean} [activeColumnsList=false] - If `true`, `rows` only contains active columns.
     * @memberOf Behavior.prototype
     */
    setBottomTotals: function(rows, activeColumnsList) {
        return this.setTotals('bottom', rows, activeColumnsList);
    },

    /**
     * @summary Get the bottom total row(s).
     * @param {boolean} [activeColumnsList=false]
     * @returns {valueList} Full data row object, or object containing just the "active" columns, per `activeColumnsList`.
     * @memberOf Behavior.prototype
     */
    getBottomTotals: function(activeColumnsList) {
        return this.getTotals('bottom', activeColumnsList);
    },

    /**
     *
     * @param {string} key
     * @param {valueList[]} rows
     * @param {boolean} [activeColumnsList=false]
     * @returns {valueList[]}
     * @returns {*}
     * @memberOf Behavior.prototype
     */
    setTotals: function(key, rows, activeColumnsList) {
        key += 'Totals';

        var totals = this.subgrids.lookup[key];

        if (!totals) {
            throw new this.HypergridError('Expected subgrids.' + key + '.');
        }

        if (!Array.isArray(rows)) {
            // if not an array, fail silently
            rows = [];
        } else if (rows.length && !Array.isArray(rows[0])) {
            // if an unnested array representing a single row, nest it
            rows = [rows];
        }

        if (activeColumnsList) {
            rows.forEach(function(row, i, rows) {
                rows[i] = this.expandActiveRowToDataRow(row);
            }, this);
        }

        var newRowCount = rows.length,
            oldRowCount = totals.getRowCount();

        totals.setData(rows);

        if (newRowCount === oldRowCount) {
            this.grid.repaint();
        } else {
            this.grid.behavior.shapeChanged();
        }

        return rows;
    },

    /**
     *
     * @param key
     * @param {boolean} [activeColumnsList=false]
     * @returns {valueList} Full data row object, or object containing just the "active" columns, per `activeColumnsList`.
     * @memberOf Behavior.prototype
     */
    getTotals: function(key, activeColumnsList) {
        key += 'Totals';

        var rows = this.subgrids.lookup[key];
        rows = rows ? rows.getData() : [];

        if (activeColumnsList) {
            rows.forEach(function(row, i, rows) {
                rows[i] = this.collapseDataRowToActiveRow(row);
            }, this);
        }

        return rows;
    },

    /**
     * @param {boolean} [activeColumnsList=false]
     * @returns {valueList}
     * @memberOf Behavior.prototype
     */
    expandActiveRowToDataRow: function(activeColumnValues) {
        var dataRow = Array(this.allColumns.length);

        this.columns.forEach(function(column, i) {
            if (activeColumnValues[i] !== undefined) {
                dataRow[column.index] = activeColumnValues[i];
            }
        });

        return dataRow;
    },

    /**
     * @param {boolean} [activeColumnsList=false]
     * @returns {valueList}
     * @memberOf Behavior.prototype
     */
    collapseDataRowToActiveRow: function(allColumnValues) {
        var dataRow = Array(this.columns.length);

        this.columns.forEach(function(column, i) {
            if (allColumnValues[column.index] !== undefined) {
                dataRow[i] = allColumnValues[column.index];
            }
        });

        return dataRow;
    }

};

},{}],4:[function(require,module,exports){
/* eslint-env browser */

'use strict';

module.exports = {

    /**
     * @memberOf Hypergrid.prototype
     * @param {number} x - column index
     * @param {number} y - totals row index local to the totals area
     * @param value
     * @param {string[]} [areas=['top', 'bottom']] - may include `'top'` and/or `'bottom'`
     */
    setTotalsValueNotification: function(x, y, value, areas) {
        this.fireSyntheticSetTotalsValue(x, y, value, areas);
    },

    /**
     * @memberOf Hypergrid.prototype
     * @param {number} x - column index
     * @param {number} y - totals row index local to the totals area
     * @param value
     * @param {string[]} [areas=['top', 'bottom']] - may include `'top'` and/or `'bottom'`
     */
    fireSyntheticSetTotalsValue: function(x, y, value, areas) {
        var clickEvent = new CustomEvent('fin-set-totals-value', {
            detail: {
                x: x,
                y: y,
                value: value,
                areas: areas
            }
        });
        this.canvas.dispatchEvent(clickEvent);
    }

};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy90b3RhbHMtdG9vbGtpdC9mYWtlX2Q1MTc0MjQ0LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL3RlbXAvZmluLWh5cGVyZ3JpZC9hZGQtb25zL3RvdGFscy10b29sa2l0L2pzL1N1bW1hcnlTdWJncmlkLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL3RlbXAvZmluLWh5cGVyZ3JpZC9hZGQtb25zL3RvdGFscy10b29sa2l0L21peC1pbnMvYmVoYXZpb3IuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvdGVtcC9maW4taHlwZXJncmlkL2FkZC1vbnMvdG90YWxzLXRvb2xraXQvbWl4LWlucy9ncmlkLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBTdW1tYXJ5U3ViZ3JpZCA9IHJlcXVpcmUoJy4vanMvU3VtbWFyeVN1YmdyaWQnKTtcblxudmFyIHRvdGFsc1Rvb2xraXQgPSB7XG4gICAgcHJlaW5zdGFsbDogZnVuY3Rpb24oSHlwZXJncmlkUHJvdG90eXBlLCBCZWhhdmlvclByb3RvdHlwZSkge1xuXG4gICAgICAgIEh5cGVyZ3JpZFByb3RvdHlwZS5taXhJbihyZXF1aXJlKCcuL21peC1pbnMvZ3JpZCcpKTtcbiAgICAgICAgQmVoYXZpb3JQcm90b3R5cGUubWl4SW4ocmVxdWlyZSgnLi9taXgtaW5zL2JlaGF2aW9yJykpO1xuXG4gICAgICAgIGlmICghQmVoYXZpb3JQcm90b3R5cGUuZGF0YU1vZGVscy5TdW1tYXJ5U3ViZ3JpZCkge1xuXG4gICAgICAgICAgICAvLyBSZWdpc3RlciBpbiBjYXNlIGEgc3ViZ3JpZCBsaXN0IGlzIGluY2x1ZGVkIGluIHN0YXRlIG9iamVjdFxuICAgICAgICAgICAgQmVoYXZpb3JQcm90b3R5cGUuZGF0YU1vZGVscy5TdW1tYXJ5U3ViZ3JpZCA9IFN1bW1hcnlTdWJncmlkO1xuXG4gICAgICAgICAgICAvLyBBZGQgdG8gZGVmYXVsdCBzdWJncmlkIGxpc3QgaW4gY2FzZSBubyBzdWJncmlkIGxpc3QgaXMgaW5jbHVkZWQgaW4gc3RhdGUgb2JqZWN0XG4gICAgICAgICAgICB2YXIgc3BlY3MgPSBCZWhhdmlvclByb3RvdHlwZS5kZWZhdWx0U3ViZ3JpZFNwZWNzO1xuICAgICAgICAgICAgc3BlY3Muc3BsaWNlKHNwZWNzLmluZGV4T2YoJ2RhdGEnKSwgMCwgW1N1bW1hcnlTdWJncmlkLCB7IG5hbWU6ICd0b3BUb3RhbHMnIH1dKTtcbiAgICAgICAgICAgIHNwZWNzLnNwbGljZShzcGVjcy5pbmRleE9mKCdkYXRhJykgKyAxLCAwLCBbU3VtbWFyeVN1YmdyaWQsIHsgbmFtZTogJ2JvdHRvbVRvdGFscycgfV0pO1xuXG4gICAgICAgIH1cblxuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gdG90YWxzVG9vbGtpdDtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAaW1wbGVtZW50cyBkYXRhTW9kZWxBUElcbiAqIEBwYXJhbSB7SHlwZXJncmlkfSBncmlkXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMubmFtZV1cbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBTdW1tYXJ5U3ViZ3JpZChncmlkLCBvcHRpb25zKSB7XG4gICAgdGhpcy5iZWhhdmlvciA9IGdyaWQuYmVoYXZpb3I7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXJyYXk8QXJyYXk+fVxuICAgICAqL1xuICAgIHRoaXMuZGF0YSA9IFtdO1xuXG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5uYW1lKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB9XG59XG5cblN1bW1hcnlTdWJncmlkLnByb3RvdHlwZSA9IHtcbiAgICBjb25zdHJ1Y3RvcjogU3VtbWFyeVN1YmdyaWQucHJvdG90eXBlLmNvbnN0cnVjdG9yLFxuXG4gICAgdHlwZTogJ3N1bW1hcnknLFxuXG4gICAgaGFzT3duRGF0YTogdHJ1ZSwgLy8gZG8gbm90IGNhbGwgc2V0RGF0YSBpbXBsaWNpdGx5XG5cbiAgICBnZXRSb3dDb3VudDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldERhdGEoKS5sZW5ndGg7XG4gICAgfSxcblxuICAgIGdldERhdGE6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZGF0YSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBpZiAoIWRhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICBkYXRhID0gdGhpcy5iZWhhdmlvci5kYXRhTW9kZWwuZGF0YVNvdXJjZS5nZXRHcmFuZFRvdGFscygpIHx8IGRhdGE7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgU2V0IHN1bW1hcnkgZGF0YSByb3dzLlxuICAgICAqIEBkZXNjIFNldCB0byBhbiBhcnJheSBvZiBkYXRhIHJvdyBvYmplY3RzLlxuICAgICAqIEBwYXJhbSB7QXJyYXk8QXJyYXk+fSBkYXRhIC0gYFtdYCBkZWZlcnMgdG8gZGF0YSBzb3VyY2UncyBncmFuZCB0b3RhbHMuXG4gICAgICovXG4gICAgc2V0RGF0YTogZnVuY3Rpb24oZGF0YSwgc2NoZW1hKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgfSxcblxuICAgIGdldFZhbHVlOiBmdW5jdGlvbih4LCB5KSB7XG4gICAgICAgIHZhciByb3cgPSB0aGlzLmdldFJvdyh5KTtcbiAgICAgICAgcmV0dXJuIHJvd1t4XTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgU2V0IGEgdmFsdWUgaW4gYSBzdW1tYXJ5IHJvdy5cbiAgICAgKiBAZGVzYyBTZXR0aW5nIGEgdmFsdWUgb24gYSBub24tZXh0YW50IHJvdyBjcmVhdGVzIHRoZSByb3cuXG4gICAgICogQHBhcmFtIHhcbiAgICAgKiBAcGFyYW0geVxuICAgICAqIEBwYXJhbSB2YWx1ZVxuICAgICAqL1xuICAgIHNldFZhbHVlOiBmdW5jdGlvbih4LCB5LCB2YWx1ZSkge1xuICAgICAgICB2YXIgcm93ID0gdGhpcy5kYXRhW3ldID0gdGhpcy5kYXRhW3ldIHx8IEFycmF5KHRoaXMuYmVoYXZpb3IuZ2V0QWN0aXZlQ29sdW1uQ291bnQoKSk7XG4gICAgICAgIHJvd1t4XSA9IHZhbHVlO1xuICAgIH0sXG5cbiAgICBnZXRSb3c6IGZ1bmN0aW9uKHkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0RGF0YSgpW3ldO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3VtbWFyeVN1YmdyaWQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgLyoqIEB0eXBlZGVmIHtBcnJheX0gdmFsdWVMaXN0XG4gICAgICogQGRlc2MgT25lIG9mOlxuICAgICAqICogYGFjdGl2ZUNvbHVtbnNMaXN0YCBmYWxzeSAtIEFycmF5IG9mIHJvdyB2YWx1ZXMgc2VtYW50aWNhbGx5IGNvbmdydWVudCB0byBgdGhpcy5jb2x1bW5zYC5cbiAgICAgKiAqIGBhY3RpdmVDb2x1bW5zTGlzdGAgdHJ1dGh5IC0gQXJyYXkgb2Ygcm93IHZhbHVlcyBzZW1hbnRpY2FsbHkgY29uZ3J1ZW50IHRvIGB0aGlzLmFsbENvbHVtbnNgLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBDb2x1bW4gaW5kZXguIElmIHlvdSBoYXZlIGFuIFwiYWN0aXZlXCIgY29sdW1uIGluZGV4LCB5b3UgY2FuIHRyYW5zbGF0ZSBpdCB3aXRoIGB0aGlzLmdldEFjdGl2ZUNvbHVtbih4KS5pbmRleGAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUb3RhbHMgcm93IGluZGV4LCBsb2NhbCB0byB0aGUgdG90YWxzIGFyZWEuXG4gICAgICogQHBhcmFtIHZhbHVlXG4gICAgICogQHBhcmFtIHtzdHJpbmd8c3RyaW5nW119IFthcmVhcz1bJ3RvcCcsICdib3R0b20nXV0gLSBtYXkgaW5jbHVkZSBgJ3RvcCdgIGFuZC9vciBgJ2JvdHRvbSdgXG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHNldFRvdGFsc1ZhbHVlOiBmdW5jdGlvbih4LCB5LCB2YWx1ZSwgYXJlYXMpIHtcbiAgICAgICAgaWYgKCFhcmVhcykge1xuICAgICAgICAgICAgYXJlYXMgPSBbXTtcbiAgICAgICAgICAgIGlmICh0aGlzLnN1YmdyaWRzLmxvb2t1cC50b3BUb3RhbHMpIHsgYXJlYXMucHVzaCgndG9wJyk7IH1cbiAgICAgICAgICAgIGlmICh0aGlzLnN1YmdyaWRzLmxvb2t1cC5ib3R0b21Ub3RhbCkgeyBhcmVhcy5wdXNoKCdib3R0b20nKTsgfVxuICAgICAgICB9IGVsc2UgaWYgKCFBcnJheS5pc0FycmF5KGFyZWFzKSkge1xuICAgICAgICAgICAgYXJlYXMgPSBbYXJlYXNdO1xuICAgICAgICB9XG4gICAgICAgIGFyZWFzLmZvckVhY2goZnVuY3Rpb24oYXJlYSkge1xuICAgICAgICAgICAgdGhpcy5nZXRUb3RhbHMoYXJlYSlbeV1beF0gPSB2YWx1ZTtcbiAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIHRoaXMuZ3JpZC5zZXRUb3RhbHNWYWx1ZU5vdGlmaWNhdGlvbih4LCB5LCB2YWx1ZSwgYXJlYXMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgdGhlIHRvcCB0b3RhbCByb3cocykuXG4gICAgICogQHBhcmFtIHt2YWx1ZUxpc3RbXX0gW3Jvd3NdIC0gQXJyYXkgb2YgMCBvciBtb3JlIHJvd3MgY29udGFpbmluZyBzdW1tYXJ5IGRhdGEuIE9taXQgdG8gc2V0IHRvIGVtcHR5IGFycmF5LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2FjdGl2ZUNvbHVtbnNMaXN0PWZhbHNlXVxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRUb3BUb3RhbHM6IGZ1bmN0aW9uKHJvd3MsIGFjdGl2ZUNvbHVtbnNMaXN0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldFRvdGFscygndG9wJywgcm93cywgYWN0aXZlQ29sdW1uc0xpc3QpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBHZXQgdGhlIHRvcCB0b3RhbCByb3cocykuXG4gICAgICogQHJldHVybnMge3ZhbHVlTGlzdFtdfVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2FjdGl2ZUNvbHVtbnNMaXN0PWZhbHNlXVxuICAgICAqIEByZXR1cm5zIHt2YWx1ZUxpc3R8QXJyYXl9IEZ1bGwgZGF0YSByb3cgb2JqZWN0LCBvciBvYmplY3QgY29udGFpbmluZyBqdXN0IHRoZSBcImFjdGl2ZVwiIGNvbHVtbnMsIHBlciBgYWN0aXZlQ29sdW1uc0xpc3RgLlxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRUb3BUb3RhbHM6IGZ1bmN0aW9uKGFjdGl2ZUNvbHVtbnNMaXN0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFRvdGFscygndG9wJywgYWN0aXZlQ29sdW1uc0xpc3QpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgdGhlIGJvdHRvbSB0b3RhbHMuXG4gICAgICogQHBhcmFtIHt2YWx1ZUxpc3RbXX0gcm93cyAtIEFycmF5IG9mIDAgb3IgbW9yZSByb3dzIGNvbnRhaW5pbmcgc3VtbWFyeSBkYXRhLiBPbWl0IHRvIHNldCB0byBlbXB0eSBhcnJheS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFthY3RpdmVDb2x1bW5zTGlzdD1mYWxzZV0gLSBJZiBgdHJ1ZWAsIGByb3dzYCBvbmx5IGNvbnRhaW5zIGFjdGl2ZSBjb2x1bW5zLlxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRCb3R0b21Ub3RhbHM6IGZ1bmN0aW9uKHJvd3MsIGFjdGl2ZUNvbHVtbnNMaXN0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldFRvdGFscygnYm90dG9tJywgcm93cywgYWN0aXZlQ29sdW1uc0xpc3QpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBHZXQgdGhlIGJvdHRvbSB0b3RhbCByb3cocykuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbYWN0aXZlQ29sdW1uc0xpc3Q9ZmFsc2VdXG4gICAgICogQHJldHVybnMge3ZhbHVlTGlzdH0gRnVsbCBkYXRhIHJvdyBvYmplY3QsIG9yIG9iamVjdCBjb250YWluaW5nIGp1c3QgdGhlIFwiYWN0aXZlXCIgY29sdW1ucywgcGVyIGBhY3RpdmVDb2x1bW5zTGlzdGAuXG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGdldEJvdHRvbVRvdGFsczogZnVuY3Rpb24oYWN0aXZlQ29sdW1uc0xpc3QpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VG90YWxzKCdib3R0b20nLCBhY3RpdmVDb2x1bW5zTGlzdCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGtleVxuICAgICAqIEBwYXJhbSB7dmFsdWVMaXN0W119IHJvd3NcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFthY3RpdmVDb2x1bW5zTGlzdD1mYWxzZV1cbiAgICAgKiBAcmV0dXJucyB7dmFsdWVMaXN0W119XG4gICAgICogQHJldHVybnMgeyp9XG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHNldFRvdGFsczogZnVuY3Rpb24oa2V5LCByb3dzLCBhY3RpdmVDb2x1bW5zTGlzdCkge1xuICAgICAgICBrZXkgKz0gJ1RvdGFscyc7XG5cbiAgICAgICAgdmFyIHRvdGFscyA9IHRoaXMuc3ViZ3JpZHMubG9va3VwW2tleV07XG5cbiAgICAgICAgaWYgKCF0b3RhbHMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyB0aGlzLkh5cGVyZ3JpZEVycm9yKCdFeHBlY3RlZCBzdWJncmlkcy4nICsga2V5ICsgJy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShyb3dzKSkge1xuICAgICAgICAgICAgLy8gaWYgbm90IGFuIGFycmF5LCBmYWlsIHNpbGVudGx5XG4gICAgICAgICAgICByb3dzID0gW107XG4gICAgICAgIH0gZWxzZSBpZiAocm93cy5sZW5ndGggJiYgIUFycmF5LmlzQXJyYXkocm93c1swXSkpIHtcbiAgICAgICAgICAgIC8vIGlmIGFuIHVubmVzdGVkIGFycmF5IHJlcHJlc2VudGluZyBhIHNpbmdsZSByb3csIG5lc3QgaXRcbiAgICAgICAgICAgIHJvd3MgPSBbcm93c107XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYWN0aXZlQ29sdW1uc0xpc3QpIHtcbiAgICAgICAgICAgIHJvd3MuZm9yRWFjaChmdW5jdGlvbihyb3csIGksIHJvd3MpIHtcbiAgICAgICAgICAgICAgICByb3dzW2ldID0gdGhpcy5leHBhbmRBY3RpdmVSb3dUb0RhdGFSb3cocm93KTtcbiAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG5ld1Jvd0NvdW50ID0gcm93cy5sZW5ndGgsXG4gICAgICAgICAgICBvbGRSb3dDb3VudCA9IHRvdGFscy5nZXRSb3dDb3VudCgpO1xuXG4gICAgICAgIHRvdGFscy5zZXREYXRhKHJvd3MpO1xuXG4gICAgICAgIGlmIChuZXdSb3dDb3VudCA9PT0gb2xkUm93Q291bnQpIHtcbiAgICAgICAgICAgIHRoaXMuZ3JpZC5yZXBhaW50KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmdyaWQuYmVoYXZpb3Iuc2hhcGVDaGFuZ2VkKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcm93cztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ga2V5XG4gICAgICogQHBhcmFtIHtib29sZWFufSBbYWN0aXZlQ29sdW1uc0xpc3Q9ZmFsc2VdXG4gICAgICogQHJldHVybnMge3ZhbHVlTGlzdH0gRnVsbCBkYXRhIHJvdyBvYmplY3QsIG9yIG9iamVjdCBjb250YWluaW5nIGp1c3QgdGhlIFwiYWN0aXZlXCIgY29sdW1ucywgcGVyIGBhY3RpdmVDb2x1bW5zTGlzdGAuXG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGdldFRvdGFsczogZnVuY3Rpb24oa2V5LCBhY3RpdmVDb2x1bW5zTGlzdCkge1xuICAgICAgICBrZXkgKz0gJ1RvdGFscyc7XG5cbiAgICAgICAgdmFyIHJvd3MgPSB0aGlzLnN1YmdyaWRzLmxvb2t1cFtrZXldO1xuICAgICAgICByb3dzID0gcm93cyA/IHJvd3MuZ2V0RGF0YSgpIDogW107XG5cbiAgICAgICAgaWYgKGFjdGl2ZUNvbHVtbnNMaXN0KSB7XG4gICAgICAgICAgICByb3dzLmZvckVhY2goZnVuY3Rpb24ocm93LCBpLCByb3dzKSB7XG4gICAgICAgICAgICAgICAgcm93c1tpXSA9IHRoaXMuY29sbGFwc2VEYXRhUm93VG9BY3RpdmVSb3cocm93KTtcbiAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJvd3M7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2FjdGl2ZUNvbHVtbnNMaXN0PWZhbHNlXVxuICAgICAqIEByZXR1cm5zIHt2YWx1ZUxpc3R9XG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGV4cGFuZEFjdGl2ZVJvd1RvRGF0YVJvdzogZnVuY3Rpb24oYWN0aXZlQ29sdW1uVmFsdWVzKSB7XG4gICAgICAgIHZhciBkYXRhUm93ID0gQXJyYXkodGhpcy5hbGxDb2x1bW5zLmxlbmd0aCk7XG5cbiAgICAgICAgdGhpcy5jb2x1bW5zLmZvckVhY2goZnVuY3Rpb24oY29sdW1uLCBpKSB7XG4gICAgICAgICAgICBpZiAoYWN0aXZlQ29sdW1uVmFsdWVzW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBkYXRhUm93W2NvbHVtbi5pbmRleF0gPSBhY3RpdmVDb2x1bW5WYWx1ZXNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBkYXRhUm93O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFthY3RpdmVDb2x1bW5zTGlzdD1mYWxzZV1cbiAgICAgKiBAcmV0dXJucyB7dmFsdWVMaXN0fVxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBjb2xsYXBzZURhdGFSb3dUb0FjdGl2ZVJvdzogZnVuY3Rpb24oYWxsQ29sdW1uVmFsdWVzKSB7XG4gICAgICAgIHZhciBkYXRhUm93ID0gQXJyYXkodGhpcy5jb2x1bW5zLmxlbmd0aCk7XG5cbiAgICAgICAgdGhpcy5jb2x1bW5zLmZvckVhY2goZnVuY3Rpb24oY29sdW1uLCBpKSB7XG4gICAgICAgICAgICBpZiAoYWxsQ29sdW1uVmFsdWVzW2NvbHVtbi5pbmRleF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGRhdGFSb3dbaV0gPSBhbGxDb2x1bW5WYWx1ZXNbY29sdW1uLmluZGV4XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGRhdGFSb3c7XG4gICAgfVxuXG59O1xuIiwiLyogZXNsaW50LWVudiBicm93c2VyICovXG5cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyT2YgSHlwZXJncmlkLnByb3RvdHlwZVxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gY29sdW1uIGluZGV4XG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSB0b3RhbHMgcm93IGluZGV4IGxvY2FsIHRvIHRoZSB0b3RhbHMgYXJlYVxuICAgICAqIEBwYXJhbSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IFthcmVhcz1bJ3RvcCcsICdib3R0b20nXV0gLSBtYXkgaW5jbHVkZSBgJ3RvcCdgIGFuZC9vciBgJ2JvdHRvbSdgXG4gICAgICovXG4gICAgc2V0VG90YWxzVmFsdWVOb3RpZmljYXRpb246IGZ1bmN0aW9uKHgsIHksIHZhbHVlLCBhcmVhcykge1xuICAgICAgICB0aGlzLmZpcmVTeW50aGV0aWNTZXRUb3RhbHNWYWx1ZSh4LCB5LCB2YWx1ZSwgYXJlYXMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyT2YgSHlwZXJncmlkLnByb3RvdHlwZVxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gY29sdW1uIGluZGV4XG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSB0b3RhbHMgcm93IGluZGV4IGxvY2FsIHRvIHRoZSB0b3RhbHMgYXJlYVxuICAgICAqIEBwYXJhbSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IFthcmVhcz1bJ3RvcCcsICdib3R0b20nXV0gLSBtYXkgaW5jbHVkZSBgJ3RvcCdgIGFuZC9vciBgJ2JvdHRvbSdgXG4gICAgICovXG4gICAgZmlyZVN5bnRoZXRpY1NldFRvdGFsc1ZhbHVlOiBmdW5jdGlvbih4LCB5LCB2YWx1ZSwgYXJlYXMpIHtcbiAgICAgICAgdmFyIGNsaWNrRXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ2Zpbi1zZXQtdG90YWxzLXZhbHVlJywge1xuICAgICAgICAgICAgZGV0YWlsOiB7XG4gICAgICAgICAgICAgICAgeDogeCxcbiAgICAgICAgICAgICAgICB5OiB5LFxuICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgICAgICBhcmVhczogYXJlYXNcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY2FudmFzLmRpc3BhdGNoRXZlbnQoY2xpY2tFdmVudCk7XG4gICAgfVxuXG59O1xuIl19

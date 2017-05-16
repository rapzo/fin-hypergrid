/* eslint-env browser */
/* globals fin */

'use strict';

var grid;

window.onload = function() {
    var Hypergrid = fin.Hypergrid;

    grid = new Hypergrid('div#example', {
        plugins: [
            Hypergrid.Hyperfilter,
            [Hypergrid.Hypersorter, {Column: fin.Hypergrid.behaviors.Column}]
        ],
        pipeline: [
            window.datasaur.filter,
            window.fin.Hypergrid.analytics.DataSourceSorterComposite
        ],
        data: [
            { value: 3 },
            { value: 4 },
            { value: -4 },
            { value: 5 }
        ]
    });

    grid.behavior.dataModel.schema.push({
        name: 'squared',
        calculator: square
    });

    // recreate to include new column
    grid.behavior.createColumns();

    // Install the sorter and Filter data sources (optional).
    // These modules are for EXAMPLE purposes only
    grid.setPipeline([
        window.datasaur.filter,
        window.datasaur.sorter
    ]);

    // Inform data model of external DCIs. (These DCIs are for EXAMPLE purposes only.)
    grid.setController({
        filter: grid.plugins.hyperfilter.create(),
        sorter: grid.plugins.hypersorter
    });

    // force type of new column to 'number' because current auto-detect does not know about calculated columns
    grid.behavior.getColumn(1).type = 'number';

    grid.installPlugins([
        window.datasaur.filter
    ]);

    grid.setState({ showFilterRow: true });

    grid.repaint();

    function square(dataRow, columnName) {
        return dataRow.value * dataRow.value;
    }
};


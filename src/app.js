// Lays out a table section as labels where rows are divided by lines.
function labelLayout(pane, columns, rows, cells) {
    var root = d3.select(pane);

    // Cell and section dimensions.
    colWidth = 200;
    totalWidth = columns.length * colWidth;
    rowHeight = 20;
    totalHeight = rows.length * rowHeight;

    // Column and row positions (possibly of a cell).
    var left = function(colOrCell) { return (colOrCell.column || colOrCell).index * colWidth; };
    var top = function(rowOrCell) { return (rowOrCell.row || rowOrCell).index * rowHeight; };

    // Text label per cell.
    var labels = root
        .selectAll("text")
        .data(cells, function(c) { return c.column.id + "_" + c.row.id; });

    labels.enter()
        .append("text")
        .attr("opacity", 0)
        .transition()
        .attr("opacity", 1);

    labels.text(function(c) { return c.value.toString().substring(0, 20); })    // Trunc labels.
        .attr("x", left)
        .attr("y", top);

    labels.exit()
        .transition()
        .attr("opacity", 0)
        .remove();

    // Underlying division line per cell.
    var rowDividers = root
        .selectAll("line")
        .data(rows, function(r) { return r.id; });

    rowDividers.enter()
        .append("line")
        .attr("opacity", 0)
        .transition()
        .attr("opacity", 1);

    rowDividers
        .attr("x1", 0)
        .attr("x2", totalWidth)
        .attr("y1", top)
        .attr("y2", top);

    rowDividers.exit()
        .transition()
        .attr("opacity", 0)
        .remove();

    return { width: totalWidth, height: totalHeight };
}

// Database request to server.
remoteDatabaseRequest = function(beginRow, endRow) {
    var query = {
        beginRow: beginRow,
        endRow: endRow,
        columns: ["title", "artist_name", "duration", "year"]
    }

    return Promise.resolve(
         $.ajax("server/dbProvider", {
            data: "query=" + JSON.stringify(query),
            contentType: 'application/json',
            type: 'GET'})
    )
}

// Data request to a server-side generator.
remoteGeneratorRequest = function(beginRow, endRow) {
    var query = {
        beginRow: beginRow,
        endRow: endRow
    }

    return Promise.resolve(
         $.ajax("server/generatorProvider", {
            data: "query=" + JSON.stringify(query),
            contentType: 'application/json',
            type: 'GET'})
    )
}

// Data request to a client-side generator.
// TODO: fix scroll latency issue in ProxyTable; introduce throttling? (Preferably not.)
localGeneratorRequest = function(beginRow, endRow) {
    var numCols = 4;
    var numRows = 1000000;

    return new Promise(function(resolve) {
        var rowRange = _.range(beginRow, endRow + 1);
        var colRange = _.range(0, numCols);

        resolve({
            beginRow: beginRow,
            rows: rowRange.map(function(r) {
                return {id: r.toString()}
            }),
            columns: colRange.map(function(r) {
                return {id: r.toString()}
            }),
            values: rowRange.map(function(r) {
                return colRange.map(function(c) { return r; })
            }),
            tableRowCount: numRows
        });
    })
}

window.onload = function() {
    var exampleTable = new ProxyTable.Table(
        "exampleTable",
        remoteGeneratorRequest,
        labelLayout
    );
}
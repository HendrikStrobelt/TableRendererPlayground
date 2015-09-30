function labelPaneGenerator(svgRoot, table, flat) {
    var root = d3.select(svgRoot);

    // Text label per cell.
    var dCs = root
        .selectAll("text")
        .data(flat, d => d.rowId + "_" + d.columnId);

    dCs.text(d => d.value)
        .attr("x", d => d.left)
        .attr("y", d => d.centerY);

    dCs.enter()
        .append("text")
        .text(d => d.value)
        .attr("x", d => d.left)
        .attr("y", d => d.centerY)
        .attr("opacity", 0)
        .transition()
        .attr("opacity", 1);

    dCs.exit().remove();

    // Underlying division line per cell...
    var divLines = root
        .selectAll("line")
        .data(flat, d => d.rowId + "_" + d.columnId);

    divLines
        .attr("x1", d => d.left)
        .attr("x2", d => d.right)
        .attr("y1", d => d.bottom)
        .attr("y2", d => d.bottom);

    divLines.enter()
        .append("line")
        .attr("x1", d => d.left)
        .attr("x2", d => d.right)
        .attr("y1", d => d.bottom)
        .attr("y2", d => d.bottom)
        .attr("opacity", 0)
        .transition()
        .attr("opacity", 1);

    divLines.exit().remove();
}

var tangeloProvider = new table.TangeloProvider("server/tableProvider", "songs");
var bigTable = new table.Element(
    "bigTable",
    tangeloProvider,
    ["title", "artist_name", "duration", "year"],
    labelPaneGenerator,
    { width: 200, height: 20 }
);
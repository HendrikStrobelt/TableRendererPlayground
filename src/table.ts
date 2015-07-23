///<reference path="references.d.ts"/>

import $ = require('jquery');
import _ = require('underscore');
import d3 = require('d3');

// DOM manager.
export class Element {
    private div: HTMLDivElement;
    private svg: SVGElement;

    private shownColumns: ColumnConfiguration[];

    //private visibleColumnCount: number;
    private visibleRowCount: number;
    private rowSliceSize: number;   // Number of rows to put in a slice.
    private sliceBuffer: Slice[];   // Slices, by added order.
    private sliceBufferMax : number = 10;
    private sliceIndex: Slice[];    // Slices, by block normalized index.

    constructor(public domId: string,
                public dataProvider: DataProvider,
                public cellGenerator: CellGenerator = labelCellGenerator,
                public elementStyle: ElementStyle = new ElementStyle()) {
        this.div = <HTMLDivElement> $('#' + domId)[0];
        this.svg = <SVGElement> document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("class", "internalPane");
        this.div.appendChild(this.svg);

        // Update SVG pane to match total table size. TODO: push server-side table changes.
        dataProvider.requestConfiguration().then((c) => this.updatePane(c));

        // Update rendered cells on SVG scroll.
        this.div.onscroll = () => this.cellsUpdate();
    }

    private updatePane(configuration: Configuration) {
        // Short circuit to show all columns for now.
        this.shownColumns = configuration.columns;

        // Set internal div size to match required row size.
        this.svg.setAttribute("width", configuration.columns.length * this.elementStyle.cellDimensions.width + "px");
        this.svg.setAttribute("height", configuration.rowCount * this.elementStyle.cellDimensions.height + "px");

        // Update visibility values (wide margins of error, for now).
        //this.visibleColumnCount = Math.ceil(this.div.offsetWidth / this.elementStyle.cellDimensions.width) + 1;
        this.visibleRowCount = Math.ceil(this.div.offsetHeight / this.elementStyle.cellDimensions.height) + 1;
        this.rowSliceSize = this.visibleRowCount;
        this.sliceBuffer = [];   // Clear full cache, for now
        this.sliceIndex = [];

        this.cellsUpdate();
    }

    private cellsUpdate() {
        this.visibleBlockIndices(2).forEach((i) => this.fetchSlice(i));
    }

    private visibleBlockIndices(neighborhood: number = 1) {
        var bounds = this.svg.getBoundingClientRect();

        // Visible row coordinates.
        var middleRowIndex = Math.round(
            -bounds.top / this.elementStyle.cellDimensions.height +
            this.visibleRowCount / 2);
        var middleBlockIndex = this.rowToBlockIndex(middleRowIndex);

        // Fetch neighbor blocks, for now.
        return _.range(-neighborhood, neighborhood + 1).map(dI => middleBlockIndex + dI).filter(i => i >= 0);
    }

    private rowToBlockIndex(rowIndex: number) {
        return Math.floor(rowIndex / this.rowSliceSize);
    }

    private fetchSlice(index: number) {
        var result = this.sliceIndex[index];

        if(!result) {
            var beginRow = index * this.rowSliceSize;
            var endRow = beginRow + this.rowSliceSize;
            var query = new Query(beginRow, endRow, this.shownColumns.map(cc => cc.name));
            this.dataProvider.requestSlice(query).then((slice: Slice) => {
                // Update slice buffer (as a queue).
                this.sliceBuffer.unshift(slice);
                if(this.sliceBuffer.length > this.sliceBufferMax) {
                    var remSlice = this.sliceBuffer.pop();
                    delete this.sliceIndex[this.rowToBlockIndex(remSlice.query.beginRow)];
                }

                // Update slice index.
                this.sliceIndex[this.rowToBlockIndex(slice.query.beginRow)] = slice;

                // Update SVG for newly received block.
                this.updateSVG();

                //console.log("Buffer by index: " + this.sliceBuffer.map(s => s.query.beginRow + " to " + s.query.endRow));
                //console.log("Slices by index: " + _.keys(this.sliceIndex));
            });
        }

        return result;
    }

    private updateSVG() {
        $(this.svg).empty();

        var slices: Slice[] = _.compact(this.visibleBlockIndices().map(i => this.sliceIndex[i]));
        var colCount = slices.length == 0 ? 0 : slices[0].query.columns.length;
        var rowCount = 0;
        slices.forEach(s => rowCount += s.rowIds.length);

        // Fill cell range from blocks.
        var cells: string[][] = [];
        for(var i = 0; i < colCount; i++) cells[i] = [];

        var cD = this.elementStyle.cellDimensions;
        slices.forEach(s => {
            s.columns.forEach((c, cI) => {

                c.values.forEach((v, rI) => {
                    var aRI = s.query.beginRow + rI;

                    var cellSVG = this.cellGenerator(
                        s.rowIds[rI],
                        c.column.name,
                        v,
                        aRI * cD.height,
                        (cI+1) * cD.width,
                        (aRI+1) * cD.height,
                        cI * cD.width);
                    this.insertSVGElement(cellSVG);
                });
            });
        });
    }

    private insertSVGElement(svgEl: SVGElement) {
        this.svg.appendChild(svgEl);
    }

}

export class ElementStyle {
    constructor(public cellDimensions = {width: 100, height: 20}) {
    }
}

export interface CellGenerator {
    (rowId: string,
     columnId: string,
     value: any,
     top: number,
     right: number,
     bottom: number,
     left: number): SVGElement;
}

export function labelCellGenerator(rowId: string,
                                   columnId: string,
                                   value: any,
                                   top: number,
                                   right: number,
                                   bottom: number,
                                   left: number) {
    var label = document.createElementNS("http://www.w3.org/2000/svg", "text");

    label.setAttributeNS(null, "x", left + "px");
    label.setAttributeNS(null, "y", top + "px");
    label.setAttributeNS(null, "font-size", "16");

    var textNode = document.createTextNode(value);
    label.appendChild(textNode);

    return <SVGElement> label;
}

// Base table configuration, sent by server.
export class Configuration {
    constructor(public columns: ColumnConfiguration[], public rowCount: number) {}
}

// Column that is part of the configuration.
export class ColumnConfiguration {
    constructor(public name: string) {}
}

// Query, sent as a request to a data provider.
export class Query {
    constructor(public beginRow: number,
                public endRow: number,
                public columns: string[]) {}
}

// Query result, sent by a data provider.
export class Slice {
    constructor(public query: Query,
                public columns: Column[],
                public rowIds: string[]) {}
}

export class Column {
    constructor(public column: ColumnConfiguration,
                public values: any[]) {}
}

// Data provider layer.
export interface DataProvider {
    requestConfiguration(): Promise<Configuration>;
    requestSlice(query: Query): Promise<Slice>;
}

// Tangelo data provider implementation.
export class TangeloProvider implements DataProvider {
    constructor(public serviceUrl: string, public serverTable: string) {

    }

    private request<E>(...args: any[]): Promise<E> {
        var reqStr = this.serviceUrl + "?"
        reqStr += "tableName=" + encodeURIComponent(this.serverTable);
        for(var i = 0; i < args.length; i++)
            reqStr += args[i] + "=" + encodeURIComponent(args[i+1]) + (i < args.length - 1 ? "&" : "");

        return Promise.resolve($.getJSON(reqStr));
    }

    requestConfiguration() {
        return this.request<Configuration>();
    }

    requestSlice(query: Query) {
        return this.request<Slice>(
            "beginRow", query.beginRow,
            "endRow", query.endRow,
            "columns", query.columns)
    }
}

// Plain number generator.
export class GeneratorProvider implements DataProvider {
    constructor(public numCols: number, public numRows: number) {}

    requestConfiguration() {
        return new Promise<Configuration>((resolve, reject) => {
            var colConfigs = _.range(0, this.numCols).map((i) => new ColumnConfiguration(i.toString()));
            resolve(new Configuration(colConfigs, this.numRows));
        });
    }

    requestSlice(query: Query) {
        return new Promise<Slice>((resolve, reject) => {
            var colRange = _.range(query.beginRow, query.endRow);
            var columns = query.columns.map(c => new Column(new ColumnConfiguration(c), colRange));
            var columnIds = colRange.map(id => id.toString());
            resolve(new Slice(query, columns, columnIds));
        })
    }
}
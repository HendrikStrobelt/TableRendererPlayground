///<reference path="references.d.ts"/>

import $ = require('jquery');
import _ = require('underscore');

// DOM manager.
export class Element {
    private div: HTMLDivElement;
    private internalDiv: HTMLDivElement;

    constructor(public domId: string,
                public dataProvider: DataProvider,
                public elementStyle: ElementStyle = new ElementStyle()) {
        this.div = <HTMLDivElement> $('#' + domId)[0];
        this.internalDiv = document.createElement("div");
        this.internalDiv.className = "internalPane";
        this.div.appendChild(this.internalDiv);

        dataProvider.requestConfiguration().then((c) => this.updatePane(c));
    }

    private updatePane(configuration: Configuration) {
        // Set internal div size to match required row size.
        this.internalDiv.style.width = configuration.columns.length * this.elementStyle.cellDimensions[0] + "px";
        this.internalDiv.style.height = configuration.rowCount * this.elementStyle.cellDimensions[1] + "px";

        console.log("Element style dimensions: " + this.elementStyle.cellDimensions);

        console.log("Update pane is called")
    }
}

export class ElementStyle {
    constructor(public cellDimensions = [100, 20]) {
    }
}

// Base table configuration, sent by server.
export class Configuration {
    constructor(public columns: ColumnConfiguration[], public rowCount: number) {}
}

// Column that is part of the configuration.
export class ColumnConfiguration {
    constructor(public name: string, public type: string) {}
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
                public columns: Column[]) {}
}

export class Column {
    constructor(public column: ColumnConfiguration,
                public values: any[]) {}
}

// Data provider layer.
export interface DataProvider {
    requestConfiguration(): Promise<Configuration>;
    requestSelection(query: Query): Promise<Slice>;
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

        console.log("Sent request: " + reqStr);

        return Promise.resolve($.getJSON(reqStr));
    }

    requestConfiguration() {
        return this.request<Configuration>();
    }

    requestSelection(query: Query) {
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
            var colConfigs = _.range(0, this.numCols).map((i) => new ColumnConfiguration(i.toString(), "number"));
            resolve(new Configuration(colConfigs, this.numRows));
        });
    }

    requestSelection(query: Query) {
        return new Promise<Slice>((resolve, reject) => {
            var columns = query.columns.map(c =>
                new Column(new ColumnConfiguration(c, "number"), _.range(query.beginRow, query.endRow)));
            resolve(new Slice(query, columns));
        })
    }
}
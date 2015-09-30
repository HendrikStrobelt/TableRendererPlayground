/// <reference path="definitions/jquery.d.ts" />
/// <reference path="definitions/d3.d.ts" />
/// <reference path="definitions/es6-promise.d.ts" />
/// <reference path="definitions/underscore.d.ts" />

module ProxyTable {

    export class Table {
        public dom: HTMLDivElement;
        private svg: SVGElement;

        private sliceIndex: Slice[];                        // Slices, by block normalized index.
        private toFetch: number[];                          // Slices to fetch, as block normalized indices.
        private lastRowCount: number;
        private lastColumns: Identifiable[];
        private lastRowDimensions: Dimensions;              // Total table dimensions.

        constructor(public domElement: string | HTMLDivElement,
                    public dataProvider: DataProvider,      // Provides table data by row interval.
                    public layoutProvider: LayoutProvider,
                    public bufferedBlocks = 10,             // Number (radius) of row blocks to load around viewport center.
                    public rowBlockSize = 100) {            // Number of rows in a single block.
            // Accept a DOM element or an identifier.
            this.dom = typeof domElement === "string" ? <HTMLDivElement> $('#' + domElement)[0] : domElement;

            this.svg = <SVGElement> document.createElementNS("http://www.w3.org/2000/svg", "svg");
            this.svg.setAttribute("class", "internalPane");
            this.dom.appendChild(this.svg);

            this.lastRowCount = 0;
            this.lastColumns = [];
            this.lastRowDimensions = { width: 1, height: 1 };

            this.setDataProvider(dataProvider);

            // Update table cells on SVG scroll.
            $(this.dom).scroll(() => {
                this.requestUpdateView();
                this.updateCells();
            });
        }

        // Set data provider and update table view, or just update table view (without parameter).
        public setDataProvider(dataProvider: DataProvider = null) {
            if(dataProvider) {
                this.dataProvider = dataProvider;
            }

            // Clear slice records.
            this.sliceIndex = [];
            this.toFetch = [];

            // Request new records.
            this.updateCells();
        }

        private updateCells() {
            this.toFetch = this.visibleBlockIndices(this.bufferedBlocks).filter(bI => !this.sliceIndex[bI]);
            this.fetchSlices();
        }

        private visibleBlockIndices(neighborhood: number = 1) {
            // Build range from middle index outwards (middle will be requested first).
            var visibleIndex = this.visibleBlock();
            var result = [visibleIndex];
            for(var i = 1; i <= neighborhood; i++) {
                result.push(visibleIndex + i);
                if(visibleIndex > 0) result.push(visibleIndex - i);
            }

            return result;
        }

        private visibleBlock() {
            var bounds = this.svg.getBoundingClientRect();

            // Visible row coordinates.
            var visibleRowCount = Math.ceil(this.dom.offsetHeight / this.lastRowDimensions.height);
            var middleRowIndex = Math.round(-bounds.top / this.lastRowDimensions.height + visibleRowCount / 2);
            var middleBlockIndex = Math.floor(middleRowIndex / this.rowBlockSize);

            return middleBlockIndex;
        }

        // Fetch slices one by one to moderate load for client and server.
        // This also prevents having to use throttling/debouncing.
        // The most important slice will be fetched first anyways.
        private fetchingSlice = false;
        private fetchSlices() {
            if(!this.fetchingSlice && this.toFetch.length > 0) {
                this.fetchingSlice = true;
                var fetchI = this.toFetch.shift();

                // Request relevant row range.
                var beginRow = fetchI * this.rowBlockSize;
                var endRow = (fetchI + 1) * this.rowBlockSize;
                this.dataProvider(beginRow, endRow)
                    .then((slice: Slice) => {
                        // Store slice.
                        slice.beginRow = beginRow;
                        this.sliceIndex[fetchI] = slice;

                        // New table dimensions have been posted.
                        if(slice.columns) {
                            this.lastColumns = slice.columns;   // Includes additional column fields from dataProvider.
                        }
                        if(slice.tableRowCount) {
                            this.lastRowCount = slice.tableRowCount;
                            this.updateTableDimensions();
                        }

                        // Update SVG for newly received block.
                        this.requestUpdateView(fetchI);

                        // Fetch next slice (if any).
                        this.fetchingSlice = false;
                        this.fetchSlices();
                    });
            }
        }

        // Update column configuration and table row total, match div size of internal pane.
        private updateTableDimensions() {
            this.svg.setAttribute("width", this.lastRowDimensions.width.toString());
            this.svg.setAttribute("height", (this.lastRowCount * this.lastRowDimensions.height).toString());
        }

        // Request the
        private lastUpdateIndex = null;
        private requestUpdateView(changedSliceIndex: number = -1) {
            var updateView = false;

            if(changedSliceIndex >= 0) {
                updateView = Math.abs(changedSliceIndex - this.visibleBlock()) <= 1;
            } else {
                var visibleIndex = this.visibleBlock();
                updateView = visibleIndex !== this.lastUpdateIndex;
                this.lastUpdateIndex = visibleIndex;
            }

            if(updateView) {
                this.updateView();
            }
        }

        // Push table data to the layoutProvider.
        private updateView() {
            // Compose the visible section from the three slices that (possibly) intersect the viewport.
            var slices: Slice[] = _.compact(this.visibleBlockIndices().map(i => this.sliceIndex[i]));

            // Provide table data in three formats: all cells, column->row->cell, row->column->cell.
            var columns = this.lastColumns.map((c, i) => new Line(c.id, [], i));
            var rows: Line[] = [];
            var cells: Cell[] = [];

            // Prevent redundant update when no slices are available.
            if(slices.length) {
                // Clean slice index.
                var middleBlockIndex = this.visibleBlock();
                this.sliceIndex = _.pick(this.sliceIndex,
                    (s, i) => Math.max(0, middleBlockIndex - 1) <= i && i <= middleBlockIndex + 1);

                // Compose columns, rows, and cells from slices.
                slices.forEach(s => {
                    for(var rI = 0; rI < this.rowBlockSize; rI++) {
                        var r = s.rows[rI]; // TODO: copy any additional row fields that dataProvider has provided.
                        var outRow = new Line(r.id, [], s.beginRow + rI);
                        rows.push(outRow);

                        s.values[rI].forEach((v, cI) => {
                            var cell = new Cell(columns[cI], outRow, v);
                            columns[cI].cells.push(cell);
                            outRow.cells.push(cell);
                            cells.push(cell);
                        });
                    }
                });

                var updRowDimensions = this.layoutProvider(this.svg, columns, rows, cells);

                // Update internal pane size if the reported (average) element size has changed.
                var rowWidth = updRowDimensions.width;
                var avgRowHeight = Math.ceil(updRowDimensions.height / rows.length);
                if(rowWidth && avgRowHeight) {
                    this.lastRowDimensions = { width: rowWidth, height: avgRowHeight };
                    this.updateTableDimensions();
                }
            }
        }
    }

    // Query result, received from a data provider.
    interface Slice {
        beginRow: number;           // Index of first row in total table.
        rows: Identifiable[];       // Row information with unique identifier.
        columns: Identifiable[];    // Column information with unique identifier.
        values: any[][];            // Indexed [row][column]
        tableRowCount?: number;     // Optional total row count update.
    }

    // Table/Cell dimensions.
    export interface Dimensions {
        width: number;
        height: number;
    }

    // Object with unique identifier (for example, a row or column).
    interface Identifiable {
        id: string;
    }

    // Filled column or row.
    export class Line implements Identifiable {
        constructor(public id: string, public cells: Cell[], public index: number) {}
    }

    export class Cell {
        constructor(public column: Line, public row: Line, public value: any) { }
    }

    // Function to handle the data acquisition of a table interval, for row indices [beginRow, endRow].
    export interface DataProvider {
        (beginRow: number, endRow: number): Promise<Slice>;
    }

    // Function to handle the rendering of a table interval.
    export interface LayoutProvider {
        (svgRoot: SVGElement, columns: Line[], rows: Line[], cells: Cell[]): Dimensions;
    }

}
///<reference path="references.d.ts"/>

class ProxyTable {
    private div: HTMLDivElement;
    private svg: SVGElement;

    private visibleRowCount: number;        // Number of rows visible in viewport.
    private rowSliceSize: number;           // Number of rows to put in a slice.
    private sliceBuffer: Slice[];           // Slices, by added order.
    private bufferedRange: number = 5;
    private sliceIndex: Slice[];            // Slices, by block normalized index.
    private sliceFetchIndex: boolean[];     // Slices, flagged to be fetched.

    private columns: Identifiable[];        // Last known column configuration.
    private rowCount: number;               // Last known total number of table rows.

    private refreshDelay = 50;

    private dataProvider: DataProvider;

    constructor(public domId: string,
                public paneGenerator: PaneGenerator,
                public elementStyle: ElementStyle,
                dataProvider?: DataProvider) {
        this.div = <HTMLDivElement> $('#' + domId)[0];
        this.svg = <SVGElement> document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("class", "internalPane");
        this.svg.setAttribute("id", "internalPane");
        this.div.appendChild(this.svg);

        if(dataProvider) {
            this.setDataProvider(dataProvider);
        }

        // Update SVG pane to match total table size. TODO: push server-side table changes.
        //dataProvider.requestConfiguration().then((c) => this.updatePane(c));
        this.updatePane();

        // Update table cells on SVG scroll.
        $(this.div).scroll($['debounce'](this.refreshDelay, () => this.cellsUpdate()));
    }

    public setDataProvider(dataProvider: DataProvider) {
        this.dataProvider = dataProvider;
    }

    private updatePane() {
        // Update visibility values.
        this.visibleRowCount = Math.ceil(this.div.offsetHeight / this.elementStyle.height);
        this.rowSliceSize = this.visibleRowCount;
        this.sliceBuffer = [];
        this.sliceIndex = [];
        this.sliceFetchIndex = [];

        this.cellsUpdate();
    }

    private cellsUpdate() {
        this.visibleBlockIndices(this.bufferedRange).forEach((i) => this.fetchSlice(i));
    }

    private visibleBlockIndices(neighborhood: number = 1) {
        var blockRange = this.visibleBlockRange(neighborhood);

        // Build range from middle index outwards (middle will be requested first).
        var middleIndex = Math.floor((blockRange[0] + blockRange[1]) / 2);
        var result = [middleIndex];
        for(var i = 1; i <= neighborhood; i++) {
            result.push(middleIndex + i);
            result.push(middleIndex - i);
        }

        return result;
    }

    private visibleBlockRange(neighborhood: number = 1) {
        var bounds = this.svg.getBoundingClientRect();

        // Visible row coordinates.
        var middleRowIndex = Math.round(
            -bounds.top / this.elementStyle.height + this.visibleRowCount / 2);
        var middleBlockIndex = this.rowToBlockIndex(middleRowIndex);

        return [Math.max(0, middleBlockIndex - neighborhood), middleBlockIndex + neighborhood + 1];
    }

    private rowToBlockIndex(rowIndex: number) {
        return Math.floor(rowIndex / this.rowSliceSize);
    }

    private fetchSlice(index: number) {
        // Fetch when slice is missing and not requested yet.
        if(!this.sliceIndex[index] && !this.sliceFetchIndex[index]) {
            // Flag request.
            this.sliceFetchIndex[index] = true;

            // Request relevant row range.
            this.dataProvider(index * this.rowSliceSize, (index + 1) * this.rowSliceSize)
                .then((slice: Slice) => {
                    // Unflag request.
                    this.sliceFetchIndex[index] = null;
                    this.sliceFetchIndex = _.pick(this.sliceFetchIndex, _.identity);

                    // Store slice.
                    this.sliceIndex[index] = slice;
                    this.sliceBuffer.push(slice);

                    // Update column configuration and table row total, match div size of internal pane.
                    if(slice.columns) {
                        this.columns = slice.columns;
                        this.svg.setAttribute("width", (this.columns.length * this.elementStyle.width).toString());
                    }
                    if(slice.tableRowCount) {
                        this.rowCount = slice.tableRowCount;
                        this.svg.setAttribute("height", (this.rowCount * this.elementStyle.height).toString());
                    }

                    // Update SVG for newly received block.
                    this.updateSVG();
                });
        }
        // Immediate SVG update.
        else {
            this.updateSVG();
        }
    }

    private updateSVG = $['throttle'](this.refreshDelay, () => {
        // Clear slice buffer.
        var bufferRange = this.visibleBlockRange(this.bufferedRange);
        var inRange = (index: number) => bufferRange[0] <= index && index <= bufferRange[1];

        this.sliceBuffer = this.sliceBuffer.filter(s => inRange(this.rowToBlockIndex(s.beginRow)));
        this.sliceIndex = _.pick(this.sliceIndex, (s, i) => bufferRange[0] <= i && i <= bufferRange[1]);

        var slices: Slice[] = _.compact(this.visibleBlockIndices().map(i => this.sliceIndex[i]));
        var colCount = slices.length == 0 ? 0 : slices[0].columns.length;

        var cells: CellInfo[][] = [];
        var flat: CellInfo[] = [];
        for(var i = 0; i < colCount; i++) cells[i] = [];

        var eS = this.elementStyle;
        slices.forEach(s => {
            s.values.forEach((r, rI) => {
                r.forEach((v, cI) => {
                    var absI = s.beginRow + rI;

                    cells[cI][absI] = new CellInfo(
                        s.rows[rI].id,
                        s.columns[cI].id,
                        v,
                        absI * eS.height,
                        (cI+1) * eS.width,
                        (absI+1) * eS.height,
                        cI * eS.width
                    );

                    flat.push(cells[cI][absI]);
                });
            });
        });

        this.paneGenerator(this.svg, cells, _.compact(flat));
    });

}

interface ElementStyle {
    width: number;
    height: number;
}

class CellInfo {
    centerX: number;
    centerY: number;

    constructor(public rowId: string,
                public columnId: string,
                public value: any,
                public top: number,
                public right: number,
                public bottom: number,
                public left: number) {
        this.centerX = (left + right) / 2;
        this.centerY = (top + bottom) / 2;
    }
}

interface PaneGenerator {
    (svgRoot: SVGElement, table: CellInfo[][], flat: CellInfo[]);
}

// Object with unique identifier (for example, a row or column).
interface Identifiable {
    id: string;
}

// Data provider function
interface DataProvider {
    (beginRow: number, endRow: number): Promise<Slice>;
}

// Query result, sent by a data provider.
interface Slice {
    beginRow: number;           // index of first row in total table.
    rows: Identifiable[];       // row information with unique identifier.
    columns: Identifiable[];    // column information with unique identifier.
    values: any[][];            // indexed [row][column]
    tableRowCount?: number;     // optional total row count update.
}
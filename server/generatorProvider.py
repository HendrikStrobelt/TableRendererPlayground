import tangelo
import json

@tangelo.types(query=json.loads)
def run(query):
    # Number of rows and columns in the table.
    rowCount = 1000000
    columnCount = 4

    beginRow = query['beginRow']
    endRow = query['endRow']
    columns = range(columnCount)

    # Database result to outbound result.
    outColumns = [{'id': c} for c in columns]   # Attach any additional column information here.
    outRows = []                                # Attach any additional row information here.
    outValues = []
    for row in range(beginRow, endRow + 1):
        outRows.append({'id': row})                 # Row id is row number.
        outValues.append([row for c in columns])    # Fill row with row number.

    return {
        'rows': outRows,
        'columns': outColumns,
        'values': outValues,
        'tableRowCount': rowCount
    }
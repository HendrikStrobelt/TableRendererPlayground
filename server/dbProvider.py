import sqlite3
import tangelo
import json

# Determine table configuration.
dbName = 'misong.sqlite'
tableName = 'songs'
idColumn = 'rowid'

@tangelo.types(query=json.loads)
def run(query):
    conn = sqlite3.connect(dbName)
    cursor = conn.cursor()

    # Number of rows in the table.
    cursor.execute("SELECT Count(*) FROM {0}".format(tableName))
    rowCount = cursor.fetchone()[0]

    # Inbound query to SQL.
    beginRow = query['beginRow']
    endRow = query['endRow']
    columns = [idColumn] + query['columns']  # Add identifier column.

    query = "SELECT {0} FROM {1} LIMIT {2} OFFSET {3}".format(','.join(columns), tableName, endRow - beginRow, beginRow)
    data = cursor.execute(query)

    # Database result to outbound result.
    outColumns = [{'id': c} for c in columns[1:]]   # Attach any additional column information here.
    outRows = []                                    # Attach any additional row information here.
    outValues = []
    for row in data:
        outRows.append({'id': row[0]})    # First column contains identifier.
        outValues.append(row[1:])         # Remaining columns contain requested values.

    conn.close()

    return {
        'beginRow': beginRow,
        'rows': outRows,
        'columns': outColumns,
        'values': outValues,
        'tableRowCount': rowCount
    }
def configuration(tableName):
    return ""

def selection(tableName, beginRow, endRow, columns):
    return ""

def run(tableName=None, beginRow=None, endRow=None, columns=None):
    return configuration(tableName) if beginRow is None else selection(tableName, beginRow, endRow, columns)
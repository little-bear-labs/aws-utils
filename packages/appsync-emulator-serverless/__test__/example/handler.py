def emptyJSON(event, context):
    return {}

def composedJSON(event, context):
    return {'a': 1, 'b': 2, 'c': 3}

def error(event, context):
    raise KeyError


def graphQL(event, context):
    return {'test': 'yup'}
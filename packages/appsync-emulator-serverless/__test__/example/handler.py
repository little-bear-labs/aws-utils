def emptyJSON(event, context):
    return {}

def composedJSON(event, context):
    return {'a': 1, 'b': 2, 'c': 3}

def error(event, context):
    raise Exception


def pythonGraphQL(event, context):
    return {'test': 'yup'}

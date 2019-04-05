def ruby_empty_json(event:, context:)
  {}
end

def ruby_composed_json(event:, context:)
  { a: 1, b: 2, c: 3 }
end

def ruby_error(event:, context:)
  raise StandardError
end

def ruby_graphqL(event:, context:)
  { test: 'yup' }
end

# The arguments signature is wrong. The syntax error should show up in the error
# output.
def ruby_broken_function(event, context:)

end

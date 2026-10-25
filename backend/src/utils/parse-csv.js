const AppError = require('./app-error')

const parseCsv = (content) => {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]

    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
      continue
    }

    if (character === '"' && field.length === 0) {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      row.push(field)
      if (row.some((value) => value.trim() !== '')) {
        rows.push(row)
      }
      row = []
      field = ''
      if (character === '\r' && content[index + 1] === '\n') {
        index += 1
      }
    } else {
      field += character
    }
  }

  if (quoted) {
    throw new AppError(400, 'CSV contains an unterminated quoted field.')
  }

  row.push(field)
  if (row.some((value) => value.trim() !== '')) {
    rows.push(row)
  }

  if (rows.length === 0) {
    throw new AppError(400, 'CSV file is empty.')
  }

  return rows
}

module.exports = parseCsv

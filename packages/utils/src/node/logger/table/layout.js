const kindOf = require('kind-of')
const objectAssign = require('object-assign')
const Cell = require('./cell')
const RowSpanCell = Cell.RowSpanCell
const ColSpanCell = Cell.ColSpanCell;

(function () {
  function layoutTable (table) {
    table.forEach(function (row, rowIndex) {
      row.forEach(function (cell, columnIndex) {
        cell.y = rowIndex
        cell.x = columnIndex
        for (var y = rowIndex; y >= 0; y--) {
          var row2 = table[y]
          var xMax = (y === rowIndex) ? columnIndex : row2.length
          for (var x = 0; x < xMax; x++) {
            var cell2 = row2[x]
            while (cellsConflict(cell, cell2)) {
              cell.x++
            }
          }
        }
      })
    })
  }

  function maxWidth (table) {
    var mw = 0
    table.forEach(function (row) {
      row.forEach(function (cell) {
        mw = Math.max(mw, cell.x + (cell.colSpan || 1))
      })
    })
    return mw
  }

  function maxHeight (table) {
    return table.length
  }

  function cellsConflict (cell1, cell2) {
    var yMin1 = cell1.y
    var yMax1 = cell1.y - 1 + (cell1.rowSpan || 1)
    var yMin2 = cell2.y
    var yMax2 = cell2.y - 1 + (cell2.rowSpan || 1)
    var yConflict = !(yMin1 > yMax2 || yMin2 > yMax1)

    var xMin1 = cell1.x
    var xMax1 = cell1.x - 1 + (cell1.colSpan || 1)
    var xMin2 = cell2.x
    var xMax2 = cell2.x - 1 + (cell2.colSpan || 1)
    var xConflict = !(xMin1 > xMax2 || xMin2 > xMax1)

    return yConflict && xConflict
  }

  function conflictExists (rows, x, y) {
    var iMax = Math.min(rows.length - 1, y)
    var cell = { x: x, y: y }
    for (var i = 0; i <= iMax; i++) {
      var row = rows[i]
      for (var j = 0; j < row.length; j++) {
        if (cellsConflict(cell, row[j])) {
          return true
        }
      }
    }
    return false
  }

  function allBlank (rows, y, xMin, xMax) {
    for (var x = xMin; x < xMax; x++) {
      if (conflictExists(rows, x, y)) {
        return false
      }
    }
    return true
  }

  function addRowSpanCells (table) {
    table.forEach(function (row, rowIndex) {
      row.forEach(function (cell) {
        for (var i = 1; i < cell.rowSpan; i++) {
          var rowSpanCell = new RowSpanCell(cell)
          rowSpanCell.x = cell.x
          rowSpanCell.y = cell.y + i
          rowSpanCell.colSpan = cell.colSpan
          insertCell(rowSpanCell, table[rowIndex + i])
        }
      })
    })
  }

  function addColSpanCells (cellRows) {
    for (var rowIndex = cellRows.length - 1; rowIndex >= 0; rowIndex--) {
      var cellColumns = cellRows[rowIndex]
      for (var columnIndex = 0; columnIndex < cellColumns.length; columnIndex++) {
        var cell = cellColumns[columnIndex]
        for (var k = 1; k < cell.colSpan; k++) {
          var colSpanCell = new ColSpanCell()
          colSpanCell.x = cell.x + k
          colSpanCell.y = cell.y
          cellColumns.splice(columnIndex + 1, 0, colSpanCell)
        }
      }
    }
  }

  function insertCell (cell, row) {
    var x = 0
    while (x < row.length && (row[x].x < cell.x)) {
      x++
    }
    row.splice(x, 0, cell)
  }

  function fillInTable (table) {
    var hMax = maxHeight(table)
    var wMax = maxWidth(table)
    for (var y = 0; y < hMax; y++) {
      for (var x = 0; x < wMax; x++) {
        if (!conflictExists(table, x, y)) {
          var opts = { x: x, y: y, colSpan: 1, rowSpan: 1 }
          x++
          while (x < wMax && !conflictExists(table, x, y)) {
            opts.colSpan++
            x++
          }
          var y2 = y + 1
          while (y2 < hMax && allBlank(table, y2, opts.x, opts.x + opts.colSpan)) {
            opts.rowSpan++
            y2++
          }

          var cell = new Cell(opts)
          cell.x = opts.x
          cell.y = opts.y
          insertCell(cell, table[y])
        }
      }
    }
  }

  function generateCells (rows) {
    return rows.map(function (row) {
      if (kindOf(row) !== 'array') {
        var key = Object.keys(row)[0]
        row = row[key]
        if (kindOf(row) === 'array') {
          row = row.slice()
          row.unshift(key)
        } else {
          row = [key, row]
        }
      }
      return row.map(function (cell) {
        return new Cell(cell)
      })
    })
  }

  function makeTableLayout (rows) {
    var cellRows = generateCells(rows)
    layoutTable(cellRows)
    fillInTable(cellRows)
    addRowSpanCells(cellRows)
    addColSpanCells(cellRows)
    return cellRows
  }

  module.exports = {
    makeTableLayout: makeTableLayout,
    layoutTable: layoutTable,
    addRowSpanCells: addRowSpanCells,
    maxWidth: maxWidth,
    fillInTable: fillInTable,
    computeWidths: makeComputeWidths('colSpan', 'desiredWidth', 'x', 1),
    computeHeights: makeComputeWidths('rowSpan', 'desiredHeight', 'y', 1)
  }
})()

function makeComputeWidths (colSpan, desiredWidth, x, forcedMin) {
  return function (vals, table) {
    var result = []
    var spanners = []
    table.forEach(function (row) {
      row.forEach(function (cell) {
        if ((cell[colSpan] || 1) > 1) {
          spanners.push(cell)
        } else {
          result[cell[x]] = Math.max(result[cell[x]] || 0, cell[desiredWidth] || 0, forcedMin)
        }
      })
    })

    vals.forEach(function (val, index) {
      if (kindOf(val) === 'number') {
        result[index] = val
      }
    })

    // spanners.forEach(function(cell){
    for (var k = spanners.length - 1; k >= 0; k--) {
      var cell = spanners[k]
      var span = cell[colSpan]
      var col = cell[x]
      var existingWidth = result[col]
      var editableCols = kindOf(vals[col]) === 'number' ? 0 : 1
      for (var i = 1; i < span; i++) {
        existingWidth += 1 + result[col + i]
        if (kindOf(vals[col + i]) !== 'number') {
          editableCols++
        }
      }
      if (cell[desiredWidth] > existingWidth) {
        i = 0
        while (editableCols > 0 && cell[desiredWidth] > existingWidth) {
          if (kindOf(vals[col + i]) !== 'number') {
            var dif = Math.round((cell[desiredWidth] - existingWidth) / editableCols)
            existingWidth += dif
            result[col + i] += dif
            editableCols--
          }
          i++
        }
      }
    }

    objectAssign(vals, result)
    for (var j = 0; j < vals.length; j++) {
      vals[j] = Math.max(forcedMin, vals[j] || 0)
    }
  }
}

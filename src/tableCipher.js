const crypto = require('crypto')

const cachedTables = {}

const int32Max = Math.pow(2, 32)

function merge (left, right, comparison) {
  var result
  result = new Array()
  while ((left.length > 0) && (right.length > 0)) {
    if (comparison(left[0], right[0]) <= 0) {
      result.push(left.shift())
    } else {
      result.push(right.shift())
    }
  }
  while (left.length > 0) {
    result.push(left.shift())
  }
  while (right.length > 0) {
    result.push(right.shift())
  }
  return result
}

function mergeSort (array, comparison) {
  var middle
  if (array.length < 2) {
    return array
  }
  middle = Math.ceil(array.length / 2)
  return merge(mergeSort(array.slice(0, middle), comparison), mergeSort(array.slice(middle), comparison), comparison)
}

function substitute (table, buf) {
  var i
  i = 0
  while (i < buf.length) {
    buf[i] = table[buf[i]]
    i++
  }
  return buf
}

function getTable (key) {
  var ah, al, decrypt_table, hash, i, md5sum, result, table
  if (cachedTables[key]) {
    return cachedTables[key]
  }
  table = new Array(256)
  decrypt_table = new Array(256)
  md5sum = crypto.createHash("md5")
  md5sum.update(key)
  hash = new Buffer(md5sum.digest(), "binary")
  al = hash.readUInt32LE(0)
  ah = hash.readUInt32LE(4)
  i = 0
  while (i < 256) {
    table[i] = i
    i++
  }
  i = 1
  while (i < 1024) {
    table = mergeSort(table, function(x, y) {
      return ((ah % (x + i)) * int32Max + al) % (x + i) - ((ah % (y + i)) * int32Max + al) % (y + i)
    })
    i++
  }
  i = 0
  while (i < 256) {
    decrypt_table[table[i]] = i
    ++i
  }
  result = [table, decrypt_table]
  cachedTables[key] = result
  return result
}

module.exports = class TableCipher {
  constructor (key, isEncrypt) {
    this.tables = getTable(key)
    this.actualTable = isEncrypt ? this.tables[0] : this.tables[1]
  }

  update (data) {
    return substitute(this.actualTable, data)
  }
}
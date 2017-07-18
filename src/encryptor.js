const crypto = require('crypto')
const TableCipher = require('./tableCipher')

// directly exported from shadowsocks-nodejs
const cryptoParamLength = {
  'aes-128-cfb': [16, 16],
  'aes-192-cfb': [24, 16],
  'aes-256-cfb': [32, 16],
  'bf-cfb': [16, 8],
  'camellia-128-cfb': [16, 16],
  'camellia-192-cfb': [24, 16],
  'camellia-256-cfb': [32, 16],
  'cast5-cfb': [16, 8],
  'des-cfb': [8, 8],
  'idea-cfb': [16, 8],
  'rc2-cfb': [16, 8],
  'rc4': [16, 0],
  'rc4-md5': [16, 16],
  'seed-cfb': [16, 16],
}

const keyCache = {}

module.exports.getParamLength = function (methodName) {
  return cryptoParamLength[methodName]
}

function getMD5Hash (data) {
  return crypto.createHash('md5').update(data).digest()
}

function create_rc4_md5_cipher (key, iv, op) {
  var md5, rc4_key
  md5 = crypto.createHash('md5')
  md5.update(key)
  md5.update(iv)
  rc4_key = md5.digest()
  if (op === 1) {
    return crypto.createCipheriv('rc4', rc4_key, '')
  } else {
    return crypto.createDecipheriv('rc4', rc4_key, '')
  }
}

module.exports.generateKey = function (methodName, secret) {
  const secretBuf = new Buffer(secret, 'utf8')
  const tokens = []
  const keyLength = getParamLength(methodName)[0]
  const cacheIndex = `${methodName}_${secret}`

  let i = 0
  let hash
  let length = 0
  if (keyCache.hasOwnProperty(cacheIndex)) {
    return keyCache[cacheIndex]
  }

  if (!keyLength) {
    // TODO: catch error
    throw new Error('unsupported method')
  }

  while (length < keyLength) {
    hash = getMD5Hash((i === 0) ? secretBuf : Buffer.concat([tokens[i - 1], secretBuf]))
    tokens.push(hash)
    i ++
    length += hash.length
  }

  hash = Buffer.concat(tokens).slice(0, keyLength)

  keyCache[cacheIndex] = hash

  return hash
}

module.exports.createCipher = function (secret, methodName, initialData, _iv) {
  if (methodName === 'table') {
    let tableCipher = new TableCipher(secret, true)
    return {
      cipher: tableCipher,
      data: tableCipher.update(initialData)
    }
  }
  const key = generateKey(methodName, secret)
  const iv = _iv || crypto.randomBytes(getParamLength(methodName)[1])
  let cipher = null
  if (methodName === 'rc4-md5') {
    cipher = create_rc4_md5_cipher(key, iv, 1);
  } else {
    cipher = crypto.createCipheriv(methodName, key, iv)
  }

  return {
    cipher,
    data: Buffer.concat([iv, cipher.update(initialData)]),
  }
}

module.exports.createDecipher = function  (secret, methodName, initialData) {
  if (methodName === 'table') {
    let tableDecipher = new TableCipher(secret, false)
    return {
      cipher: tableDecipher,
      data: tableDecipher.update(initialData)
    }
  }
  const ivLength = getParamLength(methodName)[1]
  const iv = initialData.slice(0, ivLength)

  if (iv.length !== ivLength) {
    return null
  }

  const key = generateKey(methodName, secret)
  let decipher = null
  if (methodName === 'rc4-md5') {
    decipher = create_rc4_md5_cipher(key, iv, 0);
  } else {
    decipher = crypto.createDecipheriv(methodName, key, iv)
  }
  const data = decipher.update(initialData.slice(ivLength))

  return {
    decipher,
    data,
  }
}

module.exports.encrypt = function (secret, methodName, data, _iv) {
  return createCipher(secret, methodName, data, _iv).data
}

module.exports.decrypt = function (secret, methodName, data) {
  return createDecipher(secret, methodName, data).data
}

const crypto = require('crypto')
const fs = require('fs')
const watch = require('node-watch')
const config = require('./config.js')
const Path = require('path')
const mkdirp = require('mkdirp')
const walk = require('walk')
const del = require('del')
var queue = require('queue')({ concurrency: 1 })

function readFileMd5 (path) {
  return new Promise(function (resolve, reject) {
    var fd = fs.createReadStream(path)
    var hash = crypto.createHash('md5')
    hash.setEncoding('hex')
    fd.on('end', function() {
      hash.end()
      resolve(hash.read())
    })
    fd.on('error', function (err) {
      reject(err)
    })
    fd.pipe(hash)
  })
}

function generateHash (inputDir, outputDir) {
  console.log('generateHash')
  return del([outputDir], { force: true }).then(function () {
    return new Promise(function (resolve, reject) {
      var walker = walk.walk(inputDir)
      walker.on('file', function (root, fileStats, next) {
        if (/^\./.test(fileStats.name)) return next()
        var relative = Path.relative(inputDir, root)
        var outputFloder = Path.resolve(outputDir, relative)
        var outputPath = Path.resolve(outputFloder, fileStats.name + '.md5')
        readFileMd5(root + '/' + fileStats.name)
        .then(function (hash) {
          mkdirp(outputFloder, function (err) {
            return fs.writeFile(outputPath, hash)
          })
        })
        .then(function () {
          next()
        })
      })
      walker.on('end', function () {
        resolve()
      })
    })
  })
}

generateHash(config.watchDir, config.outputDir)

const watchOptions = {
  recursive: true,
  filter: function (name) {
    return !/^\./.test(name)
  }
}
watch(config.watchDir, watchOptions, function(evt, path) {
  console.log(path, ' changed.');
  queue.push(function (cb) {
    console.log('Dealing with', path);
    generateHash(config.watchDir, config.outputDir).then(function () {
      console.log('done')
      cb()
    })
  })
  queue.start()
})

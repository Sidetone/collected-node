const fs = require('fs')
const Path = require('path')
const R = require('ramda')
const nodePromise = require('./nodePromise')
const hashFile = require('./hashFile')
const mimos = require('./mimos')
const { indexFileName } = require('./constants')

const combineNamesAndValues = R.zipWith((path, value) => R.cond([
	[R.has('sha256'), R.merge({ path })],
	[R.T, R.prop('children')]
])(value))

function hashChild(basePath, fileName, prefix) {
	const filePath = Path.join(basePath, fileName)
	
	return nodePromise(callback => {
		fs.lstat(filePath, callback)
	})
	.then(
		R.cond([
			[stats => stats.isFile(), stats => (
				hashFile(filePath)
				.then(hash => ({
					sha256: hash,
					bytes: stats.size,
					mimeType: mimos.path(filePath).type
				}))
			)],
			[stats => stats.isDirectory(), R.always(
				hashDirectory(filePath, Path.join(prefix, fileName))
				.then(R.objOf('children'))
			)]
		])
	)
}

function hashDirectory(path, prefix = '') {
	return nodePromise(callback => {
		fs.readdir(path, callback)
	})
	.then(R.reject(R.anyPass([ // Ignore the following:
		R.test(/^\./), // .*, .DS_Store
		R.equals(indexFileName) // index.collected
	])))
	.then(childNames =>
		Promise.all(childNames.map(fileName =>
			hashChild(path, fileName, prefix)
		))
		.then(R.pipe(
			R.reject(R.isNil),
			combineNamesAndValues(R.map(
				childName => Path.join(prefix, childName),
			childNames)),
			R.flatten
		))
	)
}

module.exports = hashDirectory

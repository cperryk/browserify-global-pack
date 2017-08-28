'use strict';

const globalPack = require('global-pack'),
  pathUtil = require('path'),
  fs = require('fs'),
  highland = require('highland'),
  writeFile = highland.wrapCallback(fs.writeFile);

/**
 * Returns a stream that takes in deps from a Browserify
 * bundle process, runs them through global-pack, and
 * writes each module out to a file at the specified
 * destination directory.
 * @param {string} writeToDir
 * @param {object} [opts]
 * @param {string} [opts.scope] global-pack scope
 * @param {string} [opts.verbose] log file writes
 */
function packAndWrite(writeToDir, {scope, verbose} = {}) {
  const deps = [];

  return highland.pipeline(
    highland.doto(({file, id}) => deps.push({file, id})),
    globalPack({scope}),
    getFiles(deps, writeToDir),
    writeFiles(verbose)
  );
};

/**
 * Returns a stream that determines where each module in a global-pack
 * bundle should export, taking in global-pack strings and outputting
 * {id: string, outpath: string, content: string} objects.
 * @param {string[]} deps Array of module IDs
 * @param {string[]} writeToDir
 * @return {Stream}
 */
function getFiles(deps, writeToDir) {
  let i = 0;

  return highland.map((str) => {
    const content = str + '\n',
      dep = deps[i - 1];
    let id, sourceFile;

    if (i === 0) {
      id = 'prelude';
      sourceFile = '(prelude)';
    } else if (dep) {
      id = dep.id;
      sourceFile = dep.file;
    } else {
      id = 'postlude';
      sourceFile = '(postlude)';
    }
    i++;

    return {
      id,
      sourceFile,
      outpath: getOutpath(id, writeToDir),
      content
    };
  });
}

/**
 * For a given module ID and write destination, return the absolute filepath
 * to which the module should be written.
 * @param {string} id
 * @param {string} writeToDir
 * @return {string}
 */
function getOutpath(id, writeToDir) {
  if (pathUtil.isAbsolute(id)) {
    return pathUtil.join(writeToDir, pathUtil.parse(id).name + '.js');
  }
  return pathUtil.join(writeToDir, id + '.js');
}

/**
 * Returns a stream that takes in {outpath: string, content: string} objects
 * and writes files.
 * @param {boolean} verbose
 * @return {Stream}
 */
function writeFiles(verbose) {
  return highland.flatMap(file => writeFile(file.outpath, file.content)
    .doto(() => verbose && console.log(`${file.sourceFile} -> ${file.outpath}`))
  );
}

module.exports = function browserifyGlobalPack(b, opts) {
  if (typeof opts.writeToDir !== 'string') {
    throw new Error('Browserify-global-pack requires the "writeToDir" option to be set');
  }

  b.pipeline.get('pack').splice(0, 1, packAndWrite(opts.writeToDir));
};


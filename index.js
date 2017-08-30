'use strict';

const globalPack = require('global-pack'),
  pathUtil = require('path'),
  fs = require('fs'),
  _ = require('highland'),
  writeFile = _.wrapCallback(fs.writeFile);

/**
 * Returns a stream that takes in deps from a Browserify
 * bundle process, runs them through global-pack, and
 * writes each module out to a file at the specified
 * destination directory.
 * @param {string} writeToDir
 * @param {object} [opts]
 * @param {string} [opts.scope] global-pack scope
 * @param {string} [opts.verbose] log file writes
 * @param {function} [opts.getOutfile] Customize filenames of modules
 * @returns {Stream}
 */
function packAndWrite(writeToDir, {scope, verbose, getOutfile} = {}) {
  return _.pipeline(
    globalPack({scope, objectMode: true}),
    assignOutfiles(writeToDir, getOutfile),
    writeDeps(verbose)
  );
};

/**
 * Returns a function that returns the absolute filepath
 * to which a dep's content should be written.
 * @param {string} writeToDir
 * @return {string}
 */
function getOutfileFnc(writeToDir) {
  return (dep) => {
    const id = dep.expose || dep.id;

    if (pathUtil.isAbsolute(id)) {
      return pathUtil.join(writeToDir, pathUtil.parse(id).name + '.js');
    }
    return pathUtil.join(writeToDir, id + '.js');
  };
}

/**
 * Returns a stream that adds an "outfile" property to each dep
 * @param {string} writeToDir
 * @param {function} getOutfile
 * @return {Stream}
 */
function assignOutfiles(writeToDir, getOutfile = getOutfileFnc(writeToDir)) {
  return _.map(dep => Object.assign({}, dep, {outfile: getOutfile(dep)}));
}

/**
 * Write deps, combining deps with the same outfile
 * @param {boolean} verbose Log writes
 * @return {Stream}
 */
function writeDeps(verbose) {
  return (deps) => _(deps)
    .group('outfile')
    .flatMap(_.pairs)
    .flatMap(writeDepGroup(verbose));
}

/**
 * Write groups of deps
 * @param {boolean} verbose Log writes
 * @return {Stream}
 */
function writeDepGroup(verbose) {
  return ([outfile, deps]) => {
    return _(deps)
      .reduce('', (prev, dep) => prev += dep.content + '\n')
      .flatMap(allContent => writeFile(outfile, allContent))
      .doto(() => verbose && deps.forEach(dep => console.log(`${dep.sourceFile || dep.id} -> ${outfile}`)));
  };
}

module.exports = function browserifyGlobalPack(b, opts) {
  if (!(opts.writeToDir || opts.getOutfile)) {
    throw new Error('Browserify-global-pack requires "writeToDir" or "getOutfile" to be set');
  }
  if (opts.writeToDir && opts.getOutfile) {
    throw new Error('Overspecified: Browserify-global-pack does not allow "writeToDir" or "getOutfile" to be set together');
  }
  b.pipeline.get('pack').splice(0, 1, packAndWrite(opts.writeToDir, opts));
};

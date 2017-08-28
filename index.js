'use strict';

const globalPack = require('global-pack'),
  pathUtil = require('path'),
  fs = require('fs'),
  highland = require('highland'),
  writeFile = highland.wrapCallback(fs.writeFile);

function packAndWrite(writeToDir, opts) {
  const ids = [];
  let i = 0;

  return highland.pipeline(
    highland.map((dep) => {
      if (dep.file === dep.id) {
        ids.push(pathUtil.parse(dep.id).name);
      } else {
        ids.push(dep.id);
      }
      return dep;
    }),
    globalPack(opts),
    highland.flatMap((str) => {
      const filename = (i ? ids[i - 1] || 'postlude' : 'prelude') + '.js',
        outpath = pathUtil.join(writeToDir, filename);

      i++;
      return writeFile(outpath, str + '\n');
    })
  );
}

module.exports = function browserifyGlobalPack(b, opts) {
  if (typeof opts.writeToDir !== 'string') {
    throw new Error('Browserify-global-pack requires the "writeToDir" option to be set');
  }

  b.pipeline.get('pack').splice(0, 1, packAndWrite(opts.writeToDir));
};


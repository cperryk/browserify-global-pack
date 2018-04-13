const expect = require('chai').expect,
  browserify = require('browserify'),
  fs = require('fs-extra'),
  path = require('path'),
  _ = require('highland'),
  bundlePath = path.join(__dirname, 'bundle'),
  browserifyGlobalPack = require('../index'),
  EXPECTED_FILES = ['prelude.js', 'a.js', 'b.js', 'postlude.js'];

describe('browserify-global-pack', function () {
  const expectedOutput = EXPECTED_FILES.map(file => {
    return fs.readFileSync(path.join(__dirname, 'expectedOutput', file), 'utf8');
  });

  before(function () {
    fs.removeSync(bundlePath);
  });

  beforeEach(function () {
    fs.ensureDirSync(bundlePath);
  });

  afterEach(function () {
    fs.removeSync(bundlePath);
  });

  it ('throws error if writeToDir nor getOutfile is specified', function () {
    expect(()=>browserifyGlobalPack()).to.throw(Error);
  });

  it ('throws error if both writeToDir and getOutfile are specified', function () {
    expect(()=>browserifyGlobalPack({writeToDir: 'foo', getOutfile: ()=>{}})).to.throw(Error);
  });

  it('writes global-pack chunks to files in the directory specified by writeToDir', function (done) {
    const bundler = browserify({fullPaths: true})
        .require(path.join(__dirname, 'input', './a.js'))
        .plugin(browserifyGlobalPack, {
          writeToDir: path.join(__dirname, 'bundle')
        }),
      bundlePromise = _(bundler.bundle()).toPromise(Promise);

    bundlePromise
      .then(() => {
        EXPECTED_FILES.forEach((filename, index) => {
          assertOut(filename, expectedOutput[index]);
        });
      })
      .then(() => done())
      .catch(err => done(err));
  });

  it('passes scope option to global-pack', function (done) {
    const bundler = browserify({fullPaths: true})
        .require(path.join(__dirname, 'input', './a.js'))
        .plugin(browserifyGlobalPack, {
          writeToDir: path.join(__dirname, 'bundle'),
          scope: 'foo.bar'
        }),
      bundlePromise = _(bundler.bundle()).toPromise(Promise);

    bundlePromise
      .then(()=>{
        EXPECTED_FILES.forEach((filename, index)=> {
          assertOut(filename, expectedOutput[index].replace(/window.modules/g, 'foo.bar'));
        });
      })
      .then(() => done())
      .catch(done);
  });

  it ('sets filenames to expose expose values', function (done) {
    const bundler = browserify({fullPaths: true})
        .require(path.join(__dirname, 'input', './a.js'), {
          expose: 'foo'
        })
        .plugin(browserifyGlobalPack, {
          writeToDir: path.join(__dirname, 'bundle'),
        }),
      bundlePromise = _(bundler.bundle()).toPromise(Promise);

    bundlePromise
      .then(() => {
        expect(fs.pathExistsSync(path.join(__dirname, 'bundle', 'foo.js'))).to.be.true;
      })
      .then(() => done())
      .catch(done);
  });

  it('sets file paths with custom function if getOutpath', function (done) {
    const bundler = browserify({fullPaths: true})
        .require(path.join(__dirname, 'input', './a.js'))
        .plugin(browserifyGlobalPack, {
          getOutfile: () => path.join(__dirname, 'bundle', 'out-' + (i++) + '.js')
        }),
      bundlePromise = _(bundler.bundle()).toPromise(Promise);
    let i = 0;

    bundlePromise
      .then(() => {
        EXPECTED_FILES.forEach((filename, index) => {
          assertOut('out-' + index + '.js', expectedOutput[index]);
        });
      })
      .then(() => done())
      .catch(done);
  });

  it ('puts modules associated with the same filename in the same file', function (done) {
    const bundler = browserify({fullPaths: true})
        .require(path.join(__dirname, 'input', './a.js'))
        .plugin(browserifyGlobalPack, {
          getOutfile: () => path.join(__dirname, 'bundle', 'out-' + (i++ <= 1 ? 0 : 1) + '.js')
        }),
      bundlePromise = _(bundler.bundle()).toPromise(Promise);
    let i = 0;

    bundlePromise
      .then(() => {
        assertOut('out-0.js', expectedOutput[0] + expectedOutput[1]);
        assertOut('out-1.js', expectedOutput[2] + expectedOutput[3]);
      })
      .then(() => done())
      .catch(done);
  });

  it ('writes a module to multiple files if getOutfile returns array for it', function (done) {
    const bundler = browserify({fullPaths: true})
        .require(path.join(__dirname, 'input', './a.js'))
        .plugin(browserifyGlobalPack, {
          getOutfile: () => [
            path.join(__dirname, 'bundle', 'out-1.js'),
            path.join(__dirname, 'bundle', 'out-2.js')
          ]
        }),
      bundlePromise = _(bundler.bundle()).toPromise(Promise);

    bundlePromise
      .then(() => {
        assertOut('out-1.js', expectedOutput.join(''));
        assertOut('out-2.js', expectedOutput.join(''));
        done();
      })
      .catch(done);
  });

  it ('collects deps in cache array if provided', function (done) {
    const cache = [],
      bundler = browserify({fullPaths: true})
        .require(path.join(__dirname, 'input', './a.js'))
        .plugin(browserifyGlobalPack, {
          cache,
          writeToDir: path.join(__dirname, 'bundle')
        }),
      bundlePromise = _(bundler.bundle()).toPromise(Promise);

    bundlePromise
      .then(() => {
        expect(cache[0].id).to.equal('prelude');
        expect(cache[1].id).to.equal(path.join(__dirname, 'input', 'a.js'));
        expect(cache[2].id).to.equal(path.join(__dirname, 'input', 'b.js'));
        expect(cache[3].id).to.equal('postlude');
        expectedOutput.forEach((output, index) => {
          expect(cache[index].content).to.equal(output.slice(0, -1)); // (exclude \n)
        });
      })
      .then(() => done())
      .catch(done);
  });

  it ('includes files in cache that are missing in bundle', function (done) {
    const cache = [{
        id: 'c',
        content: 'foo'
      }],
      bundler = browserify({fullPaths: true})
        .require(path.join(__dirname, 'input', './a.js'))
        .plugin(browserifyGlobalPack, {
          cache,
          writeToDir: path.join(__dirname, 'bundle')
        }),
      bundlePromise = _(bundler.bundle()).toPromise(Promise);

    bundlePromise
      .then(() => {
        assertOut('c.js', 'foo\n');
      })
      .then(() => done())
      .catch(done);
  });

  it ('does not overwrite files in bundle with files in cache', function (done) {
    const cache = [{
        id: path.join(__dirname, 'input', 'a.js'),
        content: 'foo'
      }],
      bundler = browserify({fullPaths: true})
        .require(path.join(__dirname, 'input', './a.js'))
        .plugin(browserifyGlobalPack, {
          cache,
          writeToDir: path.join(__dirname, 'bundle')
        }),
      bundlePromise = _(bundler.bundle()).toPromise(Promise);

    bundlePromise
      .then(() => {
        assertOut('a.js', expectedOutput[1]);
      })
      .then(() => done())
      .catch(done);
  });

});

/**
 * Assert that the file at ./bundle/$filename has the expected content.
 * @param {string} filename
 * @param {string} content
 */
function assertOut(filename, content) {
  assertFileContent(path.join(__dirname, 'bundle', filename), content);
}

function assertFileContent(file, content) {
  expect(fs.readFileSync(file, 'utf8')).to.equal(content);
}

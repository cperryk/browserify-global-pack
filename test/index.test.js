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

  it ('throws error if writeToDir is not specified', function () {
    expect(()=>browserifyGlobalPack()).to.throw(Error);
  });

  it('writes global-pack chunks to files in the directory specified by writeToDir', function (done) {
    const bundler = browserify({fullPaths: true})
        .require(path.join(__dirname, 'input', './a.js'))
        .plugin(browserifyGlobalPack, {
          writeToDir: path.join(__dirname, 'bundle')
        }),
      bundlePromise = _(bundler.bundle()).toPromise(Promise);

    bundlePromise.then(() => {
      EXPECTED_FILES.forEach((filename, index) => {
        assertFileContent(path.join(__dirname, './bundle', filename), expectedOutput[index]);
      });
      done();
    });
  });

  it('passes scope option to global-pack', function (done) {
    const bundler = browserify({fullPaths: true})
        .require(path.join(__dirname, 'input', './a.js'))
        .plugin(browserifyGlobalPack, {
          writeToDir: path.join(__dirname, 'bundle'),
          scope: 'foo.bar'
        }),
      bundlePromise = _(bundler.bundle()).toPromise(Promise);

    bundlePromise.then(()=>{
      EXPECTED_FILES.forEach((filename, index)=> {
        assertFileContent(path.join(__dirname, 'bundle', filename), expectedOutput[index].replace(/window.scope/g, 'foo.bar'));
      });
      done();
    });
  });

  it ('works with expose', function () {
    const bundler = browserify({fullPaths: true})
        .require({
          file: path.join(__dirname, 'input', './a.js'),
          expose: 'foo'
        })
        .plugin(browserifyGlobalPack, {
          writeToDir: path.join(__dirname, 'bundle'),
        }),
      bundlePromise = _(bundler.bundle()).toPromise(Promise);

    bundlePromise.then(() => {
      assertFileContent(path.join(__dirname, 'bundle', 'foo.js'), expectedOutput[1]);
      done();
    });
  });
});

function assertFileContent(file, content) {
  expect(fs.readFileSync(file, 'utf8')).to.equal(content);
}

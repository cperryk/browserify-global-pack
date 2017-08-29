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
          assertFileContent(path.join(__dirname, './bundle', filename), expectedOutput[index]);
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
          assertFileContent(path.join(__dirname, 'bundle', filename), expectedOutput[index].replace(/window.modules/g, 'foo.bar'));
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
          assertFileContent(path.join(__dirname, 'bundle', 'out-' + index + '.js'), expectedOutput[index]);
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
        assertFileContent(path.join(__dirname, 'bundle', 'out-0.js'), expectedOutput[0] + expectedOutput[1]);
        assertFileContent(path.join(__dirname, 'bundle', 'out-1.js'), expectedOutput[2] + expectedOutput[3]);
      })
      .then(() => done())
      .catch(done);
  });
});

function assertFileContent(file, content) {
  expect(fs.readFileSync(file, 'utf8')).to.equal(content);
}

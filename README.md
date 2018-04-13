# browserify-global-pack

Split your Browserify bundle into separate module files so that each can be embedded via a `<script>` tag.

Similar to [browserify-splitter](https://www.npmjs.com/package/browserify-splitter), but outputs valid JS files instead of JS "chunks."

## Example

```
// a.js
module.exports = () => require('b')()
```

```
// b.js
module.exports = () => console.log('b');
```

```
const browserify = require('browserify'),
  bundler = browserify('./a.js'),
  browserifyGlobalPack = require('browserify-global-pack');

bundler.plugin(browserifyGlobalPack, {
  writeToDir: './bundle'
});
```

Results in **four** files:

* `bundle/prelude.js`: Declares `window.modules` object. Must be embedded before other scripts.
* `bundle/a.js`: Adds module `a` to `window.modules`.
* `bundle/b.js`: Adds module `b` to `window.modules`.
* `bundle/postlude.js`: Defines `require` and mounts require context.

## Options

* `writeToDir`: Mandatory unless `getOutfile` is set. String describing the path to the directory where deps will be saved.
* `getOutfile`: Mandatory unless `writeToDir` is set. Function. The first argument is a module-dep object. Every dep in the bundle passes through this function, which should return the path (string) to which the dep should be saved. If this function returns the same path for multiple deps, those deps will be combined into one file. If the function returns an array, the dep will be written to multiple files. Examples:
  * `(dep) => path.join('bundle', 'dep-' + dep.id + '.js')` saves deps to the `bundle` folder and prefix their filenames with `dep-`.
  * `(dep) => 'deps.js'` save all deps to a single file, `deps.js`.
  * `(dep) => path.join('bundle', (dep.id === 'a' || dep.id === 'b') ? 'group1.js' : 'group2.js')` saves modules `a` and `b` to a `group1.js` file and all other deps to a `group2.js` file.
  * `(dep) => ['a.js', 'b.js']` save all deps to two files, `a.js` and `b.js`.
* `cache`: Optional. Array. If set, this plugin will save all deps to this array before writing them out. If deps are already in this array when bundling, any deps in it that do not appear in the bundle will be added to the bundle.
* `scope`: Optional. String. [Global-pack](https://www.npmjs.com/package/global-pack) scope. Defaults to `window.modules`.
* `verbose`: Optional. Boolean. If `true`, log each time a dep is written.

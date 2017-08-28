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
* `bundle/a.js`: Adds `a` module to `window.modules`.
* `bundle/b.js`: Adds `b` module to `window.modules`.
* `bundle/postlude.js`: Defines `require` and mounts require context.

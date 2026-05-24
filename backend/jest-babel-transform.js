const babel = require('@babel/core');

module.exports = {
  process(src, filename) {
    const result = babel.transformSync(src, {
      filename,
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              node: '14.18',
            },
          },
        ],
      ],
      sourceType: 'module',
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });

    return {
      code: result.code,
      map: result.map,
    };
  },
};

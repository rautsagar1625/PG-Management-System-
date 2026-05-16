module.exports = function (options) {
  return {
    ...options,
    externals: [
      function ({ request }, callback) {
        // Bundle all @pg-system/* workspace packages instead of treating them
        // as node_modules externals — they ship as raw TypeScript source
        if (request && request.startsWith('@pg-system/')) {
          return callback();
        }
        // Default NestJS behavior: externalize everything else in node_modules
        if (
          request &&
          !request.startsWith('.') &&
          !request.startsWith('@pg-system/')
        ) {
          return callback(null, 'commonjs ' + request);
        }
        callback();
      },
    ],
  };
};

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { defineConfig } = require('prisma/config');

// WHY: Prisma 7 requires prisma.config.js to use module.exports (not exports.default).
// TypeScript compiles `export default` to `exports.default`, which Prisma cannot find.
// Writing this as plain CJS avoids the mismatch.
module.exports = defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env['HR_CORE_DATABASE_URL'],
  },
});

/**
 * Prettier owns formatting in this repo (eslint.config.mjs spreads
 * eslint-config-prettier to defer stylistic rules to it). The codebase is
 * written with single quotes, so set that here; everything else is Prettier's
 * defaults (semicolons, 2-space indent, 80 columns, trailing commas).
 *
 * @type {import("prettier").Config}
 */
const config = {
  singleQuote: true,
};

export default config;

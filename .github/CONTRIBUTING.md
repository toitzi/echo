# Contribution Guide

The Laravel contributing guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

# Installation

This monorepo contains three packages:

-   [laravel-echo](https://www.npmjs.com/package/laravel-echo)
-   [@laravel/echo-react](https://www.npmjs.com/package/@laravel/echo-react)
-   [@laravel/echo-vue](https://www.npmjs.com/package/@laravel/echo-vue)

[pnpm](https://pnpm.io/) is used to manage dependencies, the repo is set up as a workspace. Each package lives under `packages/*`

From the root directory, install dependencies for all packages:

```bash
pnpm i
```

## Running Tests

Tests are written with [Vitest](https://vitest.dev/).

To run all tests, from the root directory:

```bash
pnpm -r run test
```

To run tests for an individual package:

```bash
cd packages/react
pnpm run test
```

## Publishing

This section is really for the benefit of the core maintainers. From the root directory:

```bash
./release
```

<!-- TITLE/ -->

<h1>integration</h1>

<!-- /TITLE -->


<!-- BADGES/ -->

<span class="badge-travisci"><a href="http://travis-ci.org/asset-pipe/integration" title="Check this project's build status on TravisCI"><img src="https://img.shields.io/travis/asset-pipe/integration/master.svg" alt="Travis CI Build Status" /></a></span>
<span class="badge-npmversion"><a href="https://npmjs.org/package/integration" title="View this project on NPM"><img src="https://img.shields.io/npm/v/integration.svg" alt="NPM version" /></a></span>
<span class="badge-daviddm"><a href="https://david-dm.org/asset-pipe/integration" title="View the status of this project's dependencies on DavidDM"><img src="https://img.shields.io/david/asset-pipe/integration.svg" alt="Dependency Status" /></a></span>
<span class="badge-daviddmdev"><a href="https://david-dm.org/asset-pipe/integration#info=devDependencies" title="View the status of this project's development dependencies on DavidDM"><img src="https://img.shields.io/david/dev/asset-pipe/integration.svg" alt="Dev Dependency Status" /></a></span>

<!-- /BADGES -->


Integration verification module. Tests various integrated usage scenarios.

## Areas of test coverage

type | description
---|---
single client | Isolated single client to server feed upload and bundle
multi client | Simultaneous multi client to single server feed upload and bundle
scenario | Setups for more realistic real world scenarios

### Single Client

These tests verify simple correct behavior between a single instance of the asset-pipe-client and a 
single asset-pipe-build-server.

### Multi Client

These tests verify more complex behavior between a multiple instances of the asset-pipe-client and a 
single asset-pipe-build-server.

### Scenarios

These involve simulating a single coordinating server and multiple dependents.
Dependents upload their js and css assets to the asset pipe build server. The coordinating server then also uploads
its js and css assets to the build server before finally bundling everything together. Server latency is randomly 
introduced during the process.

## Goals

- Provide test coverage of the integration of the various modules in the asset-pipe project
- Give early warning if one of the asset-pipe modules publishes changes that break the integration of the project as a whole

### Early warning

Dependencies are set to latest and package lock is ignored. CI cache is not used. All this to ensure than when a test runs
it runs against the latest versions of the asset-pipe-client and asset-pipe-build-server. Greenkeeper is also used to trigger
runs whenever one of the asset-pipe modules is publishes a new version.

## Contributing

The contribution process is as follows:

- Fork this repository.
- Make your changes as desired.
- Run the tests using `npm test`. This will also check to ensure that 100% code coverage is maintained. If not you may need to add additional tests.
- Stage your changes.
- Run `git commit` or, if you are not familiar with [semantic commit messages](https://docs.google.com/document/d/1QrDFcIiPjSLDn3EL15IJygNPiHORgU1_OOAqWjiDU5Y/edit), please run `npm run cm` and follow the prompts instead which will help you write a correct semantic commit message.
- Push your changes and submit a PR.

### A note on running tests locally

Some tests (google sink tests) rely on credentials for google cloud storage. 
These will run correctly on CI so you may need to rely on those if you don't have access to our travis setup.

Credentials are encrypted using travis cli. https://github.com/travis-ci/travis.rb#encrypt-file
which should also allow you to decrypt a copy for local use if you have access to our travis account.

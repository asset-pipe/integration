'use strict';

const { resolve } = require;
const { spawn } = require('child_process');
const Client = require('@asset-pipe/client');
const buildServerUri = 'http://127.0.0.1:7202';
const supertest = require('supertest');
const request = supertest(buildServerUri);
const { hashArray } = require('../../utils');
const {
    endWorkers,
} = require('../../node_modules/@asset-pipe/server/lib/utils');

let server;

function startServer(env = 'development') {
    return new Promise((resolve, reject) => {
        server = spawn('./node_modules/.bin/asset-pipe-server', [], {
            env: Object.assign({}, process.env, {
                NODE_ENV: env,
                PORT: 7202,
            }),
        });
        server.stdout.once('data', () => resolve());
        server.stderr.once('data', () => resolve());
        server.once('error', err => reject(err));
    });
}

function stopServer() {
    return new Promise(resolve => {
        server.once('close', () => resolve());
        server.kill();
    });
}

beforeEach(() => {
    jest.setTimeout(20000);
    return startServer();
});

afterEach(() => stopServer());

afterAll(() => endWorkers());

test('complex bundling multiple assets', async () => {
    expect.hasAssertions();
    const client = new Client({ buildServerUri });

    const [podletA, podletB, podletC, podletE] = await Promise.all([
        Promise.all([
            client.publishAssets('podletA', [resolve('../../assets/a.js')]),
            client.publishAssets('podletA', [resolve('../../assets/a.css')]),
        ]),
        Promise.all([
            client.publishAssets('podletB', [resolve('../../assets/b.js')]),
            client.publishAssets('podletB', [resolve('../../assets/b.css')]),
        ]),
        Promise.all([
            client.publishAssets('podletC', [resolve('../../assets/c.js')]),
            client.publishAssets('podletC', [resolve('../../assets/c.css')]),
        ]),
        Promise.all([
            client.publishAssets('podletE', [resolve('../../assets/e.js')]),
            client.publishAssets('podletE', [resolve('../../assets/e.css')]),
        ]),
    ]);

    await Promise.all([
        client.publishInstructions('layout', 'js', [
            'podletA',
            'podletB',
            'podletC',
            'podletE',
        ]),
        client.publishInstructions('layout', 'css', [
            'podletA',
            'podletB',
            'podletC',
            'podletE',
        ]),
    ]);

    const jsBundleHash = await hashArray([
        podletA[0].id,
        podletB[0].id,
        podletC[0].id,
        podletE[0].id,
    ]);

    const cssBundleHash = await hashArray([
        podletA[1].id,
        podletB[1].id,
        podletC[1].id,
        podletE[1].id,
    ]);

    const [{ text: jsBundle }, { text: cssBundle }] = await Promise.all([
        request.get(`/bundle/${jsBundleHash}.js`),
        request.get(`/bundle/${cssBundleHash}.css`),
    ]);

    expect(jsBundle).toMatchSnapshot();
    expect(cssBundle).toMatchSnapshot();
});

'use strict';

const express = require('express');
const { resolve } = require('path');
const supertest = require('supertest');
const Client = require('@asset-pipe/client');
const AssetServer = require('@asset-pipe/server');
const AssetSinkGCS = require('@asset-pipe/sink-gcs');
const { hashArray } = require('../../utils');
const {
    endWorkers,
} = require('../../node_modules/@asset-pipe/server/lib/utils');

async function startTestServer(sink) {
    const app = express();
    const assets = new AssetServer(sink);
    app.use(assets.router());
    return new Promise(resolve => {
        const server = app.listen(() => {
            resolve({
                server,
                port: server.address().port,
            });
        });
    });
}

function closeTestServer(server) {
    return new Promise(resolve => {
        server.once('close', () => resolve());
        server.kill();
    });
}

function clean(data) {
    const reg1 = /http:\/\/127\.0\.0\.1:[0-9]+\//g;
    const reg2 = /"(\/[A-Za-z]+)+\/asset-pipe/gm;
    const str = JSON.stringify(data, null, 2).replace(reg1, '/');
    return JSON.parse(str.replace(reg2, '"asset-pipe'));
}

afterAll(() => endWorkers());

let server;
let port;
let client;
let get;

beforeAll(async () => {
    jest.setTimeout(30000);
    const sink = new AssetSinkGCS(
        {
            projectId: 'asset-pipe-184710', // 679641587805
            keyFilename: './gcs.json',
        },
        'asset-pipe-integration-tests'
    );
    return new Promise(resolve => {
        sink.on('storage info', () => {
            Promise.resolve().then(async () => {
                const started = await startTestServer(sink);
                server = started.server;
                port = started.port;
                get = supertest(`http://127.0.0.1:${port}`).get;
                client = new Client({
                    buildServerUri: `http://127.0.0.1:${port}`,
                });
                resolve();
            });
        });
    });
});

afterAll(async () => {
    await closeTestServer(server);
});

test('javascript upload', async () => {
    expect.assertions(1);
    const upload = await client.uploadFeed([resolve('assets/a.js')]);

    expect(clean(upload)).toMatchSnapshot();
});

test('javascript upload feed fetching', async () => {
    expect.assertions(1);
    const upload = await client.uploadFeed([resolve('assets/a.js')]);
    const { body } = await get(`/feed/${upload.file}`);
    expect(clean(body)).toMatchSnapshot();
});

test('javascript bundling', async () => {
    expect.assertions(1);
    const upload = await client.uploadFeed([resolve('assets/a.js')]);
    const bundle = await client.createRemoteBundle([upload.file], 'js');

    expect(clean(bundle)).toMatchSnapshot();
});

test('javascript bundle fetching', async () => {
    expect.assertions(3);
    const upload = await client.uploadFeed([resolve('assets/a.js')]);
    const bundle = await client.createRemoteBundle([upload.file], 'js');
    const res = await get(`/feed/${bundle.file}`);
    const { headers } = await supertest('https://www.googleapis.com').get(
        `/download/storage/v1/b/asset-pipe-integration-tests/o/${
            bundle.file
        }?alt=media`
    );

    expect(headers['content-type']).toMatch(/application\/javascript/);
    expect(res.headers['content-type']).toMatch(/application\/javascript/);
    expect(clean(res.body)).toMatchSnapshot();
});

test('css upload', async () => {
    expect.assertions(1);
    const feeds = [resolve('assets/style.css')];
    const upload = await client.uploadFeed(feeds);

    expect(clean(upload)).toMatchSnapshot();
});

test('css upload feed fetching', async () => {
    expect.assertions(2);
    const feeds = [resolve('assets/style.css')];
    const upload = await client.uploadFeed(feeds);
    const res = await get(`/feed/${upload.file}`);

    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(clean(res.body)).toMatchSnapshot();
});

test('css bundling', async () => {
    expect.assertions(1);
    const feeds = [resolve('assets/style.css')];
    const upload = await client.uploadFeed(feeds);
    const bundle = await client.createRemoteBundle([upload.file], 'css');

    expect(clean(bundle)).toMatchSnapshot();
});

test('css bundle fetching', async () => {
    expect.assertions(3);
    const feeds = [resolve('assets/style.css')];
    const upload = await client.uploadFeed(feeds);
    const bundle = await client.createRemoteBundle([upload.file], 'css');
    const res = await get(`/feed/${bundle.file}`).set('Accept', 'text/css');

    const { headers } = await supertest('https://www.googleapis.com').get(
        `/download/storage/v1/b/asset-pipe-integration-tests/o/${
            bundle.file
        }?alt=media`
    );

    expect(headers['content-type']).toMatch(/text\/css/);
    expect(res.headers['content-type']).toMatch(/text\/css/);
    expect(clean(res.body)).toMatchSnapshot();
});

test('bulk javascript bundling', async () => {
    expect.assertions(2);

    const Storage = require('@google-cloud/storage');

    const file1 =
        'b8bde8bab4af3df184ee4cfff61998233c7cd7b0cc9522a982b1925cc11992b5.json';
    const file2 =
        'f4256d8dff32300ea15f41d0ff22cdc71016b2c663b6c7b89ab177df41c38d7f.json';
    const file3 =
        '6171e3331f55b38dd0864fe66d9b2193245ada687b90176ec772fc5d396fbc1c.json';
    const file4 =
        'a8b23f7fafde9106901db75df2c0d28214b6b00c02bb6c383339827bd7819036.json';
    const file5 =
        'def53011b9500e7b9feb1f07ed00bcf68cc6ff04636799b02ed7e4dacfbce9b5.json';

    // Creates a client
    const storage = new Storage({
        projectId: 'asset-pipe-184710',
        keyFilename: './gcs.json',
    });

    const bucket = await storage.bucket('asset-pipe-integration-tests');

    const feed1 = await bucket.file(file1);
    const feed2 = await bucket.file(file2);
    const feed3 = await bucket.file(file3);
    const feed4 = await bucket.file(file4);
    const feed5 = await bucket.file(file5);

    await Promise.all([
        feed1.save(JSON.stringify(require(`../../assets/${file1}`))),
        feed2.save(JSON.stringify(require(`../../assets/${file2}`))),
        feed3.save(JSON.stringify(require(`../../assets/${file3}`))),
        feed4.save(JSON.stringify(require(`../../assets/${file4}`))),
        feed5.save(JSON.stringify(require(`../../assets/${file5}`))),
    ]);

    function doBundle() {
        return client.createRemoteBundle(
            [file1, file2, file3, file4, file5],
            'js'
        );
    }

    let results = [];

    for (let i = 0; i < 2; i++) {
        let a = new Array(10);
        a = a.join(',').split(',');
        const res = await Promise.all(a.map(doBundle));
        results = results.concat(res);
    }

    const uniquefileHashes = new Set(results.map(i => i.file));

    expect(results.length).toBe(20);
    expect(Array.from(uniquefileHashes).length).toBe(1);
});

test('javascript bundling using optimistic bundling', async () => {
    expect.hasAssertions();
    const { resolve } = require;

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
        get(`/bundle/${jsBundleHash}.js`),
        get(`/bundle/${cssBundleHash}.css`),
    ]);

    expect(jsBundle).toMatchSnapshot();
    expect(cssBundle).toMatchSnapshot();
});

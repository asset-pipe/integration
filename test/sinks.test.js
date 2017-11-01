'use strict';

const express = require('express');
const { resolve } = require('path');
const supertest = require('supertest');
const Client = require('asset-pipe-client');
const AssetServer = require('asset-pipe-build-server');
const AssetSinkFS = require('asset-pipe-sink-fs');
const AssetSinkGCS = require('asset-pipe-sink-gcs');

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
        server.close(resolve);
    });
}

function clean(data) {
    const reg1 = /http:\/\/127\.0\.0\.1:[0-9]+\//g;
    const reg2 = /"(\/[A-Za-z]+)+\/asset-pipe/gm;
    const str = JSON.stringify(data, null, 2).replace(reg1, '/');
    return JSON.parse(str.replace(reg2, '"asset-pipe'));
}

describe('asset-pipe-sink-fs', () => {
    let server;
    let port;
    let client;
    let get;

    beforeAll(async () => {
        const path = resolve(__dirname, '../assets/fs-sink');
        const sink = new AssetSinkFS({ path });
        const started = await startTestServer(sink);
        server = started.server;
        port = started.port;
        get = supertest(`http://127.0.0.1:${port}`).get;
        client = new Client({
            buildServerUri: `http://127.0.0.1:${port}`,
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
        expect.assertions(1);
        const upload = await client.uploadFeed([resolve('assets/a.js')]);
        const bundle = await client.createRemoteBundle([upload.file], 'js');
        const { body } = await get(`/feed/${bundle.file}`);

        expect(clean(body)).toMatchSnapshot();
    });

    test('css upload', async () => {
        expect.assertions(1);
        const feeds = [resolve('assets/style.css')];
        const upload = await client.uploadFeed(feeds);

        expect(clean(upload)).toMatchSnapshot();
    });

    test('css upload feed fetching', async () => {
        expect.assertions(1);
        const feeds = [resolve('assets/style.css')];
        const upload = await client.uploadFeed(feeds);
        const { body } = await get(`/feed/${upload.file}`);

        expect(clean(body)).toMatchSnapshot();
    });

    test('css bundling', async () => {
        expect.assertions(1);
        const feeds = [resolve('assets/style.css')];
        const upload = await client.uploadFeed(feeds);
        const bundle = await client.createRemoteBundle([upload.file], 'css');

        expect(clean(bundle)).toMatchSnapshot();
    });

    test('css bundle fetching', async () => {
        expect.assertions(1);
        const feeds = [resolve('assets/style.css')];
        const upload = await client.uploadFeed(feeds);
        const bundle = await client.createRemoteBundle([upload.file], 'css');
        const { body } = await get(`/feed/${bundle.file}`);

        expect(clean(body)).toMatchSnapshot();
    });
});

describe('asset-pipe-sink-gcs', () => {
    let server;
    let port;
    let client;
    let get;

    beforeAll(async () => {
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
        expect.assertions(1);
        const upload = await client.uploadFeed([resolve('assets/a.js')]);
        const bundle = await client.createRemoteBundle([upload.file], 'js');
        const { body } = await get(`/feed/${bundle.file}`);

        expect(clean(body)).toMatchSnapshot();
    });

    test('css upload', async () => {
        expect.assertions(1);
        const feeds = [resolve('assets/style.css')];
        const upload = await client.uploadFeed(feeds);

        expect(clean(upload)).toMatchSnapshot();
    });

    test('css upload feed fetching', async () => {
        expect.assertions(1);
        const feeds = [resolve('assets/style.css')];
        const upload = await client.uploadFeed(feeds);
        const { body } = await get(`/feed/${upload.file}`);

        expect(clean(body)).toMatchSnapshot();
    });

    test('css bundling', async () => {
        expect.assertions(1);
        const feeds = [resolve('assets/style.css')];
        const upload = await client.uploadFeed(feeds);
        const bundle = await client.createRemoteBundle([upload.file], 'css');

        expect(clean(bundle)).toMatchSnapshot();
    });

    test('css bundle fetching', async () => {
        expect.assertions(1);
        const feeds = [resolve('assets/style.css')];
        const upload = await client.uploadFeed(feeds);
        const bundle = await client.createRemoteBundle([upload.file], 'css');
        const { body } = await get(`/feed/${bundle.file}`);

        expect(clean(body)).toMatchSnapshot();
    });
});

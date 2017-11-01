'use strict';

const { resolve } = require;
const { spawn } = require('child_process');
const Client = require('asset-pipe-client');
const buildServerUri = 'http://127.0.0.1:8300';
const supertest = require('supertest');
const request = supertest(buildServerUri);
const httpProxy = require('http-proxy');
const http = require('http');

let server;
let proxyServer;
async function startServer() {
    return new Promise((resolve, reject) => {
        server = spawn('./node_modules/.bin/asset-pipe-server', [], {
            env: Object.assign({}, process.env, {
                NODE_ENV: 'development',
                PORT: 8200,
            }),
        });
        server.stdout.once('data', () => resolve());
        server.stderr.once('data', () => resolve());
        server.once('error', err => reject(err));
        server.once('close', () => resolve());
    });
}
async function startProxyServer() {
    return new Promise(resolve => {
        const proxy = httpProxy.createProxyServer();
        proxyServer = http
            .createServer((req, res) => {
                const random = Math.random() * 1500 + 200;
                setTimeout(() => {
                    proxy.web(req, res, {
                        target: 'http://127.0.0.1:8200',
                    });
                }, random);
            })
            .listen(8300, resolve);
    });
}

beforeAll(async () => {
    await startServer();
    return startProxyServer();
});
afterAll(() => {
    server.kill();
    proxyServer.close();
});

async function podlet(label) {
    const js = resolve(`../assets/${label}.js`);
    const css = resolve(`../assets/${label}.css`);
    const client = new Client({ buildServerUri });
    const [{ file: jsFeedFile }, { file: cssFeedFile }] = await Promise.all([
        client.uploadFeed([js]),
        client.uploadFeed([css]),
    ]);
    return { jsFile: jsFeedFile, cssFile: cssFeedFile, client };
}

async function layout(label, podlets) {
    // layout uploads own assets (using podlet helper)
    const { jsFile, cssFile, client } = await podlet(label);

    const jsFeeds = [jsFile];
    const cssFeeds = [cssFile];
    for (const pod of podlets) {
        jsFeeds.push(pod.jsFile);
        cssFeeds.push(pod.cssFile);
    }

    const res1 = await client.createRemoteBundle(jsFeeds, 'js');
    const res2 = await client.createRemoteBundle(cssFeeds, 'css');
    return { jsFile: res1.file, cssFile: res2.file };
}

test('Layout and 3 podlets - run 1 - initial', async () => {
    expect.assertions(2);
    jest.setTimeout(20000);
    const podlets = await Promise.all([podlet('a'), podlet('b'), podlet('c')]);
    const { jsFile, cssFile } = await layout('e', podlets);

    const { text: jsBundle } = await request
        .get(`/bundle/${jsFile}`)
        .expect(200);

    const { text: cssBundle } = await request
        .get(`/bundle/${cssFile}`)
        .expect(200);

    expect(jsBundle).toMatchSnapshot();
    expect(cssBundle).toMatchSnapshot();
});

test('Layout and 3 podlets - run 2 - identical to run 1', async () => {
    expect.assertions(2);
    jest.setTimeout(20000);
    const podlets = await Promise.all([podlet('a'), podlet('b'), podlet('c')]);
    const { jsFile, cssFile } = await layout('e', podlets);

    const { text: jsBundle } = await request
        .get(`/bundle/${jsFile}`)
        .expect(200);

    const { text: cssBundle } = await request
        .get(`/bundle/${cssFile}`)
        .expect(200);

    expect(jsBundle).toMatchSnapshot();
    expect(cssBundle).toMatchSnapshot();
});

test('Layout and 3 podlets - run 3 - swapped bundling order', async () => {
    expect.assertions(2);
    jest.setTimeout(20000);
    const podlets = await Promise.all([podlet('b'), podlet('c'), podlet('a')]);
    const { jsFile, cssFile } = await layout('e', podlets);

    const { text: jsBundle } = await request
        .get(`/bundle/${jsFile}`)
        .expect(200);

    const { text: cssBundle } = await request
        .get(`/bundle/${cssFile}`)
        .expect(200);

    expect(jsBundle).toMatchSnapshot();
    expect(cssBundle).toMatchSnapshot();
});

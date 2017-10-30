'use strict';

const { join } = require('path');
const { spawn } = require('child_process');
const Client = require('asset-pipe-client');
const buildServerUri = 'http://127.0.0.1:7200';
const client = new Client({ buildServerUri });
const supertest = require('supertest');
const request = supertest(buildServerUri);

let server;
beforeAll(
    () =>
        new Promise((resolve, reject) => {
            server = spawn('./node_modules/.bin/asset-pipe-server', [], {
                env: Object.assign({}, process.env, {
                    NODE_ENV: 'development',
                    PORT: 7200,
                }),
            });
            server.stdout.once('data', () => resolve());
            server.stderr.once('data', () => resolve());
            server.once('error', err => reject(err));
            server.once('close', () => resolve());
        })
);
afterAll(() => {
    server.kill();
});

async function podlet(label) {
    const js = join(__dirname, '..', 'assets', `${label}.js`);
    const css = join(__dirname, '..', 'assets', `${label}.css`);
    const cl = new Client({ buildServerUri });
    const [{ file: jsFeedFile }, { file: cssFeedFile }] = await Promise.all([
        cl.uploadFeed([js]),
        cl.uploadFeed([css]),
    ]);
    return { jsFile: jsFeedFile, cssFile: cssFeedFile };
}

async function layout(label, podlets) {
    // layout uploads own assets (using podlet helper)
    const { jsFile, cssFile } = await podlet(label);

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

test('Layout and 3 podlets', async () => {
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

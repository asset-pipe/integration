'use strict';

const { resolve } = require;
const { spawn } = require('child_process');
const Client = require('@asset-pipe/client');
const buildServerUri = 'http://127.0.0.1:7200';
const client = new Client({ buildServerUri });
const supertest = require('supertest');
const request = supertest(buildServerUri);

const get = async url => {
    const { body } = await request
        .get(url)
        .set('Accept', 'application/json')
        .expect('Content-Type', /application\/json/)
        .expect(200);
    return body;
};

const localiseBodyPaths = body =>
    JSON.parse(
        JSON.stringify(body, null, 2).replace(
            /"file":\s".*\/asset-pipe\//g,
            '"file": "'
        )
    );

let server;
beforeAll(() => {
    jest.setTimeout(20000);
    return new Promise((resolve, reject) => {
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
    });
});
afterAll(() => {
    server.kill();
});

test('Multiple clients upload js feeds to build server', async () => {
    expect.assertions(1);
    const js1 = resolve('../assets/a.js');
    const js2 = resolve('../assets/b.js');
    const js3 = resolve('../assets/c.js');
    const result = await Promise.all([
        client.uploadFeed([js1]),
        client.uploadFeed([js2]),
        client.uploadFeed([js3]),
    ]);
    expect(result).toMatchSnapshot();
});

test('Multiple clients upload css feeds to build server', async () => {
    expect.assertions(1);
    const css1 = resolve('../assets/a.css');
    const css2 = resolve('../assets/b.css');
    const css3 = resolve('../assets/c.css');
    const result = await Promise.all([
        client.uploadFeed([css1]),
        client.uploadFeed([css2]),
        client.uploadFeed([css3]),
    ]);
    expect(result).toMatchSnapshot();
});

test('Multiple clients get uploaded js feeds from build server', async () => {
    expect.assertions(1);
    const js1 = resolve('../assets/a.js');
    const js2 = resolve('../assets/b.js');
    const js3 = resolve('../assets/c.js');
    const [{ file: f1 }, { file: f2 }, { file: f3 }] = await Promise.all([
        client.uploadFeed([js1]),
        client.uploadFeed([js2]),
        client.uploadFeed([js3]),
    ]);
    const result = await Promise.all([
        get(`/feed/${f1}`),
        get(`/feed/${f2}`),
        get(`/feed/${f3}`),
    ]);
    expect(localiseBodyPaths(result)).toMatchSnapshot();
});

test('Multiple clients get uploaded css feeds from build server', async () => {
    expect.assertions(1);
    const css1 = resolve('../assets/a.css');
    const css2 = resolve('../assets/b.css');
    const css3 = resolve('../assets/c.css');
    const [{ file: f1 }, { file: f2 }, { file: f3 }] = await Promise.all([
        client.uploadFeed([css1]),
        client.uploadFeed([css2]),
        client.uploadFeed([css3]),
    ]);
    const result = await Promise.all([
        get(`/feed/${f1}`),
        get(`/feed/${f2}`),
        get(`/feed/${f3}`),
    ]);
    expect(result).toMatchSnapshot();
});

test('Client requests bundling of a js feed on build server', async () => {
    expect.assertions(1);
    const js1 = resolve('../assets/a.js');
    const js2 = resolve('../assets/b.js');
    const js3 = resolve('../assets/c.js');
    const [{ file: f1 }, { file: f2 }, { file: f3 }] = await Promise.all([
        client.uploadFeed([js1]),
        client.uploadFeed([js2]),
        client.uploadFeed([js3]),
    ]);
    const bundleResponse = await client.createRemoteBundle([f1, f2, f3], 'js');
    expect(bundleResponse).toMatchSnapshot();
});

test('Client requests bundling of a css feed on build server', async () => {
    expect.assertions(1);
    const css1 = resolve('../assets/a.css');
    const css2 = resolve('../assets/b.css');
    const css3 = resolve('../assets/c.css');
    const [{ file: f1 }, { file: f2 }, { file: f3 }] = await Promise.all([
        client.uploadFeed([css1]),
        client.uploadFeed([css2]),
        client.uploadFeed([css3]),
    ]);
    const bundleResponse = await client.createRemoteBundle([f1, f2, f3], 'css');
    expect(bundleResponse).toMatchSnapshot();
});

test('Client gets bundled js file from build server', async () => {
    expect.assertions(1);
    const js1 = resolve('../assets/a.js');
    const js2 = resolve('../assets/b.js');
    const js3 = resolve('../assets/c.js');
    const [{ file: f1 }, { file: f2 }, { file: f3 }] = await Promise.all([
        client.uploadFeed([js1]),
        client.uploadFeed([js2]),
        client.uploadFeed([js3]),
    ]);
    const bundleResponse = await client.createRemoteBundle([f2, f3, f1], 'js');
    const { text } = await request
        .get(`/bundle/${bundleResponse.file}`)
        .expect(200);
    expect(text).toMatchSnapshot();
});

test('Client gets bundled css file from build server', async () => {
    expect.assertions(1);
    const css1 = resolve('../assets/a.css');
    const css2 = resolve('../assets/b.css');
    const css3 = resolve('../assets/c.css');
    const [{ file: f1 }, { file: f2 }, { file: f3 }] = await Promise.all([
        client.uploadFeed([css1]),
        client.uploadFeed([css2]),
        client.uploadFeed([css3]),
    ]);
    const bundleResponse = await client.createRemoteBundle([f2, f3, f1], 'css');
    const { text } = await request
        .get(`/bundle/${bundleResponse.file}`)
        .expect(200);
    expect(text).toMatchSnapshot();
});

test('Bundled js feeds from build server are deduped', async () => {
    expect.assertions(1);
    const js1 = resolve('../assets/duped-before-uploading.js');
    const js2 = resolve('../assets/duped-before-uploading-2.js');
    const js3 = resolve('../assets/duped-before-uploading-3.js');
    const uploadResponse1 = await client.uploadFeed([js1]);
    const uploadResponse2 = await client.uploadFeed([js2]);
    const uploadResponse3 = await client.uploadFeed([js3]);
    const bundleResponse = await client.createRemoteBundle(
        [uploadResponse1.file, uploadResponse2.file, uploadResponse3.file],
        'js'
    );
    const { text } = await request
        .get(`/bundle/${bundleResponse.file}`)
        .expect(200);
    expect(text).toMatchSnapshot();
});

'use strict';

const { resolve } = require;
const { spawn } = require('child_process');
const Client = require('@asset-pipe/client');
const buildServerUri = 'http://127.0.0.1:7100';
const client = new Client({ buildServerUri });
const supertest = require('supertest');
const request = supertest(buildServerUri);

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

test('Client uploads a js feed to build server', async () => {
    expect.assertions(1);
    const result = await client.uploadFeed([resolve('../assets/index.js')]);
    expect(result).toMatchSnapshot();
});

test('Client gets uploaded js feed from build server', async () => {
    expect.assertions(1);
    const result = await client.uploadFeed([resolve('../assets/index.js')]);
    const { body } = await request
        .get(`/feed/${result.file}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /application\/json/)
        .expect(200);
    expect(localiseBodyPaths(body)).toMatchSnapshot();
});

test('Client uploads a css feed to build server', async () => {
    expect.assertions(1);
    const result = await client.uploadFeed([resolve('../assets/style.css')]);
    expect(result).toMatchSnapshot();
});

test('Client gets uploaded css feed from build server', async () => {
    expect.assertions(1);
    const result = await client.uploadFeed([resolve('../assets/style.css')]);
    const { body } = await request
        .get(`/feed/${result.file}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /application\/json/)
        .expect(200);
    expect(body).toMatchSnapshot();
});

test('Client requests bundling of a js feed on build server', async () => {
    expect.assertions(1);
    const uploadResponse = await client.uploadFeed([
        resolve('../assets/index.js'),
    ]);
    const bundleResponse = await client.createRemoteBundle(
        [uploadResponse.file],
        'js'
    );
    expect(bundleResponse).toMatchSnapshot();
});

test('Client gets bundled js file from build server', async () => {
    expect.assertions(1);
    const uploadResponse = await client.uploadFeed([
        resolve('../assets/index.js'),
    ]);
    const bundleResponse = await client.createRemoteBundle(
        [uploadResponse.file],
        'js'
    );
    const { text } = await request
        .get(`/bundle/${bundleResponse.file}`)
        .expect(200);
    expect(text).toMatchSnapshot();
});

test('Client requests bundling of a css feed on build server', async () => {
    expect.assertions(1);
    const uploadResponse = await client.uploadFeed([
        resolve('../assets/style.css'),
    ]);
    const bundleResponse = await client.createRemoteBundle(
        [uploadResponse.file],
        'css'
    );
    expect(bundleResponse).toMatchSnapshot();
});

test('Client gets bundled css file from build server', async () => {
    expect.assertions(1);
    const uploadResponse = await client.uploadFeed([
        resolve('../assets/style.css'),
    ]);
    const bundleResponse = await client.createRemoteBundle(
        [uploadResponse.file],
        'css'
    );
    const { text } = await request
        .get(`/bundle/${bundleResponse.file}`)
        .expect(200);
    expect(text).toMatchSnapshot();
});

test('Uploaded js feed from build server is not deduped', async () => {
    expect.assertions(1);
    const result = await client.uploadFeed([
        resolve('../assets/duped-before-uploading.js'),
    ]);
    const { body } = await request
        .get(`/feed/${result.file}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /application\/json/)
        .expect(200);
    expect(localiseBodyPaths(body)).toMatchSnapshot();
});

test('Bundled js feed from build server is deduped', async () => {
    expect.assertions(1);
    const uploadResponse = await client.uploadFeed([
        resolve('../assets/duped-before-uploading.js'),
    ]);
    const bundleResponse = await client.createRemoteBundle(
        [uploadResponse.file],
        'js'
    );
    const { text } = await request
        .get(`/bundle/${bundleResponse.file}`)
        .expect(200);
    expect(text).toMatchSnapshot();
});

test('NODE_ENV variables replaced during bundling', async () => {
    expect.assertions(1);
    const uploadResponse = await client.uploadFeed([
        resolve('../assets/node_envs.js'),
    ]);
    const bundleResponse = await client.createRemoteBundle(
        [uploadResponse.file],
        'js'
    );
    const { text } = await request
        .get(`/bundle/${bundleResponse.file}`)
        .expect(200);
    expect(text).not.toMatch(`process.env.NODE_ENV === 'production'`);
});

'use strict';

const { resolve } = require;
const { spawn } = require('child_process');
const Client = require('@asset-pipe/client');
const buildServerUri = 'http://127.0.0.1:7400';
const supertest = require('supertest');
const request = supertest(buildServerUri);
const vm = require('vm');
const { hashArray } = require('../../utils');
const {
    endWorkers,
} = require('../../node_modules/@asset-pipe/server/lib/utils');

const localiseBodyPaths = body =>
    JSON.parse(
        JSON.stringify(body, null, 2).replace(
            /"file":\s".*\/asset-pipe\//g,
            '"file": "'
        )
    );

let server;

function startServer(env = 'development') {
    return new Promise((resolve, reject) => {
        server = spawn('./node_modules/.bin/asset-pipe-server', [], {
            env: Object.assign({}, process.env, {
                NODE_ENV: env,
                PORT: 7400,
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

test('Client uploads a js feed to build server', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    const result = await client.publishAssets('podlet', [
        resolve('../../assets/index.js'),
    ]);
    expect(result).toMatchSnapshot();
});

test('Client uploads a css feed to build server', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    const result = await client.publishAssets('podlet', [
        resolve('../../assets/style.css'),
    ]);
    expect(result).toMatchSnapshot();
});

test('Client gets uploaded js feed from build server', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    const { file } = await client.publishAssets('podlet', [
        resolve('../../assets/index.js'),
    ]);
    const { body } = await request
        .get(`/feed/${file}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /application\/json/)
        .expect(200);
    expect(localiseBodyPaths(body)).toMatchSnapshot();
});

test('Client gets uploaded css feed from build server', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    const { file } = await client.publishAssets('podlet', [
        resolve('../../assets/style.css'),
    ]);
    const { body } = await request
        .get(`/feed/${file}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /application\/json/)
        .expect(200);
    expect(localiseBodyPaths(body)).toMatchSnapshot();
});

test('publish assets then publish instructions', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    const { id } = await client.publishAssets('podlet', [
        resolve('../../assets/index.js'),
    ]);
    await client.publishInstructions('layout', 'js', ['podlet']);
    const hash = await hashArray([id]);
    const { text } = await request.get(`/bundle/${hash}.js`).expect(200);
    expect(text).toMatchSnapshot();
});

test('publish instructions then publish assets', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    await client.publishInstructions('layout', 'js', ['podlet']);
    const { id } = await client.publishAssets('podlet', [
        resolve('../../assets/index.js'),
    ]);
    const hash = await hashArray([id]);
    const { text } = await request.get(`/bundle/${hash}.js`).expect(200);
    expect(text).toMatchSnapshot();
});

test('Uploaded js feed from build server is not deduped', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    const result = await client.publishAssets('podlet', [
        resolve('../../assets/duped-before-uploading.js'),
    ]);
    const { body } = await request.get(`/feed/${result.file}`).expect(200);
    expect(localiseBodyPaths(body)).toMatchSnapshot();
});

test('Bundled js feed from build server is deduped', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    const { id } = await client.publishAssets('podlet', [
        resolve('../../assets/duped-before-uploading.js'),
    ]);
    await client.publishInstructions('layout', 'js', ['podlet']);

    const hash = await hashArray([id]);
    const { text } = await request.get(`/bundle/${hash}.js`).expect(200);

    expect(text).toMatchSnapshot();
});

test('NODE_ENV variables replaced with hard coded values', async () => {
    expect.assertions(5);
    const client = new Client({ buildServerUri });
    const { id } = await client.publishAssets('podlet', [
        resolve('../../assets/node_envs.js'),
    ]);
    await client.publishInstructions('layout', 'js', ['podlet']);
    const hash = await hashArray([id]);
    const { text } = await request.get(`/bundle/${hash}.js`).expect(200);
    expect(text).not.toMatch(`process.env.NODE_ENV === 'development'`);
    expect(text).not.toMatch(`process.env.NODE_ENV === 'production'`);
    expect(text).toMatch(`"development" === 'production'`);
    expect(text).toMatch(`"development" === 'development'`);
    expect(text).toMatchSnapshot();
});

test('Bundled JavaScript code is executable', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    const { id } = await client.publishAssets('podlet', [
        resolve('../../assets/executable.js'),
    ]);
    await client.publishInstructions('layout', 'js', ['podlet']);
    const hash = await hashArray([id]);
    const { text } = await request.get(`/bundle/${hash}.js`).expect(200);
    const spy = jest.fn();
    vm.runInNewContext(text, { spy });
    expect(spy).toHaveBeenCalledTimes(1);
});

test('NODE_ENV variables trigger dead code elimination (DCE)', async () => {
    expect.assertions(4);
    const client = new Client({ buildServerUri });
    await stopServer();
    await startServer('production');

    const { id } = await client.publishAssets('podlet', [
        resolve('../../assets/node_envs.js'),
    ]);
    await client.publishInstructions('layout', 'js', ['podlet']);
    const hash = await hashArray([id]);
    const { text } = await request.get(`/bundle/${hash}.js`).expect(200);
    expect(text).toMatch(`In prod!!`);
    expect(text).not.toMatch(`In dev!!`);
    expect(text).not.toMatch(`In limbo!!`);
    expect(text).toMatchSnapshot();
    await stopServer();
    await startServer();
});

'use strict';

const { resolve } = require;
const { spawn } = require('child_process');
const Client = require('@asset-pipe/client');
const buildServerUri = 'http://127.0.0.1:7100';
const supertest = require('supertest');
const request = supertest(buildServerUri);
const prettier = require('prettier');
const { IdHasher } = require('asset-pipe-common');
const { Readable } = require('readable-stream');
const vm = require('vm');
const fs = require('fs');

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

function hashArray(arr) {
    const source = new Readable({ objectMode: true, read() {} });
    const hasher = new IdHasher();

    source.pipe(hasher);

    return new Promise((resolve, reject) => {
        hasher.on('finish', () => {
            resolve(hasher.hash);
        });

        hasher.on('error', reject);

        for (const hash of arr) {
            source.push({ id: hash });
        }
        source.push(null);
    });
}

beforeEach(() => {
    jest.setTimeout(20000);
    return startServer();
});

afterEach(() => stopServer());

test('Client uploads a js feed to build server', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    const result = await client.publishAssets('podlet', [
        resolve('../assets/index.js'),
    ]);
    expect(result).toMatchSnapshot();
});

test('Client uploads a css feed to build server', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    const result = await client.publishAssets('podlet', [
        resolve('../assets/style.css'),
    ]);
    expect(result).toMatchSnapshot();
});

test('Client gets uploaded js feed from build server', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    const { file } = await client.publishAssets('podlet', [
        resolve('../assets/index.js'),
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
        resolve('../assets/style.css'),
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
        resolve('../assets/index.js'),
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
        resolve('../assets/index.js'),
    ]);
    const hash = await hashArray([id]);
    const { text } = await request.get(`/bundle/${hash}.js`).expect(200);
    expect(text).toMatchSnapshot();
});

test('scenario: 2 podlets come online after layout', async () => {
    expect.assertions(2);
    const client = new Client({ buildServerUri });

    // layout publishes instructions for js and css bundling
    await client.publishInstructions('layout', 'js', ['podlet1', 'podlet2']);
    await client.publishInstructions('layout', 'css', ['podlet1', 'podlet2']);

    // podlet 1 publishes assests
    const [p1js, p1css] = await Promise.all([
        await client.publishAssets('podlet1', [resolve('../assets/a.js')]),
        await client.publishAssets('podlet1', [resolve('../assets/a.css')]),
    ]);

    // podlet 2 publishes assests
    const [p2js, p2css] = await Promise.all([
        await client.publishAssets('podlet2', [resolve('../assets/b.js')]),
        await client.publishAssets('podlet2', [resolve('../assets/b.css')]),
    ]);

    const hash1 = await hashArray([p1js.id, p2js.id]);
    const { text: js } = await request.get(`/bundle/${hash1}.js`).expect(200);

    const hash2 = await hashArray([p1css.id, p2css.id]);
    const { text: css } = await request.get(`/bundle/${hash2}.css`).expect(200);

    expect(js).toMatchSnapshot();
    expect(css).toMatchSnapshot();
});

test('scenario: 2 podlets come online first then layout publishes after', async () => {
    expect.assertions(2);
    const client = new Client({ buildServerUri });

    // podlet 1 publishes assests
    const [p1js, p1css] = await Promise.all([
        await client.publishAssets('podlet1', [resolve('../assets/a.js')]),
        await client.publishAssets('podlet1', [resolve('../assets/a.css')]),
    ]);

    // podlet 2 publishes assests
    const [p2js, p2css] = await Promise.all([
        await client.publishAssets('podlet2', [resolve('../assets/b.js')]),
        await client.publishAssets('podlet2', [resolve('../assets/b.css')]),
    ]);

    // layout publishes instructions for js and css bundling
    await client.publishInstructions('layout', 'js', ['podlet1', 'podlet2']);
    await client.publishInstructions('layout', 'css', ['podlet1', 'podlet2']);

    const hash1 = await hashArray([p1js.id, p2js.id]);
    const { text: js } = await request.get(`/bundle/${hash1}.js`).expect(200);

    const hash2 = await hashArray([p1css.id, p2css.id]);
    const { text: css } = await request.get(`/bundle/${hash2}.css`).expect(200);

    expect(js).toMatchSnapshot();
    expect(css).toMatchSnapshot();
});

test('scenario: changes to podlets trigger rebundling', async () => {
    expect.assertions(4);
    const client = new Client({ buildServerUri });

    // podlet 1 publishes assests
    const [p1js, p1css] = await Promise.all([
        await client.publishAssets('podlet1', [resolve('../assets/c.js')]),
        await client.publishAssets('podlet1', [resolve('../assets/c.css')]),
    ]);

    // podlet 2 publishes assests
    const [p2js, p2css] = await Promise.all([
        await client.publishAssets('podlet2', [resolve('../assets/d.js')]),
        await client.publishAssets('podlet2', [resolve('../assets/d.css')]),
    ]);

    // layout publishes instructions for js and css bundling
    await client.publishInstructions('layout', 'js', ['podlet1', 'podlet2']);
    await client.publishInstructions('layout', 'css', ['podlet1', 'podlet2']);

    // podlet 1 republishes assests
    const [p1rebundlejs, p1rebundlecss] = await Promise.all([
        await client.publishAssets('podlet1', [resolve('../assets/e.js')]),
        await client.publishAssets('podlet1', [resolve('../assets/e.css')]),
    ]);

    const hash1 = await hashArray([p1js.id, p2js.id]);
    const { text: jsBundle1 } = await request
        .get(`/bundle/${hash1}.js`)
        .expect(200);
    expect(jsBundle1).toMatchSnapshot();

    const hash2 = await hashArray([p1css.id, p2css.id]);
    const { text: cssBundle1 } = await request
        .get(`/bundle/${hash2}.css`)
        .expect(200);
    expect(cssBundle1).toMatchSnapshot();

    const hash3 = await hashArray([p1rebundlejs.id, p2js.id]);
    const { text: jsBundle2 } = await request
        .get(`/bundle/${hash3}.js`)
        .expect(200);
    expect(jsBundle2).toMatchSnapshot();

    const hash4 = await hashArray([p1rebundlecss.id, p2css.id]);
    const { text: cssBundle2 } = await request
        .get(`/bundle/${hash4}.css`)
        .expect(200);
    expect(cssBundle2).toMatchSnapshot();
});

test('scenario: adding a podlet to bundle instructions generates a new bundle', async () => {
    expect.assertions(4);
    const client = new Client({ buildServerUri });

    // podlet 1 publishes assests
    const [p1js, p1css] = await Promise.all([
        await client.publishAssets('podlet1', [resolve('../assets/a.js')]),
        await client.publishAssets('podlet1', [resolve('../assets/a.css')]),
    ]);

    // podlet 2 publishes assests
    const [p2js, p2css] = await Promise.all([
        await client.publishAssets('podlet2', [resolve('../assets/b.js')]),
        await client.publishAssets('podlet2', [resolve('../assets/b.css')]),
    ]);

    // layout publishes instructions for js and css bundling of podlet1
    await client.publishInstructions('layout', 'js', ['podlet1']);
    await client.publishInstructions('layout', 'css', ['podlet1']);

    // layout publishes instructions for js and css bundling of both podlet1 and 2
    await client.publishInstructions('layout', 'js', ['podlet1', 'podlet2']);
    await client.publishInstructions('layout', 'css', ['podlet1', 'podlet2']);

    const hash1 = await hashArray([p1js.id]);
    const { text: jsBundle1 } = await request
        .get(`/bundle/${hash1}.js`)
        .expect(200);
    expect(jsBundle1).toMatchSnapshot();

    const hash2 = await hashArray([p1css.id]);
    const { text: cssBundle1 } = await request
        .get(`/bundle/${hash2}.css`)
        .expect(200);
    expect(cssBundle1).toMatchSnapshot();

    const hash3 = await hashArray([p1js.id, p2js.id]);
    const { text: jsBundle2 } = await request
        .get(`/bundle/${hash3}.js`)
        .expect(200);
    expect(jsBundle2).toMatchSnapshot();

    const hash4 = await hashArray([p1css.id, p2css.id]);
    const { text: cssBundle2 } = await request
        .get(`/bundle/${hash4}.css`)
        .expect(200);
    expect(cssBundle2).toMatchSnapshot();
});

test('scenario: removing a podlet from bundle instructions generates a new bundle', async () => {
    expect.assertions(4);
    const client = new Client({ buildServerUri });

    // podlet 1 publishes assests
    const [p1js, p1css] = await Promise.all([
        await client.publishAssets('podlet1', [resolve('../assets/a.js')]),
        await client.publishAssets('podlet1', [resolve('../assets/a.css')]),
    ]);

    // podlet 2 publishes assests
    const [p2js, p2css] = await Promise.all([
        await client.publishAssets('podlet2', [resolve('../assets/b.js')]),
        await client.publishAssets('podlet2', [resolve('../assets/b.css')]),
    ]);

    // layout publishes instructions for js and css bundling of both podlet1 and 2
    await client.publishInstructions('layout', 'js', ['podlet1', 'podlet2']);
    await client.publishInstructions('layout', 'css', ['podlet1', 'podlet2']);

    // layout publishes instructions for js and css bundling of podlet1
    await client.publishInstructions('layout', 'js', ['podlet1']);
    await client.publishInstructions('layout', 'css', ['podlet1']);

    const hash3 = await hashArray([p1js.id, p2js.id]);
    const { text: jsBundle2 } = await request
        .get(`/bundle/${hash3}.js`)
        .expect(200);
    expect(jsBundle2).toMatchSnapshot();

    const hash4 = await hashArray([p1css.id, p2css.id]);
    const { text: cssBundle2 } = await request
        .get(`/bundle/${hash4}.css`)
        .expect(200);
    expect(cssBundle2).toMatchSnapshot();

    const hash1 = await hashArray([p1js.id]);
    const { text: jsBundle1 } = await request
        .get(`/bundle/${hash1}.js`)
        .expect(200);
    expect(jsBundle1).toMatchSnapshot();

    const hash2 = await hashArray([p1css.id]);
    const { text: cssBundle1 } = await request
        .get(`/bundle/${hash2}.css`)
        .expect(200);
    expect(cssBundle1).toMatchSnapshot();
});

test('Uploaded js feed from build server is not deduped', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    const result = await client.publishAssets('podlet', [
        resolve('../assets/duped-before-uploading.js'),
    ]);
    const { body } = await request.get(`/feed/${result.file}`).expect(200);
    expect(localiseBodyPaths(body)).toMatchSnapshot();
});

test('Bundled js feed from build server is deduped', async () => {
    expect.assertions(1);
    const client = new Client({ buildServerUri });
    const { id } = await client.publishAssets('podlet', [
        resolve('../assets/duped-before-uploading.js'),
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
        resolve('../assets/node_envs.js'),
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
        resolve('../assets/executable.js'),
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
        resolve('../assets/node_envs.js'),
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

'use strict';

const { resolve } = require;
const { spawn } = require('child_process');
const Client = require('@asset-pipe/client');
const buildServerUri = 'http://127.0.0.1:7300';
const supertest = require('supertest');
const request = supertest(buildServerUri);
const vm = require('vm');
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
                PORT: 7300,
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

async function podlet(tag, label) {
    const js = resolve(`../../assets/${label}.js`);
    const css = resolve(`../../assets/${label}.css`);
    const client = new Client({ buildServerUri });
    const [{ id: jsHash }, { id: cssHash }] = await Promise.all([
        client.publishAssets(tag, [js]),
        client.publishAssets(tag, [css]),
    ]);
    return { jsHash, cssHash, client };
}

async function multiEntrypointPodlet(tag, ...labels) {
    const client = new Client({ buildServerUri });
    const [{ id: jsHash }, { id: cssHash }] = await Promise.all([
        client.publishAssets(
            tag,
            labels.map(label => resolve(`../../assets/${label}.js`))
        ),
        client.publishAssets(
            tag,
            labels.map(label => resolve(`../../assets/${label}.css`))
        ),
    ]);
    return { jsHash, cssHash, client };
}

beforeEach(() => {
    jest.setTimeout(20000);
    return startServer();
});

afterEach(() => stopServer());

afterAll(() => endWorkers());

test('scenario: 2 podlets come online after layout', async () => {
    expect.assertions(2);
    const client = new Client({ buildServerUri });

    // layout publishes instructions for js and css bundling
    await client.publishInstructions('layout', 'js', ['podlet1', 'podlet2']);
    await client.publishInstructions('layout', 'css', ['podlet1', 'podlet2']);

    // podlet 1 publishes assets
    const [p1js, p1css] = await Promise.all([
        await client.publishAssets('podlet1', [resolve('../../assets/a.js')]),
        await client.publishAssets('podlet1', [resolve('../../assets/a.css')]),
    ]);

    // podlet 2 publishes assets
    const [p2js, p2css] = await Promise.all([
        await client.publishAssets('podlet2', [resolve('../../assets/b.js')]),
        await client.publishAssets('podlet2', [resolve('../../assets/b.css')]),
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

    // podlet 1 publishes assets
    const [p1js, p1css] = await Promise.all([
        await client.publishAssets('podlet1', [resolve('../../assets/a.js')]),
        await client.publishAssets('podlet1', [resolve('../../assets/a.css')]),
    ]);

    // podlet 2 publishes assets
    const [p2js, p2css] = await Promise.all([
        await client.publishAssets('podlet2', [resolve('../../assets/b.js')]),
        await client.publishAssets('podlet2', [resolve('../../assets/b.css')]),
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

    // podlet 1 publishes assets
    const [p1js, p1css] = await Promise.all([
        await client.publishAssets('podlet1', [resolve('../../assets/c.js')]),
        await client.publishAssets('podlet1', [resolve('../../assets/c.css')]),
    ]);

    // podlet 2 publishes assets
    const [p2js, p2css] = await Promise.all([
        await client.publishAssets('podlet2', [resolve('../../assets/d.js')]),
        await client.publishAssets('podlet2', [resolve('../../assets/d.css')]),
    ]);

    // layout publishes instructions for js and css bundling
    await client.publishInstructions('layout', 'js', ['podlet1', 'podlet2']);
    await client.publishInstructions('layout', 'css', ['podlet1', 'podlet2']);

    // podlet 1 republishes assets
    const [p1rebundlejs, p1rebundlecss] = await Promise.all([
        await client.publishAssets('podlet1', [resolve('../../assets/e.js')]),
        await client.publishAssets('podlet1', [resolve('../../assets/e.css')]),
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

    // podlet 1 publishes assets
    const [p1js, p1css] = await Promise.all([
        await client.publishAssets('podlet1', [resolve('../../assets/a.js')]),
        await client.publishAssets('podlet1', [resolve('../../assets/a.css')]),
    ]);

    // podlet 2 publishes assets
    const [p2js, p2css] = await Promise.all([
        await client.publishAssets('podlet2', [resolve('../../assets/b.js')]),
        await client.publishAssets('podlet2', [resolve('../../assets/b.css')]),
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

    // podlet 1 publishes assets
    const [p1js, p1css] = await Promise.all([
        await client.publishAssets('podlet1', [resolve('../../assets/a.js')]),
        await client.publishAssets('podlet1', [resolve('../../assets/a.css')]),
    ]);

    // podlet 2 publishes assets
    const [p2js, p2css] = await Promise.all([
        await client.publishAssets('podlet2', [resolve('../../assets/b.js')]),
        await client.publishAssets('podlet2', [resolve('../../assets/b.css')]),
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

test('scenario: full production setup', async () => {
    expect.hasAssertions();

    await server.kill();
    await startServer('production');

    const client = new Client({ buildServerUri });

    // podlet 1 publishes assets
    const { jsHash: p1js, cssHash: p1css } = await podlet('podlet1', 'dup-1');

    // podlet 2 publishes assets
    const { jsHash: p2js, cssHash: p2css } = await podlet('podlet2', 'b');

    // podlet 3 publishes assets
    const { jsHash: p3js, cssHash: p3css } = await multiEntrypointPodlet(
        'podlet3',
        'node_envs',
        'g'
    );

    // layout publishes instructions for js and css bundling of both podlet1 and 2
    await client.publishInstructions('layout', 'js', [
        'podlet1',
        'podlet2',
        'podlet3',
    ]);
    await client.publishInstructions('layout', 'css', [
        'podlet1',
        'podlet2',
        'podlet3',
    ]);

    // layout adds a new podlet and so publishes new instructions for js and css bundling
    await client.publishInstructions('layout', 'js', [
        'podlet1',
        'podlet2',
        'podlet3',
        'podlet4',
    ]);
    await client.publishInstructions('layout', 'css', [
        'podlet1',
        'podlet2',
        'podlet3',
        'podlet4',
    ]);

    // podlet 4 publishes assets after being included in bundling instructions
    const { jsHash: p4js, cssHash: p4css } = await podlet('podlet4', 'dup-2');

    const jsHash1 = await hashArray([p1js, p2js, p3js]);
    const jsHash2 = await hashArray([p1js, p2js, p3js, p4js]);
    const cssHash1 = await hashArray([p1css, p2css, p3css]);
    const cssHash2 = await hashArray([p1css, p2css, p3css, p4css]);

    const { text: jsBundle1 } = await request
        .get(`/bundle/${jsHash1}.js`)
        .expect(200);
    expect(jsBundle1).toMatchSnapshot();

    const { text: jsBundle2 } = await request
        .get(`/bundle/${jsHash2}.js`)
        .expect(200);
    expect(jsBundle2).toMatchSnapshot();

    const { text: cssBundle1 } = await request
        .get(`/bundle/${cssHash1}.css`)
        .expect(200);
    expect(cssBundle1).toMatchSnapshot();

    const { text: cssBundle2 } = await request
        .get(`/bundle/${cssHash2}.css`)
        .expect(200);
    expect(cssBundle2).toMatchSnapshot();

    const spy = jest.fn();
    vm.runInNewContext(jsBundle1, { spy });
    vm.runInNewContext(jsBundle2, { spy });
    expect(spy).toHaveBeenCalledTimes(2);

    server.kill();
    await startServer();
});

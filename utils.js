'use strict';

const { IdHasher } = require('asset-pipe-common');
const { Readable } = require('readable-stream');

module.exports.hashArray = function hashArray(arr) {
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
};

/**
 * Limits the concurrency of an async function mapped over an array of items.
 * @param {Array} items - The array of items to process.
 * @param {number} limit - The maximum number of concurrent operations.
 * @param {Function} iteratorFn - The async function to call for each item.
 * @returns {Promise<Array>} - A promise that resolves to an array of results.
 */
async function limitConcurrency(items, limit, iteratorFn) {
    const results = [];
    const executing = [];

    for (const item of items) {
        const p = Promise.resolve().then(() => iteratorFn(item));
        results.push(p);

        if (limit <= items.length) {
            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= limit) {
                await Promise.race(executing);
            }
        }
    }

    return Promise.all(results);
}

module.exports = { limitConcurrency };

import { describe, expect, it } from 'vitest';
import deepmerge from 'deepmerge';

function parseObject(json: string): Record<string, unknown> {
    return JSON.parse(json);
}

function expectSafePrototype(value: object) {
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(Object.prototype).not.toHaveProperty('injected');
}

describe('installed deepmerge security patch', () => {
    it('copies an own __proto__ target key without invoking the prototype setter', () => {
        const target = parseObject('{"__proto__":{"injected":true}}');
        const result = deepmerge(target, {});

        expectSafePrototype(result);
        expect(Object.getOwnPropertyDescriptor(result, '__proto__')).toEqual({
            value: { injected: true }, enumerable: true, writable: true, configurable: true,
        });
        expect(result).not.toHaveProperty('injected');
    });

    it('handles __proto__ from a source when the target has a null prototype', () => {
        const source = parseObject('{"__proto__":{"injected":true}}');
        const result = deepmerge<Record<string, unknown>>(Object.create(null), source);

        expectSafePrototype(result);
        expect(Object.hasOwn(result, '__proto__')).toBe(true);
        expect(result).not.toHaveProperty('injected');
    });

    it('defines recursively merged __proto__ properties as data', () => {
        const target = parseObject('{"__proto__":{"first":1}}');
        const source = parseObject('{"__proto__":{"injected":true}}');
        const result = deepmerge(target, source);

        expectSafePrototype(result);
        expect(Object.getOwnPropertyDescriptor(result, '__proto__')?.value).toEqual({
            first: 1, injected: true,
        });
    });

    it('keeps nested objects and array elements on their original safe prototypes', () => {
        const target: { nested: Record<string, unknown>; items: Record<string, unknown>[] } = JSON.parse('{"nested":{"__proto__":{"injected":true}},"items":[{"__proto__":{"injected":true}}]}');
        const result = deepmerge<typeof target>(target, { nested: { added: true } });

        expectSafePrototype(result.nested);
        expectSafePrototype(result.items[0]);
        expect(result.nested.added).toBe(true);
    });

    it('continues to reject inherited constructor and prototype-chain keys', () => {
        const source = parseObject('{"__proto__":{"injected":true},"constructor":{"prototype":{"injected":true}},"safe":1}');
        const result = deepmerge({}, source);

        expectSafePrototype(result);
        expect(Object.hasOwn(result, '__proto__')).toBe(false);
        expect(Object.hasOwn(result, 'constructor')).toBe(false);
        expect(result).toEqual({ safe: 1 });
    });

    it('merges and clones ordinary nested values, arrays and enumerable symbols', () => {
        const key = Symbol('metadata');
        const target = { nested: { first: 1 }, items: [{ first: 1 }], [key]: { first: 1 } };
        const source = { nested: { second: 2 }, items: [{ second: 2 }], [key]: { second: 2 } };
        const result = deepmerge(target, source);

        expect(result).toEqual({
            nested: { first: 1, second: 2 },
            items: [{ first: 1 }, { second: 2 }],
            [key]: { first: 1, second: 2 },
        });
        expect(result.nested).not.toBe(target.nested);
        expect(result.items[0]).not.toBe(target.items[0]);
        expect(result[key]).not.toBe(target[key]);
    });

    it('preserves custom merge, array merge, clone and all APIs', () => {
        const result = deepmerge({ nested: { first: 1 }, items: [1] }, { nested: { second: 2 }, items: [2] }, {
            customMerge: key => key === 'nested' ? (_target, source) => source : undefined,
            arrayMerge: (_target, source) => source,
        });
        expect(result).toEqual({ nested: { second: 2 }, items: [2] });

        const source = { nested: { first: 1 } };
        expect(deepmerge({}, source, { clone: false }).nested).toBe(source.nested);
        expect(deepmerge.all([{ first: 1 }, { second: 2 }])).toEqual({ first: 1, second: 2 });
    });
});

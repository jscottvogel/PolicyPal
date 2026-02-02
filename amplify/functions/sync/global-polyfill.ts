// Polyfill DOMMatrix
// @ts-ignore
if (typeof global.DOMMatrix === 'undefined') {
    // @ts-ignore
    global.DOMMatrix = class DOMMatrix {
        constructor() { return this; }
        setMatrixValue() { return this; }
        multiply() { return this; }
        translate() { return this; }
        scale() { return this; }
        rotate() { return this; }
        transformPoint() { return { x: 0, y: 0, z: 0, w: 1 }; }
    };
}

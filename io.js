
// Marshals a string to Uint8Array.
const encodeUTF8 = (s) => {
    let i = 0;
    const bytes = new Uint8Array(s.length * 4);

    for (let ci = 0; ci !== s.length; ci++) {
        let c = s.charCodeAt(ci);

        if (c < 128) {
            bytes[i++] = c;
            continue;
        }

        if (c < 2048) {
            bytes[i++] = c >> 6 | 192;
        } else {
            if (c > 0xd7ff && c < 0xdc00) {
                if (++ci === s.length) {
                    throw new Error('UTF-8 encode: incomplete surrogate pair');
                }
                const c2 = s.charCodeAt(ci);

                if (c2 < 0xdc00 || c2 > 0xdfff) {
                    throw new Error(`UTF-8 encode: second char code 0x${c2.toString(16)} at index ${ci} in surrogate pair out of range`);
                }
                c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
                bytes[i++] = c >> 18 | 240;
                bytes[i++] = c >> 12 & 63 | 128;
            } else {
                bytes[i++] = c >> 12 | 224;
            }
            bytes[i++] = c >> 6 & 63 | 128;
        }
        bytes[i++] = c & 63 | 128;
    }
    return bytes.subarray(0, i);
};


module.exports={
    encodeUTF8,
}
const {encodeUTF8} = require('./io');

describe('io',()=>{
    it ('encodes data correctly',()=>{
        const str='Hello world.$$!!ñññ';
        const encoded=encodeUTF8(str);
        const buf=Buffer.from(encoded);
        const buf64=buf.toString();
        expect(buf64).toBe(str);
    });
});
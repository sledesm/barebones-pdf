const {measureText,getFont} = require('./fonts');

describe('fonts',()=>{
    it ('returns correctly a standard font',()=>{
        const font=getFont('helvetica');
        expect(font).toBeDefined();
    });
    it ('measures text correctly',()=>{
        expect(measureText({fontName:'helvetica',text:'hello world',size:20})).toEqual({"maxx": 94.44, "maxy": 14.36, "minx": 1.3, "miny": -0.3});
    });
})
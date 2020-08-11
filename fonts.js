const helveticaData = require("./std-fonts/min/Helvetica.json");
const courierData = require("./std-fonts/min/Courier.json");
const timesRomanData = require("./std-fonts/min/Times-Roman.json");

const { decode } = require("base64-arraybuffer");

const n = (value)=>{
    return Math.round(value*100)/100;
}

const parseFonts = (list) => {
  console.log("parsing fonts");
  const result = {};
  for (let i = 0; i < list.length; i++) {
    const { name, resource } = list[i];
    const { data } = resource;
    const binData = new Uint8Array(decode(data));
    const dataView = new DataView(binData.buffer);
    const metrics = {};

    for (let j = 0; j < binData.length; j += 12) {
      const charCode = dataView.getInt16(j);
      const width = dataView.getInt16(j + 2);
      const minx = dataView.getInt16(j + 4);
      const miny = dataView.getInt16(j + 6);
      const maxx = dataView.getInt16(j + 8);
      const maxy = dataView.getInt16(j + 10);
      metrics[charCode] = {
        width: width / 1000,
        minx: minx / 1000,
        miny: miny / 1000,
        maxx: maxx / 1000,
        maxy: maxy / 1000,
      };
    }
    result[name] = {
      metrics,
    };
  }
  return result;
};

const _fontMap = parseFonts([
  { name: "helvetica", resource: helveticaData },
  { name: "courier", resource: courierData },
  { name: "times roman", resource: timesRomanData },
]);

const measureText = ({ fontName, text, size }) => {
  const fontRecord = _fontMap[fontName];
  if (!fontRecord) {
    throw new Error(`Font ${fontName} not found`);
  }
  const metrics = fontRecord.metrics;
  const result = {
    minx: 0,
    miny: 0,
    maxx: 0,
    maxy: 0,
  };
  let curPos = 0;

  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const record = metrics[c];

    if (record) {
      const { width, minx, miny, maxx, maxy } = record;
      if (i === 0) {
        result.minx = minx;
        result.miny = miny;
        result.maxx = maxx;
        result.maxy = maxy;
      } else {
        result.maxx = curPos + maxx;
        if (miny < result.miny) {
          result.miny = miny;
        }
        if (maxy > result.maxy) {
          result.maxy = maxy;
        }
      }
      curPos += width;
    }
  }
  return {
    minx: n(result.minx * size),
    miny: n(result.miny * size),
    maxx: n(result.maxx * size),
    maxy: n(result.maxy * size),
  };
};

const getFont = (name) => {
  return _fontMap[name];
};

module.exports = {
  measureText,
  getFont,
};

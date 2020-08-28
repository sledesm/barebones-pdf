const _colorCache = {};

const getColorStr = (color) => {
    if (!color) {
      return "";
    }
    let colorStr = _colorCache[color];
    if (!colorStr) {
      const colorNumber = Number.parseInt(color.slice(1), 16);
      const r = ((colorNumber >> 16) & 0xff) / 255;
      const g = ((colorNumber >> 8) & 0xff) / 255;
      const b = (colorNumber & 0xff) / 255;

      colorStr = ` ${r} ${g} ${b}`;
      _colorCache[color] = colorStr;
    }
    return colorStr;
  };

  module.exports={
      getColorStr,
  }
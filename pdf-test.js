const fs = require("fs");
const instancePDF = require("./pdf");
const upng = require("upng-js");
const { promisify } = require("util");

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

const run = () => {
  const pdf = instancePDF();

  const NUMX = 10;
  const NUMY = 10;
  const DIAMETER = 20;
  const SPACING = 22;

  const t0 = Date.now();

  pdf.addPage({});

  const box = {
    minx: 10,
    maxx: 550,
    miny: 20,
    maxy: 800,
  };

  const textSize = 30;

  const addTexts = ({ text, font, size, box, alignments }) => {
    for (let i = 0; i < alignments.length; i++) {
      const alignment = alignments[i];
      pdf.addText({ text, font, size, box, alignment });
    }
  };

  pdf.setFillColor("#C0C0C0");
  pdf.setStrokeColor("#000000");

  pdf.addPolygon({
    path: [
      { x: box.minx, y: box.miny },
      { x: box.maxx, y: box.miny },
      { x: box.maxx, y: box.maxy },
      { x: box.minx, y: box.maxy },
    ],
    closed: true,
    fill: true,
    stroke: true,
  });

  pdf.setFillColor("#000000");
  pdf.setStrokeColor("#000000");

  addTexts({
    text: "Hello world",
    font: "helvetica",
    size: textSize,
    box,
    alignments: ["lt", "lb", "lc", "rt", "rb", "rc", "ct", "cb", "cc"],
  });

  pdf.setFillColor("#FF0000");
  pdf.setStrokeColor("#00FF00");

  let counter = 0;
  const r = DIAMETER * 0.5;
  for (let x = 0; x < NUMX; x++) {
    for (let y = 0; y < NUMY; y++) {
      const cx = x * SPACING;
      const cy = y * SPACING;
      pdf.addCircle(cx, cy, DIAMETER, false, true);
    }
  }
  pdf.setFillColor("#000000");
  pdf.setStrokeColor("#000000");
  for (let x = 0; x < NUMX; x++) {
    for (let y = 0; y < NUMY; y++) {
      const cx = x * SPACING;
      const cy = y * SPACING;
      pdf.addText({
        text: (counter++ % 100).toString(),
        font: "helvetica",
        size: DIAMETER * 0.5,
        box: {
          minx: cx - r,
          miny: cy - r,
          maxx: cx + r,
          maxy: cy + r,
        },
        alignment: "cc",
      });
    }
  }
  pdf.setFillColor("#FF0000");
  pdf.setStrokeColor("#00FF00");

  pdf.addCircle(100, 300, 20, true, true);
  pdf.addCircle(120, 300, 20, true, false);
  pdf.addCircle(140, 300, 20, false, true);

  pdf.setFillColor("#008080");
  pdf.setStrokeColor("#00FF00");

  pdf.addRectangle(100, 500, 80, 40, 45, true, true);

  pdf.setFillColor("#0000FF");
  pdf.setStrokeColor("#00FF00");

  pdf.addOval(100, 500, 80, 40, 45, true, true);

  return readFile("sample-png/baseball.png")
    .then((data) => {
      const image = upng.decode(data);
      const { width, height } = image;
      const bufRGBA = new Uint8Array(upng.toRGBA8(image)[0]);
      pdf.addImage({
        name: "baseball",
        resource: bufRGBA,
        size: {
          width,
          height,
        },
        format: "RGBA",
      });
      pdf.paintImage({
        name: "baseball",
        dst: {
          cx: 300,
          cy: 600,
          width: width*0.3,
          height: height*0.3,
          angle: 10,
        },
      });
    })
    .then(() => {
      const data = pdf.render();

      const t1 = Date.now();
      console.log(`total generation time: ${t1 - t0} ms `);
      return data;
    });
};

run()
  .then((data) => writeFile("./output.pdf", data))
  .then(() => {
    console.log("done");
  })
  .catch((err) => {
    console.error(err);
  });

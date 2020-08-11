const fs = require("fs");
const instancePDF = require("./pdf");

const pdf = instancePDF();

const NUMX = 200;
const NUMY = 200;
const DIAMETER = 2;
const SPACING = 2.2;

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

addTexts({
  text: "Hello world",
  font: "helvetica",
  size: textSize,
  box,
  alignments: ["lt", "lb", "lc", "rt", "rb", "rc", "ct", "cb", "cc"],
});

pdf.addLine({
  path: [
    { x: box.minx, y: box.miny },
    { x: box.maxx, y: box.miny },
    { x: box.maxx, y: box.maxy },
    { x: box.minx, y: box.maxy },
    { x: box.minx, y: box.miny },
  ],
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
    //pdf.addCircle(cx, cy, DIAMETER, false, true);
    pdf.addText({
      text: ((counter++)%100).toString(),
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

const data = pdf.render();

const t1 = Date.now();

console.log(`total generation time: ${t1 - t0} ms `);

fs.writeFile("./output.pdf", data, (err) => {
  if (err) {
    console.error(err);
  } else {
    console.log("done");
  }
});

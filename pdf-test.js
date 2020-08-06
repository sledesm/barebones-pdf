const fs = require('fs');
const instancePDF = require('./pdf');

const pdf = instancePDF();

const NUMX = 200;
const NUMY = 200;
const DIAMETER = 2;
const SPACING = 2.2;

const t0=Date.now();

pdf.addPage({});

pdf.addText({text: 'Hello world', font: 'helvetica', size: 72, pos: {x: 100, y: 400}});

pdf.addLine({path: [{x: 10, y: 10}, {x: 100, y: 10}, {x: 100, y: 100}, {x: 10, y: 100}]});

pdf.setFillColor('#FF0000');
pdf.setStrokeColor('#00FF00');

for (let x=0; x<NUMX; x++){
    for (let y=0; y<NUMY; y++){
        const cx=x*SPACING;
        const cy=y*SPACING;
        pdf.addCircle(cx,cy,DIAMETER,false,true);
    }
}
pdf.addCircle(100, 300, 20,true,true);
pdf.addCircle(120, 300, 20,true,false);
pdf.addCircle(140, 300, 20,false,true);

const data = pdf.render();

const t1=Date.now();

console.log(`total generation time: ${t1-t0} ms`);

fs.writeFile('./output.pdf', data, (err) => {
    if (err) {
        console.error(err);
    }else{
        console.log('done');
    }
});

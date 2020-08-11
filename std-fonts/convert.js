const fs=require('fs');
const path=require('path');
const symbolEncoding=require('./encoding_metrics/symbol-encoding.json');

const symbolMap={};

Object.keys(symbolEncoding).forEach((key)=>{
    const [,name]=symbolEncoding[key];
    if (!symbolMap[name]){
        symbolMap[name]=+key;
    }
});

const files=process.argv.slice(2);
const loop=(files,index,callback)=>{
    if (index>=files.length){
        return callback();
    }
    const filename=files[index];
    if (!filename){
        return callback('Please supply filename');
    }
    console.log(`Converting ${filename}`);
    fs.readFile(filename,(err,data)=>{
        if (err){
            console.error(err);
            return;
        }
        const font=JSON.parse(data.toString());
        const res=[];
        const charMetrics=font['CharMetrics'];

        for (let i=0; i<charMetrics.length; i++){
            const {'WX':width,'N':name,'B':bbox}=charMetrics[i];
            const charCode=name.length===1?name.charCodeAt(0):symbolMap[name];
            if (charCode>0){
                res.push({charCode,width,bbox});
            }
        }
        const recordSize=12;
        // We have to reserve 6 fields
        // charCode, width, minx,miny,maxx,maxy
        const buf=new ArrayBuffer(res.length*recordSize);
        const dataView=new DataView(buf)
        for (let i=0; i<res.length; i++){
            const {charCode,width,bbox}=res[i];
            dataView.setInt16(i*recordSize,charCode);
            dataView.setInt16(i*recordSize+2,width);
            dataView.setInt16(i*recordSize+4,bbox[0]);
            dataView.setInt16(i*recordSize+6,bbox[1]);
            dataView.setInt16(i*recordSize+8,bbox[2]);
            dataView.setInt16(i*recordSize+10,bbox[3]);
        }
        
        const {dir,name} = path.parse(filename);
        const buffer=Buffer.from(buf);
        const b64=buffer.toString('base64');
        const outputFile=path.join(dir,'min',`${name}.json`);
        const output=JSON.stringify({data:b64});
        fs.writeFile(outputFile,output,(err)=>{
            if (err){
                return callback(err);
            }
            loop(files,index+1,callback);
        });
    })
};

loop(files,0,(err)=>{
    if (err){
        console.error(err);
        return;
    }
    console.log('done');
})
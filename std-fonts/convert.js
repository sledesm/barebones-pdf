const fs=require('fs');
const path=require('path');

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
        for (let i=0; i<font.length; i++){
            const {charCode,width}=font[i];
            if (charCode>0){
                res.push(charCode,width);
            }
        }
        const buf=Buffer.alloc(res.length*2);
        for (let i=0; i<res.length; i++){
            const v=res[i];
            const hi=(v>>8)&0xFF;
            const lo=v&0xFF;
            buf[i*2]=hi;
            buf[i*2+1]=lo;
        }
        
        const {dir,name} = path.parse(filename);
        const b64=buf.toString('base64');
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
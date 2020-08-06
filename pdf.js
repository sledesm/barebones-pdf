/*
    PDF objects internally are just javascript objects

    datatypes:
        dictionaryProperty
            Dictionary properties can be arrays, numbers, strings or javascript objects.
            Arrays are translated to PDF arrays, each component is a property itself
            Numbers are translated to PDF numbers
            Strings are translated to PDF literal names /Name
            null is translated as null
            undefined is not translated

            Other types have a special form, like:
                {
                    type:'string representing the type of value',
                    value:'The value to use'
                }

            The type can be

            ref: Represents and object ref, the value is an array of two integers like [23 0]
            string: Represents a string, which will be translated as a PDF string, betweeen parethensis,
            map: The value must be interpreted as another dictionary

    EXAMPLE OBJECT

    {
        name:'testObject', // This name will not go into pdf. It is used as a hook to reference it easier than the object number
        ref:[23 0],
        offset:1234, // offset in the output file of the object. This property is filled on Render!!!
        links:{
            // Dictionary of links between child names and the object name of the child. Example: content:'content_23'
        },
        dictionary:{
            Type:'Page',
            Parent:{type:'ref',value:[3 0]},
            Resources:{type:'ref', value:[8 0]},
            Content:{type:'ref',value:[9 0]},
            MediaBox:[0 0 321 323]
        },
        stream:[] // Stream is an array of Uint8Array objects, which will be joined together on object rendering, updating the Length component of the dictionary
            // at render time, just like the offset is calculated also at render time
    }
*/


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

const instancePDF = ({defaultSize} = {}) => {

    const _model = {
        // Dictionary of logic name and object (logic name will not be used in the final PDF output)
        objectMap: {},
        // Object array as will appear in the xref part
        objectArray: [],
    };

    let _numPages = 0;
    let _fontCount = 0;
    let _curPage;
    let _curContent;
    const _colorCache={};

    const addObj = (lobj) => {
        const obj = lobj;
        const name = obj.name;

        if (_model.objectMap[name]) {
            throw new Error(`Duplicate object name ${name}`);
        }
        obj.ref = [_model.objectArray.length + 1, 0];
        // offset where the object will start in the final file. It will be filled by the Render function
        obj.offset = 0;
        if (!obj.dictionary) {
            obj.dictionary = {};
        }
        _model.objectMap[name] = obj;
        _model.objectArray.push(obj);
        return obj;
    };

    const addToStream = (obj, data) => {
        const objToUse = obj;
        let buffer;

        if (typeof (data) == 'string') {
            buffer = encodeUTF8(data);
        } else if (data instanceof Uint8Array) {
            buffer = data;
        } else if (data.length && data.stream) {
            buffer = data;
        } else {
            throw new Error('Invalid data format in addStream. Must be a string or an Uint8Array');
        }
        if (!objToUse.stream) {
            objToUse.stream = [];
        }
        objToUse.stream.push(buffer);
    };

    const getObject = (name) => _model.objectMap[name];


    const render = () => {
        const fragments = [];
        let currentOffset = 0;

        const addFragment = (fragment) => {
            let buf;

            if (typeof (fragment) == 'string') {
                buf = encodeUTF8(fragment);
            } else if (fragment instanceof Array) {
                buf = new Uint8Array(fragment);
            } else if (fragment instanceof Uint8Array) {
                buf = fragment;
            } else if (fragment instanceof Buffer) {
                buf = fragment;
            } else {
                throw new Error('Only strings, arrays, Uint8Arrays and Buffers supported');
            }
            fragments.push(buf);
            currentOffset += buf.length;
        };

        const renderDictionary = (dictionary) => {
            let str = '';

            const _renderValue = (value) => {
                let valueStr = '';

                switch (typeof (value)) {
                    case 'string':
                        valueStr = `/${value}`;
                        break;
                    case 'number':
                        valueStr = value;
                        break;
                    case 'boolean':
                        valueStr = value;
                        break;
                    case 'object':
                        if (value instanceof Array) {
                            valueStr = '[ ';
                            for (let j = 0; j < value.length; j++) {
                                valueStr += `${_renderValue(value[j])} `;
                            }
                            valueStr += ']';
                        } else if (value === null) {
                            valueStr = 'null';
                        } else {
                            const record = value;
                            const recordValue = record.value;

                            switch (record.type) {
                                case 'ref':
                                    valueStr = `${recordValue[0]} ${recordValue[1]} R`;
                                    break;
                                case 'string':
                                    valueStr = `(${recordValue})`;
                                    break;
                                case 'map':
                                    valueStr = renderDictionary(recordValue);
                                    break;
                                default:
                            }
                        }
                        break;
                    default:
                }
                return valueStr;
            };

            str += '<<\n';
            Object.keys(dictionary).forEach((key) => {
                const value = dictionary[key];

                if (value === undefined) {
                    return;
                }
                const v = _renderValue(value);

                if (!v) {
                    return;
                }
                str += `/${key} ${v}\n`;
            });

            str += '>>';
            return str;
        };

        const renderObject = (object) => {

            const objectToUse = object;
            const offset = currentOffset;

            objectToUse.offset = offset;
            let stream;
            let streamLength = 0;
            let i;
            let buffer;

            if (objectToUse.stream) {
                stream = objectToUse.stream;
                for (i = 0; i < stream.length; i++) {
                    buffer = stream[i];
                    streamLength += buffer.length;
                }
                if (streamLength) {
                    if (!objectToUse.dictionary) {
                        objectToUse.dictionary = {};
                    }
                    const dictionary = objectToUse.dictionary;

                    dictionary.Length = streamLength;
                }
            }


            const str = `${objectToUse.ref[0]} ${objectToUse.ref[1]} obj\n${renderDictionary(objectToUse.dictionary)}\n`;

            addFragment(str);
            if (streamLength) {
                addFragment('stream\n');
                stream = objectToUse.stream;
                for (i = 0; i < stream.length; i++) {
                    buffer = stream[i];
                    addFragment(buffer);
                }
                addFragment('endstream\n');
            }
            addFragment('endobj\n');
        };

        const addXref = () => {
            let str = '';
            const objects = _model.objectArray;
            const numObjects = objects.length;

            str += 'xref\n';
            str += `0 ${numObjects + 1}\n`;
            let ref;
            let obj;

            const pad = (a, b) => (`${1e15}${a}`).slice(-b);

            for (let i = 0; i < numObjects + 1; i++) {
                const index = i - 1;

                if (index < 0) {
                    ref = [0, 65535, 'f'];
                } else {
                    obj = objects[index];
                    const offset = obj.offset;

                    ref = [offset, 0, 'n'];
                }
                str += pad(ref[0], 10);
                str += ` ${pad(ref[1], 5)}`;
                str += ` ${ref[2]}\n`;
            }
            addFragment(str);
        };

        const addTail = (xRefOffset) => {
            let str = 'trailer\n';
            const objects = _model.objectArray;
            const catalog = getObject('Catalog');
            const dictionary = {
                Size: objects.length + 1,
                Root: {type: 'ref', value: catalog.ref},
            };

            str += renderDictionary(dictionary);
            str += '\n';
            str += 'startxref\n';
            str += `${xRefOffset}\n`;
            str += '%%EOF';
            addFragment(str);
        };

        const catalog = getObject('Catalog');
        const firstPage = getObject('page_1');

        if (firstPage) {
            catalog.dictionary.OpenAction = [{type: 'ref', value: firstPage.ref}, 'FitH', null];
        }
        addFragment('%PDF-1.3\n');
        const objects = _model.objectArray;

        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];

            renderObject(obj);
        }
        const xRefOffset = currentOffset;

        addXref();
        addTail(xRefOffset);

        const data = Buffer.concat(fragments);

        return data;
    };

    const addFont = (params) => {
        const name = `font_${params.name}`;
        const baseFont = params.baseFont;

        _fontCount++;
        const handle = `F${_fontCount}`;
        const fontObject = addObj({
            name,
            handle,
            dictionary: {
                Type: 'Font',
                Subtype: 'Type1',
                BaseFont: baseFont,
            },
        });
        const resources = getObject('Resources');

        resources.dictionary.Font.value[handle] = {
            type: 'ref',
            value: fontObject.ref,
        };
    };

    const setCurrentPage=(pageName) => {
        const page = getObject(pageName);

        if (!page) {
            throw new Error(`Cannot find page ${pageName}`);
        }
        const content = getObject(page.links.content);

        if (!content) {
            throw new Error(`Cannot find content for page ${pageName}`);
        }
        _curPage=page;
        _curContent=content;
    }


    const addPage = (params) => {

        let size = params.size;

        if (!size) {
            size = defaultSize;
        }
        if (!size) {
            size = [0, 0, 595.28, 841.89];
        }

        const pages = getObject('Pages');
        const resources = getObject('Resources');

        _numPages++;

        const contentName = `contents_${_numPages}`;
        const contents = addObj({
            name: contentName,
            dictionary: {
                'Length': 0,
            },
        });

        const pageName = `page_${_numPages}`;

        const pageObj = addObj({
            name: pageName,
            links: {
                content: contentName,
            },
            dictionary: {
                'Type': 'Page',
                'Parent': {type: 'ref', value: pages.ref},
                'Resources': {type: 'ref', value: resources.ref},
                'Contents': {type: 'ref', value: contents.ref},
                'MediaBox': size,
            },
        });

        const pagesDict = pages.dictionary;
        let kids = pagesDict.Kids;

        if (!kids) {
            kids = {type: 'array'};
            pagesDict.Kids = kids;
        }

        kids.push({
            type: 'ref',
            value: pageObj.ref,
        });

        pagesDict.Count = _numPages;
        setCurrentPage(pageName);
        return pageName;
    };


    let _imageIndex = 0;

    const addImage = ({name, size, resource}) => {
        const imageHandle = `I${_imageIndex}`;

        _imageIndex++;
        const imageObj = addObj({
            name,
            imageHandle,
            dictionary: {
                Type: 'XObject',
                Subtype: 'Image',
                Width: size.width,
                Height: size.height,
                ColorSpace: 'DeviceRGB',
                BitsPerComponent: 8,
                Filter: 'DCTDecode',
            },
        });
        const resources = getObject('Resources');
        const xObjDict = resources.dictionary.XObject.value;

        xObjDict[imageHandle] = {
            type: 'ref',
            value: imageObj.ref,
        };
        addToStream(imageObj, resource);
    };


    const matrixToString = (matrix) => {
        if (matrix.length !== 6) {
            throw new Error('Invalid matrix');
        }
        let str = '';

        for (let i = 0; i < matrix.length; i++) {
            str += ` ${matrix[i].toFixed(8)}`;
        }
        str += ' cm';
        return str;
    };


    const getColorStr=(color)=>{
        if (!color){
            return '';
        }
        let colorStr=_colorCache[color];
        if (!colorStr){
            const colorNumber = Number.parseInt(color.slice(1),16);
            const r=((colorNumber>>16)&0xFF)/255;
            const g=((colorNumber>>8)&0xFF)/255;
            const b=((colorNumber)&0xFF)/255;

            colorStr=` ${r} ${g} ${b}`;
            _colorCache[color]=colorStr;
        }
        return colorStr;
    }
    

    const setFillColor=(color) => {
        const str=`${getColorStr(color)} rg`;
        addToStream(_curContent,str);
    };

    const setStrokeColor=(color) => {
        const str=`${getColorStr(color)} RG`;
        addToStream(_curContent,str);
    };

    const n=(v)=>{
        const res=((v*1000)|0)/1000;
        return res;
    };

    const addCircle = (x,y, diameter, stroke=true,fill=false) => {
        const cFactor = 0.551915024494;
        const r = diameter * 0.5;
        const c = cFactor * r;

        let endCmd;
        if (fill){
            if (stroke){
                endCmd='b';
            }else{
                endCmd='f';
            }
        }else{
            endCmd='S';
        }

        // Below string is a little bit cryptic, but it comes directly from an approximation of bezier curves to circles as described by the literature
        // [0,1] [c,1] [1,c] [1,0] --> first quadrant
        // [1,0] [1,-c] [c,-1] [0,-1] --> second quadrant
        // [0,-1] [-c,-1] [-1,-c] [-1,0] --> third quadrant
        // [-1,0] [-1,c] [-c,1] [0,1] --> fourth quadrant
        // We add to the above values cx, and cy (center of the circle), and we use r instead of 1. c in this case is 0.551915024494 * r
        const str = `${n(x)} ${n(y + r)} m ${n(x + c)} ${n(y + r)} ${n(x + r)} ${n(y + c)} ${n(x + r)} ${n(y)} c ${n(x + r)} ${n(y - c)} ${n(x + c)} ${n(y - r)} ${n(x)} ${n(y - r)} c ${n(x - c)} ${n(y - r)} ${n(x - r)} ${n(y - c)} ${n(x - r)} ${n(y)} c ${n(x - r)} ${n(y + c)} ${n(x - c)} ${n(y + r)} ${n(x)} ${n(y + r)} c ${endCmd}\n`;
        addToStream(_curContent, str);
    };

    const addLine = ({matrix, path, closed, renderOptions}) => {
        const {
            clipPath,
            dontQ,
        } = renderOptions || {};

        let str = '';

        if (!dontQ) {
            str += ' q';
        }
        if (matrix) {
            str += matrixToString(matrix);
        }
        str += '\n';
        for (let i = 0; i < path.length; i++) {
            const point = path[i];

            str += ` ${point.x.toFixed(3)} ${point.y.toFixed(3)}`;
            if (i === 0) {
                str += ' m';
            } else {
                str += ' l';
            }
        }
        if (path.length) {
            if (closed) {
                str += ' h';
            }
            if (!clipPath) {
                str += ' S';
            } else {
                str += ' W n';
            }
        }
        if (!dontQ) {
            str += ' Q\n';
        } else {
            str += '\n';
        }
        addToStream(_curContent, str);
    };


    const paintImage = ({matrix, imageKey, clipPath}) => {

        const imageObj = getObject(imageKey);

        const imageHandle = imageObj.imageHandle;

        if (clipPath) {
            addToStream(_curContent, ' q');
            addLine({
                pageName,
                matrix: clipPath.matrix,
                path: clipPath.path,
                closed: true,
                renderOptions: {
                    clipPath: true,
                    dontQ: true,
                },
            });
        }
        let str = ` q${matrixToString(matrix)} /${imageHandle} Do Q`;

        if (clipPath) {
            str += ' Q\n';
        } else {
            str += '\n';
        }
        addToStream(_curContent, str);
    };

    const getModel = () => _model;


    const addText = ({text, font, size, pos}) => {

        const fontName = `font_${font}`;
        const fontObj = getObject(fontName);

        if (!fontObj) {
            throw new Error(`Cannot find font ${font} maybe you should add it first with addFont. By default only helvetica is available`);
        }
        const fontHandle = fontObj.handle;
        const str = `BT /${fontHandle} ${size} Tf\n${pos.x} ${pos.y} Td\n(${text}) Tj\nET\n`;

        addToStream(_curContent, str);
    };


    const init = () => {
        const pages = addObj({
            name: 'Pages',
            dictionary: {
                Kids: [],
            },
        });

        addObj({
            name: 'Resources',
            dictionary: {
                ProcSet: ['PDF', 'TEXT', 'ImageB', 'ImageC', 'ImageI'],
                XObject: {type: 'map', value: {}},
                Font: {type: 'map', value: {}},
            },
        });

        addObj({
            name: 'Catalog',
            dictionary: {
                Type: 'Catalog',
                Pages: {type: 'ref', value: pages.ref},
                PageLayout: 'OneColumn',
            },
        });

        addFont({
            name: 'helvetica',
            baseFont: 'Helvetica',
        });

    };


    init();


    return {
        addPage,
        addImage,
        addCircle,
        addLine,
        addText,
        addFont,
        paintImage,
        render,
        getModel,
        setCurrentPage,
        setFillColor,
        setStrokeColor,
    };
};

module.exports = instancePDF;

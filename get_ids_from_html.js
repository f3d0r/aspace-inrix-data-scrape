var fs = require('fs');
var path = require('path');
var neek = require('neek');

const htmlFilePath = path.join(__dirname, '/inrix_export.html');
const idFilePath = '.parking_id_list.txt';
const uniqueIdFilePath = 'parking_id_unique_list.txt';

var lineReader = require('readline').createInterface({
    input: fs.createReadStream(htmlFilePath)
});

var increment = 0;
var ids = "";
lineReader.on('line', function (line) {
    if (line.indexOf("featured_lot_entry") > -1) {
        parsedId = parseFloat(line.substring(line.indexOf("id=\"") + 4, line.indexOf("class") - 2));
        ids += parsedId + "\n";
        increment++
    }
}).on('close', function () {
    fs.appendFile(idFilePath, ids, function (err) {
        if (err) {
            throw err;
        } else {
            console.log('FILE SUCCESSFULLY SAVED!');
            neek.unique(idFilePath, uniqueIdFilePath, function (result) {
                console.log(result);
                
                console.log("TOTAL MATCHING LINES WITH IDS : " + increment);
            });
        }
    });
});
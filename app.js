const puppeteer = require('puppeteer');
var fs = require('fs');
const emitter = new EventEmitter()
emitter.setMaxListeners(100);

var lineReader = require('readline').createInterface({
    input: fs.createReadStream('parking_id_unique_list.txt')
});

const countLinesInFile = require('count-lines-in-file');

let scrape = async (pageIndex, ip, port) => {
    const browser = await puppeteer.launch({
        ignoreHTTPSErrors: true,
        args: [
            '--proxy-server=http://' + ip + ':' + port,
            "--no-sandbox",
            "--disable-setuid-sandbox"
        ]
    });

    const page = await browser.newPage();
    await page.goto('https://www.parkme.com/lot/' + pageIndex + '/graph/');
    await page.waitFor(1000);

    const result = await page.evaluate(() => {
        let percentFull = document.querySelector("#donut > svg > g > text.large").innerHTML;
        let finalPercent = parseFloat(percentFull.substring(0, percentFull.indexOf('%'))) / 100;
        let currentCarsRaw = document.querySelector("#donut > svg > g > text.small").innerHTML;
        let finalCarNumCurrent = parseInt(currentCarsRaw.substring(0, currentCarsRaw.indexOf('/')));
        let finalCarNumCapacity = parseInt(currentCarsRaw.substring(currentCarsRaw.indexOf('/') + 1, currentCarsRaw.length));

        return {
            finalPercent,
            finalCarNumCurrent,
            finalCarNumCapacity
        }
    });

    browser.close();
    return result;
};

lineReader.on('line', function (line) {
    var pageIndex = line;
    getRandomProxy('proxy_list.txt', function (ip, port) {
        scrape(pageIndex, ip, port).then((response) => {
                console.log(response);
            })
            .catch((error) => {
                console.log("\tERROR: " + JSON.stringify(error));
            });
    });
}).on('close', function (line) {
    console.log("DONE!");
});


function getRandomProxy(filename, cb) {
    countLinesInFile(filename, (error, numberOfLines) => {
        var randomLine = Math.floor(Math.random() * numberOfLines) + 1;
        var currentIncrement = 1;
        var lineReader = require('readline').createInterface({
            input: fs.createReadStream(filename)
        });

        lineReader.on('line', function (line) {
            if (currentIncrement == randomLine) {
                return cb(line.substring(0, line.indexOf(":")), line.substring(line.indexOf(":") + 1, line.length));
            } else {
                currentIncrement++;
            }
        });
    });
}
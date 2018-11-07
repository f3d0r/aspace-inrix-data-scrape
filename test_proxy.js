process.setMaxListeners(0);

const puppeteer = require('puppeteer');
var fs = require('fs');
var rp = require('request-promise');
const config = require('./config');
const localProxyFileName = config.FILES.LOCAL_PROXY_FILE_NAME;

startScript()

let scrape = async (proxy) => {
    const browser = await puppeteer.launch({
        ignoreHTTPSErrors: true,
        args: ['--proxy-server=https=' + proxy]
    });

    const page = await browser.newPage();
    await page.goto('https://whatismyipaddress.com/');
    await page.waitForSelector('#ipv4 > a');

    const result = await page.evaluate(() => {
        let ipFound = document.querySelector('#ipv4 > a').innerHTML;

        return {
            ipFound
        }
    });

    result['givenIP'] = proxy.substring(0, proxy.indexOf(":"));
    result['MATCHING'] = result['givenIP'] == result['ipFound'];

    browser.close();
    return result;
};

function startScript() {
    fs.readFile(localProxyFileName, 'utf8', function read(err, data) {
        if (err) {
            throw err;
        }
        proxies = data.split("\n");
        proxies = proxies.map(s => s.trim());
        testAllProxies();
    });
}

function testAllProxies() {
    var reqs = [];
    proxies.forEach(function (currentProxy) {
        reqs.push(scrape(currentProxy)
            .then(function (response) {
                return response;
            })
            .catch(function (error) {
                throw error;
            }));
    });
    Promise.all(reqs)
        .then(function (responses) {
            console.log(responses)
        }).catch(function (error) {
            console.log("ERROR: " + error)
        });
}
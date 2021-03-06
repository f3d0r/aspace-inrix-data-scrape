//GLOBAL IMPORTS
process.setMaxListeners(0);

//PACKAGE IMPORTS
const puppeteer = require('puppeteer');
var fs = require('fs');
var rp = require('request-promise');
const config = require('./config');
const mapboxAccessToken = config.ACCESS_TOKENS.MAPBOX;
const localIDListFileName = config.FILES.LOCAL_INRIX_ID_FILE_NAME;
const localProxyFileName = config.FILES.LOCAL_PROXY_FILE_NAME;

startScript();

let scrape = async (pageIndex, proxy) => {
    console.log(proxy);
    const browser = await puppeteer.launch({
        headless: false,
        ignoreHTTPSErrors: true,
        args: ['--proxy-server=https=' + proxy]
    });

    const page = await browser.newPage();
    await page.goto('http://www.parkme.com/lot/' + pageIndex);
    await page.waitForSelector('body');

    const result = await page.evaluate(() => {
        var pretty_name = document.querySelector('[itemprop=name] > h1').innerHTML;

        var lot_type = document.querySelector('#lot-header-info > div.lot-info-section > div.module-sub-header').innerHTML;
        lot_type = lot_type.substring(0, lot_type.indexOf("<")).trim();

        var rawAmenities = document.querySelector('#addition-info > div.amenities.module-table-group > span').innerHTML.trim().split("\n");
        rawAmenities = rawAmenities.map(s => s.trim());

        var amenities = [];
        for (var index = 0; index < rawAmenities.length - 1; index++) {
            if (rawAmenities[index + 1] == "</span>" && rawAmenities[index] != '') {
                amenities.push(rawAmenities[index]);
            }
        }

        var addressLineCount = document.querySelector('#lot-header-info > div.module-header-info > div.left > div.module-header-address').childElementCount;
        var address = "";
        for (index = 1; index <= addressLineCount; index++) {
            address += document.querySelector('#lot-header-info > div.module-header-info > div.left > div.module-header-address > div:nth-child(' + index + ')').innerHTML + " ";
        }

        var priceOptionsCount = document.querySelector('#daily > div:nth-child(1) > div > div.module-table-group.module-medium.rates-table').childElementCount;
        var parsedPricing = [];
        for (index = 1; index <= priceOptionsCount; index++) {
            var currentPricingOption = document.querySelector('#daily > div:nth-child(1) > div > div.module-table-group.module-medium.rates-table > div:nth-child(' + index + ')')
                .innerHTML
                .replace(/\s\s+/g, '')
                .replace(/(?:\r\n|\r|\n)/g, '')
                .replace(/<div/g, '')
                .replace(/class="left lot-rate-type">/g, '')
                .replace(/<br>/g, '')
                .trim()
                .replace(/<small>/g, ' - ')
                .split("<!-- Rich Snippet -->")[0]
                .split('</div> class="right">');
            for (var insideIndex = 0; insideIndex < currentPricingOption.length; insideIndex++) {
                currentPricingOption[insideIndex] = currentPricingOption[insideIndex]
                    .replace("</div", '')
                    .replace('</small>', '')
                    .replace(">", '')
                    .replace('class="clear"></div>', '')
                    .replace('Add\'l', "Additional")
                    .trim();
            }
            parsedPricing.push(currentPricingOption);
        }

        var info_table = document.querySelector('#addition-info > table > tbody').innerHTML.trim().split("<tr>");
        info_table = info_table.map(s => s.split('<td class="table-cell-header">'));
        for (var i = 0; i < info_table.length; i++) {
            for (var j = 0; j < info_table[i].length; j++) {
                info_table[i][j] = info_table[i][j].replace(/\s\s+/g, '');
                info_table[i][j] = info_table[i][j].replace(/(?:\r\n|\r|\n)/g, '');
                info_table[i][j] = info_table[i][j].replace(/tr>/g, '');
                info_table[i][j] = info_table[i][j].replace(/<td>/g, '');
                info_table[i][j] = info_table[i][j].replace(/td>/g, '');
                info_table[i][j] = info_table[i][j].replace(/<tr class="module-table-row">/g, '');

                info_table[i][j] = info_table[i][j].replace(/<td class="table-cell-header">/g, '');
                info_table[i][j] = info_table[i][j].replace(/div>/g, '');
                info_table[i][j] = info_table[i][j].replace(/<div/g, '');
                info_table[i][j] = info_table[i][j].replace(/itemscope=/g, '');
                info_table[i][j] = info_table[i][j].replace(/"/g, '');
                info_table[i][j] = info_table[i][j].replace("itemtype=http://schema.org/PostalAddress itemprop=streetAddress>", '');
                info_table[i][j] = info_table[i][j].replace(" class=hidden  itemtype=http://schema.org/PostalAddress itemprop=addressLocality>", '');
                info_table[i][j] = info_table[i][j].replace(/<td class=table-cell-value>/g, '<--> ');
                info_table[i][j] = info_table[i][j].replace(/<\//ig, ' ');
                info_table[i][j] = info_table[i][j].trim();
            }
        }

        var extra_info = [];
        for (i = 0; i < info_table.length; i++) {
            for (var j = 0; j < info_table[i].length; j++) {
                if (info_table[i][j].trim() != '') {
                    var addedInfo = info_table[i][j].split(" <--> ");
                    addedInfo = addedInfo.map(s => s.trim());
                    addedInfo = addedInfo.map(s => s.replace(/</g, ''));
                    extra_info.push(addedInfo);
                }
            }
        }

        return {
            pretty_name,
            lot_type,
            address,
            parsedPricing,
            amenities,
            extra_info
        };
    });

    result.inrix_index = pageIndex;

    browser.close();
    return result;
};

let scrape2 = async (pageIndex, proxy) => {
    const browser = await puppeteer.launch({
        ignoreHTTPSErrors: true,
        args: ['--proxy-server=https=' + proxy]
    });

    const page = await browser.newPage();
    await page.goto('http://www.parkme.com/lot/' + pageIndex + '/graph/');
    await page.waitForSelector('body');

    const result = await page.evaluate(() => {
        let current_raw = document.querySelector('#donut > svg > g > text.small').innerHTML;
        var current_occ = current_raw.substring(0, current_raw.indexOf("/"));
        let current_cap = current_raw.substring(current_raw.indexOf("/") + 1, current_raw.length);

        return {
            current_occ,
            current_cap
        }
    });

    browser.close();
    return result;
};

function startScript() {
    fs.readFile(localProxyFileName, 'utf8', function read(err, data) {
        if (err) {
            throw err;
        }
        proxies = data.split("\n");
        fs.readFile(localIDListFileName, 'utf8', function read(err, data2) {
            if (err) {
                throw err;
            }
            inrixIDs = data2.split("\n");
            readAndPopulateDatabase();
        });
    });
}

function getRandomProxy() {
    return proxies[proxies.length - 1];
    // return proxies[Math.floor(Math.random() * proxies.length)];
}

function readAndPopulateDatabase() {
    inrixIDs.forEach(function (currentID) {
        getInrixData(currentID, function (responses) {
            console.log("RESPONSES: ");
            responses.forEach(function (current) {
                console.log(current);
            })
        }, function (error) {
            console.log("ERROR: " + error);
        });
    });
}

function getInrixData(pageIndex, successCB, failCB) {
    var currProxy = getRandomProxy();
    var reqs = [scrape(pageIndex, currProxy), scrape2(pageIndex, currProxy)]
    Promise.all(reqs)
        .then(function (responses) {
            reqs = [reverseGeo(responses[0].address)]
            Promise.all(reqs)
                .then(function (latLngResponses) {
                    for (var index = 0; index < latLngResponses.length; index++) {
                        responses[index].coordinates = {};
                        responses[index].coordinates['lng'] = latLngResponses[index][0];
                        responses[index].coordinates['lat'] = latLngResponses[index][1];
                    }
                    successCB(responses);
                }).catch(function (error) {
                    throw error;
                });
        }).catch(function (error) {
            failCB(error);
        });
}

function reverseGeo(address) {
    var url = "https://api.mapbox.com/geocoding/v5/mapbox.places/" + address + ".json?country=US&access_token=" + mapboxAccessToken;
    return new rp(url)
        .then(function (result) {
            return JSON.parse(result).features[0].center;
        })
        .catch(function (err) {
            throw err;
        });
}
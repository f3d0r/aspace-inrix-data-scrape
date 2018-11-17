//PACKAGE IMPORTS
var fs = require('fs');
var cheerio = require('cheerio');
var puppeteer = require('puppeteer');
var csvToJson = require('csvtojson');
var pLimit = require('p-limit');

const config = require('./config');
const zipCodesCSV = './zipcodes.csv';
const includedStates = ["WA"];
const limit = pLimit(5);
const baseUrl = "https://www.parkme.com/";

//MAIN SCRIPT
execute();

async function execute() {
    const allZipCodes = await csvToJson().fromFile(zipCodesCSV);
    var searchLocations = allZipCodes.filter(current => includedStates.indexOf(current.state) != -1);
    var reqs = [];
    for (index = 0; index < searchLocations.length; index++) {
        var currentLocation = searchLocations[index];
        var url = baseUrl + "map?q=" + currentLocation.zipcode + "+" + currentLocation.city + "+" + currentLocation.state;
        reqs.push(limit(() => scrape(url)));
        console.log(url);
    }
    process.exit();
    var info = await scrape("https://www.parkme.com/map?q=98104+Seattle+WA");
    console.log(info);
    console.log(info.length);
}

async function scrape(url) {
    var browser = await puppeteer.launch();
    var page = await browser.newPage();
    await page.goto(url);

    await page.waitForSelector('#results > div > div > div:nth-child(1)');
    var bodyHTML = await page.evaluate(() => document.body.innerHTML);
    browser.close();

    const $ = cheerio.load(bodyHTML);
    var idsListLength = $('#results > div > div').children().length;
    var ids = [];
    for (var i = 1; i <= idsListLength; i++) {
        ids.push($('#results > div > div > div:nth-child(' + i + ') > div').attr('id'));
    }
    return ids;
}
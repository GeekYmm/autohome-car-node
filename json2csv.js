const fs = require('fs');
const { parse } = require('json2csv');
let myData = fs.readFileSync('./data.json');
const csv = parse(JSON.parse(myData));
fs.writeFile("./data.csv", csv, function (err) {
  if (err) {
    return console.log(err);
  }
  console.log("The file was saved!")
})
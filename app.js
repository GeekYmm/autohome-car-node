const request = require('request');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');
const async = require("async"); // 控制并发数，防止被封IP
const fs = require('fs');
const JSONStream = require('JSONStream');
const path = require('path');
const charset = require('superagent-charset');
const superagent = charset(require('superagent'));
const fetchData = []; // 存放爬取数据
const SaveToMongo = require('save-to-mongo');//用于将爬取的数据存储到MongoDB数据库

/**
 * 睡眠模拟函数
 * @param  {Number} numberMillis 毫秒
 */
function sleep(numberMillis) {
  let now = new Date();
  const exitTime = now.getTime() + numberMillis;
  while (true) {
    now = new Date();
    if (now.getTime() > exitTime)
      return;
  }
}

/**
 * 爬取品牌 & 车系
 */
function fetchBrand(req, res) {
  const pageUrls = []; // 存放爬取网址
  let count = 0; // 总数
  let countSuccess = 0; // 成功数

  let chars = ['A', 'B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'W', 'X', 'Y', 'Z'];

  for (let char of chars) {
    count++;
    pageUrls.push('http://www.autohome.com.cn/grade/carhtml/' + char + '.html');
  }

  let curCount = 0;
  let reptileMove = function (url, callback) {
    let startTime = Date.now(); // 记录该次爬取的开始时间
    request.get(url, { encoding: null }, function (err, res, body) {
      if (err || res.statusCode !== 200) {
        console.error(err);
        console.log('抓取该页面失败，重新抓取该页面..')
        reptileMove(url, callback);
        return false;
      }
      let html = iconv.decode(body, 'gb2312')
      let $ = cheerio.load(html);
      let curBrands = $('dl');

      // let i = 0;
      // let j = 0;

      for (let i = 0; i < curBrands.length; i++) {
        let curUrl = curBrands.eq(i).find('dt div a').attr('href')
        let obj = {
          url: curUrl,
          brandId: curUrl.split('.html')[0].split('-')[1],
          name: curBrands.eq(i).find('dt div a').text(),
          sub: []
        }
        fetchData.push(obj);

        let curSeries = curBrands.eq(i).find('h4 a');
        for (let j = 0; j < curSeries.length; j++) {
          let obj1 = {
            name: curSeries.eq(j).text(),
            sub: [],
            url: curSeries.eq(j).attr('href'),
            seriesId: curSeries.eq(j).attr('href').split('/')[3]
          }
          fetchData[fetchData.length - 1].sub.push(obj1);
        }
      }
      countSuccess++;
      let time = Date.now() - startTime;
      console.log(countSuccess + ', ' + url + ', 耗时 ' + time + 'ms');
      callback(null, url + 'Call back content');
    });
  };

  // 使用async控制异步抓取   
  // mapLimit(arr, limit, iterator, [callback])
  // 异步回调
  async.mapLimit(pageUrls, 1, function (url, callback) {
    console.log('异步回调的url:' + url);
    reptileMove(url, callback);
  }, function (err, result) {
    console.log('----------------------------');
    console.log('品牌车系抓取完毕！');
    console.log('----------------------------');
    fetchYear(req, res);
  });
}

/**
 * 爬取年份
 */
function fetchYear(req, res) {
  let count = 0; // 总数
  let countSuccess = 0; // 成功数
  const seriesArr = [];

  // 轮询所有车系
  for (let brand of fetchData) {
    for (let series of brand.sub) {
      count++;
      seriesArr.push(series);
    }
  }

  let curCount = 0;
  let reptileMove = function (series, callback) {
    let startTime = Date.now(); // 记录该次爬取的开始时间
    curCount++; // 并发数    

    request.get(`https://www.autohome.com.cn/${series.seriesId}/sale.html#pvareaid=3311673`, { encoding: null }, function (err, res, body) {
      if (err || res.statusCode != 200) {
        console.error(err);
        console.log('抓取该页面失败，重新抓取该页面..')
        reptileMove(series, callback);
        return false;
      }

      let html = iconv.decode(body, 'gb2312')
      let $ = cheerio.load(html);

      // 页面默认的数据
      const itemList = $('.title-subcnt-tab ul li');
      itemList.each(function () {
        let year = $(this).find('a').eq(0).text().substr(0, 4);
        let yearId = $(this).find('a').eq(0).attr('data-yearid');
        let name = $(this).find('a').eq(0).text();
        let flag = false;

        for (item of series.sub) {
          if (item.yearId == yearId) {
            item = {
              name, yearId, sub: [],
              url: `https://www.autohome.com.cn/ashx/series_allspec.ashx?s=${series.seriesId}&y=${yearId}`
            };
            flag = true;
          }
        }

        if (!flag) {
          let yId = $(this).find('a').eq(0).attr('data-yearid')
          const obj = {
            sub: [],
            name: year,
            yearId: yId,
            url: `https://www.autohome.com.cn/ashx/series_allspec.ashx?s=${series.seriesId}&y=${yId}`
          };

          series.sub.push(obj);
        }
      });

      // 下拉框中的年份抓取
      const curYears = $('.dropdown-content ul li');
      curYears.each(function () {
        let year = $(this).text();
        let flag = false;
        if (year !== '停售') {
          let hrefStrArr = $(this).find('a').attr('href').split('/')
          // console.log(hrefStrArr)
          let yearId = hrefStrArr[2]
          let url = 'https://www.autohome.com.cn/ashx/series_allspec.ashx?s=' + series.seriesId + '&y=' + yearId;
          for (item of series.sub) {
            if (item.yearId == yearId) {
              item = {
                name: year,
                yearId,
                sub: [],
                url
              };
              flag = true;
            }
          }

          if (!flag) {
            const obj = {
              name: year,
              yearId,
              sub: [],
              url: url
            };
            series.sub.push(obj);
          }
        }
      })

      curCount--;
      countSuccess++;
      let time = Date.now() - startTime;
      console.log(countSuccess + ', ' + series.url + ', 耗时 ' + time + 'ms');

      sleep(50);
      callback(null, series.url + 'Call back content');
    });
  };

  console.log('车系数据总共：' + count + '条，开始抓取...')

  // 使用async控制异步抓取   
  // mapLimit(arr, limit, iterator, [callback])
  // 异步回调
  async.mapLimit(seriesArr, 10, function (series, callback) {
    reptileMove(series, callback);
  }, function (err, result) {
    // 访问完成的回调函数
    console.log('----------------------------');
    console.log('车系抓取成功，共有数据：' + countSuccess);
    console.log('----------------------------');
    fetchName(req, res);
  });
}

/**
 * 爬取型号
 */
function fetchName(req, res) {
  let count = 0; // 总数
  let countSuccess = 0; // 成功数
  const yearArr = [];

  // 轮询所有车系
  for (let brand of fetchData) {
    for (let series of brand.sub) {
      for (let year of series.sub) {
        if (year.url) {
          count++;  // 过滤没有url的年款
          yearArr.push(year);
        }
      }
    }
  }

  let curCount = 0;
  let reptileMove = function (year, callback) {
    curCount++; // 并发数
    superagent
      .get(year.url)
      .buffer(true)
      .charset('gb2312')
      .end((err, res) => {
        try {
          let data = JSON.parse(res.text || '{"Spec":[]}')
          let specArr = data.Spec
          year.sub = []
          specArr.map(item => {
            year.sub.push({ specId: item.Id, name: item.Name })
          })
          curCount--;
          countSuccess++;
          callback(null, year.url + 'Call back content');
        } catch (e) { console.log(e) }
      })
  };

  console.log('车型数据总共：' + count + '条，开始抓取...')

  // 使用async控制异步抓取   
  // mapLimit(arr, limit, iterator, [callback])
  // 异步回调
  async.mapLimit(yearArr, 20, function (year, callback) {
    reptileMove(year, callback);
  }, function (err, result) {
    // 访问完成的回调函数
    console.log('----------------------------');
    console.log('车型抓取成功，共有数据：' + countSuccess);
    console.log('----------------------------');
    // res.send(fetchData);

    let t = JSON.stringify(fetchData);
    fs.writeFileSync('data.json', t);

    //将data.json存入MongoDB中
    fs.createReadStream(path.join(__dirname, './data.json'))
      .pipe(JSONStream.parse('*'))
      .pipe(saveToMongo)
      .on('execute-error', function (err) {
        console.log(err);
      })
      .on('done', function () {
        console.log('存入完毕!');
        process.exit(0);
      });
  });
}

/**
 * 爬虫入口
 */
fetchBrand();

/**
 * 配置MongoDB成功
 */
let saveToMongo = SaveToMongo({
  uri: 'mongodb://127.0.0.1:27017/autohome',  //mongoDB的地址
  collection: 'cardata',
  bulk: {
    mode: 'unordered'
  }
});
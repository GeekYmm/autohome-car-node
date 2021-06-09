# autohome-car-node

nodejs爬虫，抓取汽车之家网站品牌车系车型数据。包括品牌，车系，年份，车型四个层级。
品牌以及车系数据来源页面：`https://www.autohome.com.cn/car`
年代数据：`https://www.autohome.com.cn/3170/sale.html#pvareaid=3311673`
车型数据来源于接口：`https://www.autohome.com.cn/ashx/series_allspec.ashx?s=${seriesId}&y=${yearId}`
主要查考开源项目：`https://github.com/iNuanfeng/node-spider`

## 使用的node模块

  superagent, request, iconv; （网络请求模块，iconv用于gbk转码）

  cheerio; （和jQuery一样的API，处理请求来的html，省去正则匹配）

  eventproxy, async; （控制并发请求，async控制得更细）

  async控制并发请求数量为10个（避免封IP与网络错误）

  模拟sleep使间隔100ms（不设间隔偶尔会出现dns错误）

## 爬取步骤

   1. 抓取品牌和车系;
   2. 抓取年份;
   3. 抓取车型;
   4. 存入本地json文件;
   5. 自动存入MongoDB数据库

## 环境要求

运行项目前请先安装Node和MongoDB数据库

## 使用方法

```bash

#### 安装依赖
yarn install

#### 启动爬虫，数据存储于data.json
node app.js
```

## 协议

- [MIT](https://github.com/itead/IoTgo-Pro/blob/master/LICENSE)

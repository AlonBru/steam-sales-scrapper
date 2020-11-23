const app = require('express')()
require('dotenv').config()
const nodemailer = require('nodemailer')
const puppeteer = require('puppeteer');
const path = require('path')
const htmlMaker = require('./html')
const {MAIL_FROM,MAIL_TO,MAIL_SERVICE,MAIL_PASS,TERM} = process.env
const day = 1000*60*60*24
const transporter = nodemailer.createTransport({
  service: MAIL_SERVICE,
  auth: {
    user: MAIL_FROM,
    pass: MAIL_PASS
  }
});


const getSales = async (term,count=50) => {
  const browser = await puppeteer.launch({
    // headless: false
  })
  const page = await browser.newPage()  
  await page.goto('https://store.steampowered.com/search/results?term='+term+'&count='+count)
  // await page.waitForResponse('Request URL: https://store.steampowered.com/search/results?term='+term+'&force_infinite=1&snr=1_7_7_230_7') 
  await page.waitForSelector('div[class="responsive_search_name_combined"]')
  const titles = await page.$$eval('div.responsive_search_name_combined', links => {
    // Make sure the book to be scraped is in stock
    links = links.filter(link => link.querySelector('.search_discount > span'))
    // Extract the links from the data
    if(!links.length){return []}
    links = links.map(el => {
      const sale = el.querySelector('.search_price ').innerText
      index = sale.lastIndexOf('₪')
      const data = {
        title: el.querySelector('.title').textContent,
        discount: el.querySelector('.search_discount span').textContent,
        sale:sale.slice(index),
        price: el.querySelector('.search_price strike').textContent
      }
      return data
    })
    return links;
  });
  browser.close()
  return titles
}

const getRows =(games) => games.map(game=>{
  const row = [`<tr>\n`]
  Object.values(game)
  .forEach(value=>{row.push(`\t<td>${value}</td>\n`)})
  row.push[`\n</tr>`]
  return row.join('')
})

const sendMail = (mailOptions) => new Promise((resolve,reject)=>{
  transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          reject(error);
        } else {
          resolve(info)
        }
      });
})
const composeAndSend = (games,term) => {
  let mailOptions  
  if(games.length){
    const rows = getRows(games)
    const html = htmlMaker(term)
    const table = [
      html[0],
      ...rows,
      html[1]
    ]
    mailOptions = {
      from: MAIL_FROM,
      to: MAIL_TO,
      subject: 'Some Sales for you!',
      html: table.join('\n')
    };
  }else{
    mailOptions = {
      from: MAIL_FROM,
      to: MAIL_TO,
      subject: 'No sales today',
      text: 'could not find and sales for term '+term+' and range'+count
    };
  }
  return sendMail(mailOptions)
}
const getAndSend = (term,count) => {
  console.log(`sending term:${term},to:${MAIL_TO}`)
  return getSales(term,count)
  .then(games=> composeAndSend(games,term)) 
}
  
app.get('/ping',(req,res)=>{
  res.send('pong')
})

app.get('/mail',(req,res)=>{
  const term = req.query.term||TERM
  const count = Number(req.query.count)||50
  const repeat = Number(req.query.repeat)||0
  getAndSend(term,count)
  .then(info=>{
    if (!repeat){
      res.send(`sent envelope:${JSON.stringify(info.envelope)} for term '${term}'`)
    }else{
      setInterval(getAndSend,repeat*day,term,count)
      res.send(`sent envelope:${JSON.stringify(info.envelope)} for term '${term}'.
      setting interval to every ${repeat} days`)
    }
  })
  .catch(e=>res.send(e))
})

app.get('/get/:term',(req,res)=>{
  const {term} = req.params||TERM
  const {count} = req.query
  console.log('getting '+term)
  getSales(term,count)
  .then(sales=>{
    res.json(sales)
  })
})

app.get('/*', function (req, res) {
  res.sendFile(path.join(__dirname,  'index.html'));
});

app.listen(3001,()=>{
  console.log('I\'m up, I\'m Up!')
})
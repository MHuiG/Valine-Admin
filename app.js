'use strict';

var express = require('express');
var timeout = require('connect-timeout');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var AV = require('leanengine');
const searcher = require('evenboy-ip2region').create();

// 加载云函数定义，你可以将云函数拆分到多个文件方便管理，但需要在主文件中加载它们
require('./cloud');

var app = express();

// 设置模板引擎
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static('public'));

// 设置默认超时时间
app.use(timeout('15s'));

// 加载云引擎中间件
app.use(AV.express());

app.enable('trust proxy');
// 需要重定向到 HTTPS 可去除下一行的注释。
app.use(AV.Cloud.HttpsRedirect());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(AV.Cloud.CookieSession({ secret: 'my secret', maxAge: 3600000, fetchUser: true }));

// 解决跨域问题
app.all("/*", function(req, res, next) {
// 跨域处理
res.header("Access-Control-Allow-Origin", "*");
res.header("Access-Control-Allow-Headers", "X-Requested-With");
res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
res.header("X-Powered-By", ' 3.2.1');
next(); // 执行下一个路由
})
//查询IP
app.get('/lookUp', function (req, res, next) {
  if(!req.query.ip){
    res.json({
      success:false,
      msg:'IP不存在',
      data:null
    });
    return;
  }
  searcher.binarySearch(req.query.ip, function (err, tempData) {
    if (err) {
      res.json({
        success:false,
        msg:'解析错误',
        data:null
      });
      return;
    }
    console.log(tempData);
    let data=tempData.region.split("|");
    res.json({
        success:true,
        msg:'解析成功',
        data:{
          ip:req.query.ip,
          country:data[0],
          province:data[2],
          city:data[3],
          isp:data[4]
        }
    })
    
  });
});


//根据访问者IP返回区域
app.get('/getIp', function (req, res, next) {
  if(req.ip=="::1"){
    res.json({
      success:true,
      msg:'解析成功',
      data:{
        ip:'::1',
        country:0,
        province:0,
        city:0,
        isp:'本地IP'
      }
  });
  return;
  }
  let ip = getClientIp(req).match(/\d+.\d+.\d+.\d+/)[0];
  searcher.binarySearch(ip, function (err, tempData) {
    if (err) {
      res.json({
        success:false,
        msg:'解析错误',
        data:null
      });
      return;
    }
    let data=tempData.region.split("|");
    res.json({
        success:true,
        msg:'解析成功',
        data:{
          ip:ip,
          country:data[0],
          province:data[2],
          city:data[3],
          isp:data[4]
        }
    })
  });
});


let getClientIp = function (req) {
  return req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress || '';
};

app.get('/', function(req, res) {
    if (req.currentUser) {
        res.redirect('/comments');
    } else {
        res.render('index');
    }
});

// 可以将一类的路由单独保存在一个文件中
app.use('/comments', require('./routes/comments'));
app.use('/sign-up', require('./routes/sign-up'));

// 处理登录请求（可能来自登录界面中的表单）
app.post('/login', function (req, res) {
    AV.User.logIn(req.body.username, req.body.password).then(function (user) {
        let adminMail = process.env.BLOGGER_EMAIL || process.env.SMTP_USER;
        if (user.get('email') === adminMail) {
            res.saveCurrentUser(user); // 保存当前用户到 Cookie
            res.redirect('/comments');
        }
        else {
            res.redirect('/');
        }
    }, function (error) {
        //登录失败，跳转到登录页面
        res.redirect('/');
    });
});

// 登出账号
app.get('/logout', function(req, res) {
    req.currentUser.logOut();
    res.clearCurrentUser(); // 从 Cookie 中删除用户
    res.redirect('/');
});

app.use(function(req, res, next) {
    // 如果任何一个路由都没有返回响应，则抛出一个 404 异常给后续的异常处理器
    if (!res.headersSent) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    }
});
// error handlers
app.use(function(err, req, res, next) {
  if (req.timedout && req.headers.upgrade === 'websocket') {
    // 忽略 websocket 的超时
    return;
  }

  var statusCode = err.status || 500;
  if (statusCode === 500) {
    console.error(err.stack || err);
  }
  if (req.timedout) {
    console.error('请求超时: url=%s, timeout=%d, 请确认方法执行耗时很长，或没有正确的 response 回调。', req.originalUrl, err.timeout);
  }
  res.status(statusCode);
  // 默认不输出异常详情
  var error = {};
  if (app.get('env') === 'development') {
    // 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
    error = err;
  }
  res.render('error', {
    message: err.message,
    error: error
  });
});

app.locals.dateFormat = function (date) {
    var vDay = padWithZeros(date.getDate(), 2);
    var vMonth = padWithZeros(date.getMonth() + 1, 2);
    var vYear = padWithZeros(date.getFullYear(), 2);
    var vHour = padWithZeros(date.getHours(), 2);
    var vMinute = padWithZeros(date.getMinutes(), 2);
    var vSecond = padWithZeros(date.getSeconds(), 2);
    // return `${vYear}-${vMonth}-${vDay}`;
    return `${vYear}-${vMonth}-${vDay} ${vHour}:${vMinute}:${vSecond}`;
};

const padWithZeros = (vNumber, width) => {
    var numAsString = vNumber.toString();
    while (numAsString.length < width) {
        numAsString = '0' + numAsString;
    }
    return numAsString;
};

module.exports = app;

const AV = require('leanengine');
const mail = require('./utilities/send-mail');
const Comment = AV.Object.extend('Comment');
const request = require('postman-request');
const spam = require('./utilities/check-spam');
const block = require('./utilities/block');

function sendNotification(currentComment, defaultIp) {
	if(currentComment.get('url')=="TestPath"){
		console.log('TestPath，不会发送通知');
		return;
	}
	if (process.env.TEST!=1){
		let curl= currentComment.get('url')
		if (!(curl==""||curl=="TestPath"||curl=="/xCss.html"||curl=="/DesertsP.html")){
			let ccmt=currentComment.get('comment')+`<br/><p><strong>Get <code>App ID</code>/<code>App Key</code> from LeanCloud</strong><br><a href="https://leancloud.cn/dashboard/login.html#/signup">Click here</a> to register or login in <code>LeanCloud</code>.<br><a href="https://leancloud.cn/dashboard/applist.html#/newapp">Click here</a> Create new application in <code>LeanCloud</code>, and you will get <code>appId</code>/<code>appKey</code>.</p>`
			currentComment.set('comment', ccmt);
			currentComment.save();
		}
	}
    let ip = currentComment.get('ip') || defaultIp;
    console.log('IP: %s', ip);
	let IPv4reg = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/
	let IPv6reg = /^([\da-fA-F]{1,4}:){7}[\da-fA-F]{1,4}$/
	let localAreg = /^10\.(1\d{2}|2[0-4]\d|25[0-5]|[1-9]\d|[0-9])\.(1\d{2}|2[0-4]\d|25[0-5]|[1-9]\d|[0-9])\.(1\d{2}|2[0-4]\d|25[0-5]|[1-9]\d|[0-9])$/   //10.0.0.0~10.255.255.255（A类）
	let localBreg = /^172\.(1[6789]|2[0-9]|3[01])\.(1\d{2}|2[0-4]\d|25[0-5]|[1-9]\d|[0-9])\.(1\d{2}|2[0-4]\d|25[0-5]|[1-9]\d|[0-9])$/   //172.16.0.0~172.31.255.255（B类）
	let localCreg = /^192\.168\.(1\d{2}|2[0-4]\d|25[0-5]|[1-9]\d|[0-9])\.(1\d{2}|2[0-4]\d|25[0-5]|[1-9]\d|[0-9])$/   //192.168.0.0~192.168.255.255（C类）
	let localreg = /^127(.(([1-9]?|1[0-9])[0-9]|2([0-4][0-9]|5[0-5]))){3}$/   //回环127
	let Emailreg = /^[A-Za-z0-9\u4e00-\u9fa5]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/
	if ((typeof currentComment.get('ip') == 'undefined')||(!(IPv4reg.test(currentComment.get('ip'))||IPv6reg.test(currentComment.get('ip'))))||(localAreg.test(currentComment.get('ip')))||(localBreg.test(currentComment.get('ip')))||(localCreg.test(currentComment.get('ip')))||(localreg.test(currentComment.get('ip')))){
		block.add(currentComment);
		currentComment.set('isSpam', true);
		currentComment.setACL(new AV.ACL({"*":{"read":false}}));
		currentComment.save();
		console.log('IP未通过审核..');
		return
	}
	console.log('Email: %s', currentComment.get('mail'));
	if ((typeof currentComment.get('mail') == 'undefined')||(!Emailreg.test(currentComment.get('mail')))){
		block.add(currentComment);
		currentComment.set('isSpam', true);
		currentComment.setACL(new AV.ACL({"*":{"read":false}}));
		currentComment.save();
		console.log('Email未通过审核..');
		return
	}
	spam.checkSpam(currentComment, ip);
	setTimeout(function() {
		if (currentComment.get('isSpam')) {
			block.add(currentComment);
			console.log('评论未通过审核，通知邮件暂不发送');
			return;
		}
		// 发送博主通知邮件
		if (process.env.SEND_BLOGGER_EMAIL!=0){
			if (currentComment.get('mail') !== process.env.BLOGGER_EMAIL) {
				mail.notice(currentComment);
			}
		}
		// 发送AT评论通知
		let rid =currentComment.get('pid') || currentComment.get('rid');
		if (!rid) {
			console.log("这条评论没有 @ 任何人");
			return;
		}
		let query = new AV.Query('Comment');
		query.get(rid).then(function (parentComment) {
			if (parentComment.get('mail') && parentComment.get('mail') !== process.env.BLOGGER_EMAIL) {
				mail.send(currentComment, parentComment);
			} else {
				console.log('被@者匿名，不会发送通知');
			}
			
		}, function (error) {
			console.warn('获取@对象失败！');
		});
	},20000);
}

AV.Cloud.afterSave('Comment', function (req) {
    let currentComment = req.object;
    return sendNotification(currentComment, req.meta.remoteAddress);
});

AV.Cloud.define('resend_mails', function(req) {
    let query = new AV.Query(Comment);
    query.greaterThanOrEqualTo('createdAt', new Date(new Date().getTime() - 24*60*60*1000));
    query.notEqualTo('isNotified', true);
    // max 1000
    query.limit(1000);
    return query.find().then(function(results) {
        new Promise((resolve, reject)=>{
            count = results.length;
            for (var i = 0; i < results.length; i++ ) {
                sendNotification(results[i], req.meta.remoteAddress);
            }
            resolve(count);
        }).then((count)=>{
            console.log(`昨日${count}条未成功发送的通知邮件处理完毕！`);
        }).catch(()=>{

        });
    });
  });

AV.Cloud.define('self_wake', function(req) {
    request(process.env.ADMIN_URL, function (error, response, body) {
        console.log('自唤醒任务执行成功');
      });
});

AV.Cloud.define('check_spam', function(req) {
	console.log('正在检查垃圾评论');
	let IPv4reg = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/
	let IPv6reg = /^([\da-fA-F]{1,4}:){7}[\da-fA-F]{1,4}$/
	let Emailreg = /^[A-Za-z0-9\u4e00-\u9fa5]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/
    let query = new AV.Query(Comment);
	query.descending('createdAt');
    query.notEqualTo('isSpam', true);
    query.limit(30);
	const SpamChecker=(o)=>{
		try{
			if ((typeof o.get('ip') == 'undefined')||(!(IPv4reg.test(o.get('ip'))||IPv6reg.test(o.get('ip'))))){
				o.set('isSpam', true);
				o.setACL(new AV.ACL({"*":{"read":false}}));
				o.save();
				console.log(o);
				console.log('IP未通过审核..');
			}else if ((typeof o.get('mail') == 'undefined')||(!Emailreg.test(o.get('mail')))){
				o.set('isSpam', true);
				o.setACL(new AV.ACL({"*":{"read":false}}));
				o.save();
				console.log(o);
				console.log('Email未通过审核..');
			}else{
				console.log('通过审核..');
				o.set('isSpam', false);
				o.save();
			}
		}catch(e){
			console.log(o)
			console.log(e)
		}
	}
    query.find().then(function(results) {
		count = results.length;
		console.log(`共检查${count}条评论`);
		const requests=results.map((result)=>{
			return new Promise(()=>{
				SpamChecker(result)
			})
		})
		return Promise.all(requests).then(()=>{
            console.log(`处理完毕！`);
        }).catch(()=>{

        });
    });
	return 0;
});


const AV = require('leanengine');
const mail = require('./utilities/send-mail');
const Comment = AV.Object.extend('Comment');
const Block = AV.Object.extend('Block');
const request = require('postman-request');
const spam = require('./utilities/check-spam');

function createBlocker(Block,o){
	const newBlock = new Block();
	const acl = new AV.ACL()
	acl.setPublicReadAccess(true)
	acl.setPublicWriteAccess(true)
	newBlock.setACL(acl)
	newBlock.set('ip', o.get('ip'))
	newBlock.set('ua', o.get('ua'))
	newBlock.set('time',1)
	newBlock.save().catch(ex => {
		console.log(ex)
	})
}

function addBlocker(o){
    const query = new AV.Query(Block)
    query.equalTo('ip', o.get('ip'))
    query.find().then(ret => {
      if (ret.length > 0) {
		var v = ret[0]
		for (var i=0;i<ret.length;i++){
			if(ret[i].get("ua")==o.get('ua')){
				v = ret[i]
				return
			}
		}
        v.increment('time')
        v.save().catch(ex => {
          console.log(ex)
        })
      } else {
        createBlocker(Block, o)
      }
    }).catch(ex => {
      ex.code == 101 && createBlocker(Block, o)
    })
}

function sendNotification(currentComment, defaultIp) {
	
	if(currentComment.get('url')=="TestPath"){
		console.log('TestPath，不会发送通知');
		return;
	}

    let ip = currentComment.get('ip') || defaultIp;
    console.log('IP: %s', ip);
	let IPv4reg = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/
	let IPv6reg = /^([\da-fA-F]{1,4}:){7}[\da-fA-F]{1,4}$/
	let Emailreg = /^[A-Za-z0-9\u4e00-\u9fa5]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/
	if ((typeof currentComment.get('ip') == 'undefined')||(!(IPv4reg.test(currentComment.get('ip'))||IPv6reg.test(currentComment.get('ip'))))){
		currentComment.set('isSpam', true);
		currentComment.setACL(new AV.ACL({"*":{"read":false}}));
		currentComment.save();
		console.log('IP未通过审核..');
		addBlocker(currentComment);
		return
	}else{
	    spam.checkSpam(currentComment, ip);
	}
	console.log('Email: %s', currentComment.get('mail'));
    if ((typeof currentComment.get('mail') == 'undefined')||(!Emailreg.test(currentComment.get('mail')))){
		currentComment.set('isSpam', true);
		currentComment.setACL(new AV.ACL({"*":{"read":false}}));
		currentComment.save();
		console.log('Email未通过审核..');
		addBlocker(currentComment);
		return
	}

	if (currentComment.get('isSpam')) {
        console.log('评论未通过审核，通知邮件暂不发送');
		addBlocker(currentComment);
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
}

AV.Cloud.afterSave('Comment', function (req) {
    let currentComment = req.object;
    // 检查垃圾评论
    return sendNotification(currentComment, req.meta.remoteAddress);
});

AV.Cloud.define('resend_mails', function(req) {
    let query = new AV.Query(Comment);
    query.greaterThanOrEqualTo('createdAt', new Date(new Date().getTime() - 24*60*60*1000));
    query.notEqualTo('isNotified', true);
    // 如果你的评论量很大，可以适当调高数量限制，最高1000
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


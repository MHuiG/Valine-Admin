'use strict';
const nodemailer = require('nodemailer');

let config = {
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
}

if (process.env.SMTP_SERVICE != null) {
    config.service = process.env.SMTP_SERVICE;
} else {
    config.host = process.env.SMTP_HOST;
    config.port = parseInt(process.env.SMTP_PORT);
    config.secure = process.env.SMTP_SECURE === "false" ? false : true;
}

const transporter = nodemailer.createTransport(config);

transporter.verify(function(error, success) {
    if (error) {
        console.log('SMTP邮箱配置异常：', error);
    }
    if (success) {
        console.log("SMTP邮箱配置正常！");
    }
}); 

exports.notice = (comment) => {
    let SITE_NAME = process.env.SITE_NAME;
    let NICK = comment.get('nick');
    let COMMENT = comment.get('comment');
    let POST_URL = process.env.SITE_URL + comment.get('url') + '#' + comment.get('objectId');
    let SITE_URL = process.env.SITE_URL;

    let _template = process.env.MAIL_TEMPLATE_ADMIN || `<div style="border-radius: 10px 10px 10px 10px;font-size:13px;    color: #555555;width: 666px;font-family:'Century Gothic','Trebuchet MS','Hiragino Sans GB',微软雅黑,'Microsoft Yahei',Tahoma,Helvetica,Arial,'SimSun',sans-serif;margin:50px auto;border:1px solid #eee;max-width:100%;background: #ffffff repeating-linear-gradient(-45deg,#fff,#fff 1.125rem,transparent 1.125rem,transparent 2.25rem);box-shadow: 0 1px 5px rgba(0, 0, 0, 0.15);"><div style="width:100%;background:#49BDAD;color:#ffffff;border-radius: 10px 10px 0 0;background-image: -moz-linear-gradient(0deg, rgb(67, 198, 184), rgb(255, 209, 244));background-image: -webkit-linear-gradient(0deg, rgb(67, 198, 184), rgb(255, 209, 244));height: 66px;"><p style="font-size:15px;word-break:break-all;padding: 23px 32px;margin:0;background-color: hsla(0,0%,100%,.4);border-radius: 10px 10px 0 0;">You have new comments on <a style="text-decoration:none;color: #ffffff;" href="${SITE_URL}">${SITE_NAME}</a>!</p></div><div style="margin:40px auto;width:90%"><p>${NICK} 's reply to you is as follows:</p><div style="background: #fafafa repeating-linear-gradient(-45deg,#fff,#fff 1.125rem,transparent 1.125rem,transparent 2.25rem);box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);margin:20px 0px;padding:15px;border-radius:5px;font-size:14px;color:#555555;">${COMMENT}</div><p>You can click <a style="text-decoration:none; color:#12addb" href="${POST_URL}#comments"> to view the complete content of the reply </a>, welcome to come again <a style = "text- decoration: none; color: # 12addb "href ="${SITE_URL}">${SITE_NAME}</a>.</p><style type="text/css">a:link{text-decoration:none}a:visited{text-decoration:none}a:hover{text-decoration:none}a:active{text-decoration:none}</style></div></div>`;
    let _subject = process.env.MAIL_SUBJECT_ADMIN || 'There are new comments on ${SITE_NAME}!';
    let emailSubject = eval('`' + _subject + '`');
    let emailContent = eval('`' + _template + '`');

    let mailOptions = {
        from: '"' + process.env.SENDER_NAME + '" <' + process.env.SENDER_EMAIL + '>',
        to: process.env.BLOGGER_EMAIL || process.env.SENDER_EMAIL,
        subject: emailSubject,
        html: emailContent
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('博主通知邮件发送失败: %s', error);
        }
        console.log('博主通知邮件成功发送: %s', info.response);
        comment.set('isNotified', true);
        comment.save();
    });
}

exports.send = (currentComment, parentComment)=> {
    let PARENT_NICK = parentComment.get('nick');
    let SITE_NAME = process.env.SITE_NAME;
    let SMTP_USER = process.env.SMTP_USER;
    let NICK = currentComment.get('nick');
    let COMMENT = currentComment.get('comment');
    let PARENT_COMMENT = parentComment.get('comment');
    let POST_URL = process.env.SITE_URL + currentComment.get('url') + '#' + currentComment.get('objectId');
    let SITE_URL = process.env.SITE_URL;

    let _subject = process.env.MAIL_SUBJECT || '${PARENT_NICK}, there is a new reply to your message on ${SITE_NAME}!';
    let _template = process.env.MAIL_TEMPLATE || `<div style="border-radius: 10px 10px 10px 10px;font-size:13px;    color: #555555;width: 666px;font-family:'Century Gothic','Trebuchet MS','Hiragino Sans GB',微软雅黑,'Microsoft Yahei',Tahoma,Helvetica,Arial,'SimSun',sans-serif;margin:50px auto;border:1px solid #eee;max-width:100%;background: #ffffff repeating-linear-gradient(-45deg,#fff,#fff 1.125rem,transparent 1.125rem,transparent 2.25rem);box-shadow: 0 1px 5px rgba(0, 0, 0, 0.15);"><div style="width:100%;background:#49BDAD;color:#ffffff;border-radius: 10px 10px 0 0;background-image: -moz-linear-gradient(0deg, rgb(67, 198, 184), rgb(255, 209, 244));background-image: -webkit-linear-gradient(0deg, rgb(67, 198, 184), rgb(255, 209, 244));height: 66px;"><p style="font-size:15px;word-break:break-all;padding: 23px 32px;margin:0;background-color: hsla(0,0%,100%,.4);border-radius: 10px 10px 0 0;">Your comment on <a style="text-decoration:none;color: #ffffff;" href="${SITE_URL}">${SITE_NAME}</a> has a new reply!</p></div><div style="margin:40px auto;width:90%"><p>${PARENT_NICK} classmate, you have commented on the article:</p><div style="background: #fafafa repeating-linear-gradient(-45deg,#fff,#fff 1.125rem,transparent 1.125rem,transparent 2.25rem);box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);margin:20px 0px;padding:15px;border-radius:5px;font-size:14px;color:#555555;">${PARENT_COMMENT}</div><p>${NICK}'s reply to you is as follows:</p><div style="background: #fafafa repeating-linear-gradient(-45deg,#fff,#fff 1.125rem,transparent 1.125rem,transparent 2.25rem);box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);margin:20px 0px;padding:15px;border-radius:5px;font-size:14px;color:#555555;">${COMMENT}</div><p>You can click <a style="text-decoration:none; color:#12addb" href="${POST_URL}#comments"> to view the complete content of the reply </a>, welcome to come again <a style ="text- decoration: none; color: #12addb"href ="${SITE_URL}"> ${SITE_NAME} </a>.</p><style type="text/css">a:link{text-decoration:none}a:visited{text-decoration:none}a:hover{text-decoration:none}a:active{text-decoration:none}</style></div></div>`;
    let _template_more=`
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js/styles/github.css">
	<script src="https://polyfill.io/v3/polyfill.min.js?features=es6" async></script>
	<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>
	<script>
	  window['MathJax'] = {
		  tex: {
			inlineMath: [ ['$','$']],
			autoload: {
				verb: ['verb'],
				color: [],
				colorV2: ['color'],
				require:['require']
			},
			packages: {'[+]': ['braket']}
		  },
		  loader: {load: ['[tex]/braket']},
		  svg: {
			fontCache: 'global'
		  }
	  };
	</script>
	`
	let emailSubject = eval('`' + _subject + '`');
    let emailContent = eval('`' + _template+ _template_more + '`');

    let mailOptions = {
        from: '"' + process.env.SENDER_NAME + '" <' + process.env.SENDER_EMAIL + '>', // sender address
        to: parentComment.get('mail'),
		cc: SMTP_USER,
        subject: emailSubject,
        html: emailContent
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('AT通知邮件发送失败: %s', error);
        }
        console.log('AT通知邮件成功发送: %s', info.response);
        currentComment.set('isNotified', true);
        currentComment.save();
    });
};

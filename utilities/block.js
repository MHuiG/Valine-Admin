const AV = require('leanengine');
const Block = AV.Object.extend('Block');

function createBlocker(o){
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

exports.add = (o)=> {
    const query = new AV.Query(Block)
    query.equalTo('ip', o.get('ip'))
    query.find().then(ret => {
      if (ret.length > 0) {
		var v = ret[0]
		for (var i=0;i<ret.length;i++){
			if(ret[i].get("ua")==o.get('ua')){
				v = ret[i]
				break
			}
		}
		if(v.get("ua")!=o.get('ua')){
			createBlocker(o)
			return
		}
        v.increment('time')
        v.save().catch(ex => {
          console.log(ex)
        })
      } else {
        createBlocker(o)
      }
    }).catch(ex => {
      ex.code == 101 && createBlocker(o)
    })
}
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const parent=Number(process.env.COMPANION_PARENT_PID);
if(parent>0)setInterval(()=>{try{process.kill(parent,0);}catch(error){if(error.code==='ESRCH')process.exit(0);}},2000).unref();
import(pathToFileURL(path.resolve(__dirname,'../source/tracker/.output/server/index.mjs')).href);

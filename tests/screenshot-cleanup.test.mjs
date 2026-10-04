import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ScreenshotCleanup} from '../screenshot-cleanup.mjs';

test('cleanup waits for stable coordinate screenshots and preserves unrelated files',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tarkov-cleanup-'));
  const name='2026-10-04[12-00]_(1,2,3)_(0,0,0,1).png',file=path.join(dir,name);
  try {
    fs.writeFileSync(file,'first');fs.writeFileSync(path.join(dir,'Screenshot 2026-10-04.png'),'keep');
    fs.mkdirSync(path.join(dir,'nested'));fs.writeFileSync(path.join(dir,'nested',name),'keep');
    const cleaner=new ScreenshotCleanup();cleaner.scan(dir,true,0);cleaner.scan(dir,true,2000);assert.ok(fs.existsSync(file));
    fs.appendFileSync(file,'more');cleaner.scan(dir,true,3000);cleaner.scan(dir,true,5000);assert.ok(fs.existsSync(file));
    cleaner.scan(dir,true,6000);assert.ok(!fs.existsSync(file));assert.equal(cleaner.deleted,1);
    assert.ok(fs.existsSync(path.join(dir,'Screenshot 2026-10-04.png')));assert.ok(fs.existsSync(path.join(dir,'nested',name)));
    fs.writeFileSync(file,'again');cleaner.scan(dir,true,7000);cleaner.scan(dir,false,11000);assert.ok(fs.existsSync(file));
    cleaner.scan(dir,true,12000);assert.ok(fs.existsSync(file));cleaner.scan(dir,true,15000);assert.ok(!fs.existsSync(file));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

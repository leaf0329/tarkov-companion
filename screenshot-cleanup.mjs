import fs from 'node:fs';
import path from 'node:path';
import {parseScreenshot} from './public/coordinates.mjs';

export class ScreenshotCleanup {
  constructor(){this.pending=new Map();this.deleted=0;this.error=null;}
  scan(directory,enabled,now=Date.now()) {
    if(!enabled){this.pending.clear();this.error=null;return;}
    const root=path.resolve(directory),present=new Set();this.error=null;
    try {
      for(const name of fs.readdirSync(root)) {
        if(path.basename(name)!==name || !parseScreenshot(name))continue;
        const file=path.resolve(root,name);
        if(path.dirname(file)!==root)continue;
        present.add(file);
        try {
          const stat=fs.lstatSync(file);
          if(!stat.isFile() || stat.isSymbolicLink())continue;
          const signature=stat.size+':'+stat.mtimeMs,previous=this.pending.get(file);
          if(!previous || previous.signature!==signature){this.pending.set(file,{signature,since:now});continue;}
          if(now-previous.since<3000)continue;
          // Wait for a stable file; a Windows sharing violation is retried next poll.
          fs.unlinkSync(file);this.pending.delete(file);this.deleted++;
        }catch(e){if(e.code!=='ENOENT')this.error=e.code;}
      }
      for(const file of this.pending.keys())if(!present.has(file))this.pending.delete(file);
    }catch(e){this.error=e.code;}
  }
}

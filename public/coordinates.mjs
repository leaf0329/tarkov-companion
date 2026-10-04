export function solve(matrix, values) {
  const a = matrix.map((row, i) => [...row, values[i]]), n = values.length;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    if (Math.abs(a[pivot][i]) < 1e-12) throw new Error('地图校准点不足或共线');
    [a[i], a[pivot]] = [a[pivot], a[i]];
    const divisor = a[i][i];
    for (let k = i; k <= n; k++) a[i][k] /= divisor;
    for (let j = 0; j < n; j++) if (j !== i) {
      const factor = a[j][i];
      for (let k = i; k <= n; k++) a[j][k] -= factor * a[i][k];
    }
  }
  return a.map(row => row[n]);
}
const radial = r2 => r2 < 1e-16 ? 0 : r2 * Math.log(r2);
export function buildProjection(layer) {
  if (layer.matrix) {
    const [a,b,c,d,e,f] = layer.matrix;
    return (x,z) => [a*x+b*z+c, d*x+e*z+f];
  }
  const tps = layer.tps;
  if (!tps || tps.game_points.length < 3) return null;
  const origin = tps.game_points[0];
  const scale = Math.max(1, ...tps.game_points.flatMap(p => [Math.abs(p[0]-origin[0]), Math.abs(p[1]-origin[1])]));
  const points = tps.game_points.map(p => [(p[0]-origin[0])/scale,(p[1]-origin[1])/scale]);
  const n = points.length;
  const rows = points.map(([x,z]) => [...points.map(([u,v]) => radial((x-u)**2+(z-v)**2)),1,x,z]);
  rows.push([...points.map(()=>1),0,0,0], [...points.map(p=>p[0]),0,0,0], [...points.map(p=>p[1]),0,0,0]);
  const cx = solve(rows, [...tps.img_points.map(p=>p[0]),0,0,0]);
  const cy = solve(rows, [...tps.img_points.map(p=>p[1]),0,0,0]);
  return (x,z) => {
    x=(x-origin[0])/scale; z=(z-origin[1])/scale;
    const weights = [...points.map(([u,v])=>radial((x-u)**2+(z-v)**2)),1,x,z];
    return [cx.reduce((s,c,i)=>s+c*weights[i],0),cy.reduce((s,c,i)=>s+c*weights[i],0)];
  };
}
export function selectCalibratedLayer(layers,position,getProjection=buildProjection) {
  // A regional inset must take precedence over a map-wide layer at the same height.
  const candidates=layers.filter(l=>l.enabled && position.y>=l.min && position.y<=l.max)
    .sort((a,b)=>Number(!!b.includes?.length)-Number(!!a.includes?.length));
  for(const layer of candidates){
    const project=getProjection(layer);if(!project)continue;
    const [x,y]=project(position.x,position.z);
    if(!Number.isFinite(x) || !Number.isFinite(y))continue;
    const inside=r=>x>=r[0] && y>=r[1] && x<=r[0]+r[2] && y<=r[1]+r[3];
    if(layer.includes?.length && !layer.includes.some(inside))continue;
    if(layer.excludes?.some(inside))continue;
    return layer.index;
  }
  return null;
}
export function parseScreenshot(filename) {
  const m = filename.match(/^\d{4}-\d{2}-\d{2}\[\d{2}-\d{2}(?:-\d{2})?\]_?\(?\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)?(?:_?\(?\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)?)?.*\.png$/i);
  if (!m) return null;
  const [x,y,z] = m.slice(1,4).map(Number);
  if (![x,y,z].every(Number.isFinite)) return null;
  let yaw = null;
  if (m[4] !== undefined) {
    const [qx,qy,qz,qw] = m.slice(4,8).map(Number);
    yaw = Math.atan2(2*(qw*qy+qx*qz),1-2*(qy*qy+qx*qx))*180/Math.PI;
  }
  return { x,y,z,yaw };
}

export function taskLocationPoints(points) {
  const groups=[];
  for(const point of points){
    const group=groups.find(g=>g.taskId===point.taskId && g.layer===point.layer);
    if(group)group.points.push(point);
    else groups.push({...point,representative:point,points:[point]});
  }
  return groups;
}

export function clusterPoints(points,scale,radius=28) {
  const groups=[];
  for(const point of points) {
    const group=groups.find(g=>g.taskId===point.taskId && g.layer===point.layer && Math.hypot(point.x-g.points[0].x,point.y-g.points[0].y)*scale<radius);
    if(group)group.points.push(point);
    else groups.push({...point,points:[point]});
  }
  return groups.map(group=>{
    const x=group.points.reduce((sum,p)=>sum+p.x,0)/group.points.length;
    const y=group.points.reduce((sum,p)=>sum+p.y,0)/group.points.length;
    const representative=group.points.reduce((best,p)=>Math.hypot(p.x-x,p.y-y)<Math.hypot(best.x-x,best.y-y)?p:best);
    return {...group,x,y,representative};
  });
}

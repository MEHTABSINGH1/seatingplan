export type Stu={id:number;name:string;roll_no:string;cls:string};
export type Room={id:number;name:string;rows:number;benches:number;per_bench:number};
export type Seat={room:string;row:number;bench:number;slot:number;stu?:Stu};
const shuffle=<T,>(a:T[])=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const num=(r:string)=>parseInt(r.replace(/\D/g,''))||0;
export const capacity=(r:Room)=>r.rows*r.benches*r.per_bench;

/** Constraint-aware randomized greedy: fills seats in order; for each seat picks a class
 *  (weighted by remaining count, so big classes are never stranded) that is not on the same
 *  bench, left bench, or bench in front; relaxes constraints only when impossible. */
export function generate(students:Stu[],rooms:Room[]){
  const pools=new Map<string,Stu[]>();
  for(const s of shuffle(students)){if(!pools.has(s.cls))pools.set(s.cls,[]);pools.get(s.cls)!.push(s)}
  const seats:Seat[]=[];
  for(const r of rooms)for(let row=1;row<=r.rows;row++)for(let b=1;b<=r.benches;b++)for(let k=1;k<=r.per_bench;k++)seats.push({room:r.name,row,bench:b,slot:k});
  const bench=new Map<string,Stu[]>(); const key=(m:string,r:number,b:number)=>`${m}|${r}|${b}`;
  let benchConflicts=0,adjConflicts=0,placed=0;
  for(const seat of seats){
    if(placed>=students.length)break;
    const here=bench.get(key(seat.room,seat.row,seat.bench))??[];
    const nb=[...(bench.get(key(seat.room,seat.row,seat.bench-1))??[]),...(bench.get(key(seat.room,seat.row-1,seat.bench))??[])];
    const live=[...pools.entries()].filter(([,p])=>p.length);
    const ok=(strict:boolean)=>live.filter(([c])=>!here.some(s=>s.cls===c)&&(!strict||!nb.some(s=>s.cls===c)));
    let cand=ok(true);if(!cand.length)cand=ok(false);if(!cand.length)cand=live;
    let t=Math.random()*cand.reduce((a,[,p])=>a+p.length**2,0),pick=cand[0];
    for(const e of cand){t-=e[1].length**2;if(t<=0){pick=e;break}}
    const pool=pick[1];
    let idx=pool.slice(0,6).findIndex(s=>[...here,...nb].every(n=>Math.abs(num(n.roll_no)-num(s.roll_no))>1));
    if(idx<0)idx=0;
    const stu=pool.splice(idx,1)[0];
    if(here.some(s=>s.cls===stu.cls))benchConflicts++;
    if(nb.some(s=>s.cls===stu.cls))adjConflicts++;
    seat.stu=stu;here.push(stu);bench.set(key(seat.room,seat.row,seat.bench),here);placed++;
  }
  const notes:string[]=[];
  if(benchConflicts)notes.push(`${benchConflicts} student(s) share a bench with a classmate: one class is too large to separate with this room layout.`);
  if(adjConflicts)notes.push(`${adjConflicts} student(s) sit next to/behind a classmate (unavoidable with the class mix and capacity).`);
  return{seats,benchConflicts,adjConflicts,notes};
}

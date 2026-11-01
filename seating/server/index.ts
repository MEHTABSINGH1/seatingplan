import express from 'express';import cors from 'cors';import Database from 'better-sqlite3';import ExcelJS from 'exceljs';
import {generate,capacity,Room,Stu} from './seating.js';
const db=new Database('seating.db');db.pragma('journal_mode=WAL');
db.exec(`CREATE TABLE IF NOT EXISTS students(id INTEGER PRIMARY KEY,name TEXT NOT NULL,roll_no TEXT NOT NULL UNIQUE,class_name TEXT NOT NULL,section TEXT NOT NULL,batch TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS classrooms(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,rows INTEGER NOT NULL,benches INTEGER NOT NULL,per_bench INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS exams(id INTEGER PRIMARY KEY,name TEXT,subject TEXT,date TEXT,time TEXT,classes TEXT,rooms TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS arrangements(id INTEGER PRIMARY KEY,exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,version INTEGER,data TEXT,notes TEXT,saved INTEGER DEFAULT 0,created TEXT DEFAULT CURRENT_TIMESTAMP);`);
// sample data for first run only
if(!(db.prepare('select count(*) c from students').get() as any).c){
  const ins=db.prepare('insert into students(name,roll_no,class_name,section,batch) values(?,?,?,?,?)');
  db.transaction(()=>{for(const [c,s,n] of [['CSE','A',30],['CSE','B',35],['CSE','C',25],['IT','A',20]] as const)for(let i=1;i<=n;i++)ins.run(`Student ${c}${s}-${i}`,`${c}${s}${String(i).padStart(3,'0')}`,c,s,'2023')})();
  db.prepare('insert into classrooms(name,rows,benches,per_bench) values(?,?,?,?)').run('Room 101',5,4,2);
  db.prepare('insert into classrooms(name,rows,benches,per_bench) values(?,?,?,?)').run('Room 102',6,5,2);
  db.prepare('insert into classrooms(name,rows,benches,per_bench) values(?,?,?,?)').run('Room 103',5,4,2);
}
const app=express();app.use(cors(),express.json({limit:'20mb'}));
const A=(f:any)=>(q:any,r:any)=>{try{f(q,r)}catch(e:any){r.status(400).json({error:e.code==='SQLITE_CONSTRAINT_UNIQUE'?'Duplicate value (roll number / room name already exists)':e.message})}};
const S='insert into students(name,roll_no,class_name,section,batch) values(@name,@roll_no,@class_name,@section,@batch)';
app.get('/api/students',A((_:any,r:any)=>r.json(db.prepare('select * from students order by class_name,section,roll_no').all())));
app.post('/api/students',A((q:any,r:any)=>r.json({id:db.prepare(S).run(q.body).lastInsertRowid})));
app.put('/api/students/:id',A((q:any,r:any)=>{db.prepare('update students set name=@name,roll_no=@roll_no,class_name=@class_name,section=@section,batch=@batch where id=@id').run({...q.body,id:q.params.id});r.json({ok:1})}));
app.delete('/api/students/:id',A((q:any,r:any)=>{db.prepare('delete from students where id=?').run(q.params.id);r.json({ok:1})}));
app.post('/api/students/bulk',A((q:any,r:any)=>{const st=db.prepare(S);let added=0;const dups:string[]=[];
  db.transaction(()=>{for(const s of q.body.students){try{st.run({batch:'',section:'',...s});added++}catch{dups.push(s.roll_no)}}})();r.json({added,duplicates:dups})}));
app.get('/api/classrooms',A((_:any,r:any)=>r.json(db.prepare('select * from classrooms').all())));
app.post('/api/classrooms',A((q:any,r:any)=>{const b=q.body;if(!(b.rows>0&&b.benches>0&&b.per_bench>0))throw new Error('Rows, benches and students per bench must be positive');r.json({id:db.prepare('insert into classrooms(name,rows,benches,per_bench) values(@name,@rows,@benches,@per_bench)').run(b).lastInsertRowid})}));
app.delete('/api/classrooms/:id',A((q:any,r:any)=>{db.prepare('delete from classrooms where id=?').run(q.params.id);r.json({ok:1})}));
app.get('/api/exams',A((_:any,r:any)=>r.json(db.prepare('select * from exams order by id desc').all().map((e:any)=>({...e,classes:JSON.parse(e.classes),rooms:JSON.parse(e.rooms)})))));
app.post('/api/exams',A((q:any,r:any)=>{const b=q.body;r.json({id:db.prepare('insert into exams(name,subject,date,time,classes,rooms) values(?,?,?,?,?,?)').run(b.name,b.subject,b.date,b.time,JSON.stringify(b.classes),JSON.stringify(b.rooms)).lastInsertRowid})}));
app.delete('/api/exams/:id',A((q:any,r:any)=>{db.prepare('delete from exams where id=?').run(q.params.id);r.json({ok:1})}));
app.get('/api/exams/:id/arrangements',A((q:any,r:any)=>r.json(db.prepare('select * from arrangements where exam_id=? order by version desc').all(q.params.id).map((a:any)=>({...a,data:JSON.parse(a.data),notes:JSON.parse(a.notes)})))));
app.post('/api/exams/:id/generate',A((q:any,r:any)=>{
  const e:any=db.prepare('select * from exams where id=?').get(q.params.id);const classes:string[]=JSON.parse(e.classes),ids:number[]=JSON.parse(e.rooms);
  const studs=(db.prepare('select id,name,roll_no,class_name||"-"||section cls from students').all() as Stu[]).filter(s=>classes.includes(s.cls));
  const rooms=ids.map(i=>db.prepare('select * from classrooms where id=?').get(i) as Room).filter(Boolean);
  const cap=rooms.reduce((a,x)=>a+capacity(x),0);
  if(!studs.length)throw new Error('No students in selected classes');
  if(cap<studs.length)return r.status(422).json({error:`Insufficient capacity: ${studs.length} students, ${cap} seats. ${studs.length-cap} additional seat(s) required.`});
  const prev=new Set((db.prepare('select data from arrangements where exam_id=?').all(q.params.id) as any[]).map(a=>a.data));
  let g=generate(studs,rooms),data=JSON.stringify(g.seats);
  for(let i=0;i<10&&prev.has(data);i++){g=generate(studs,rooms);data=JSON.stringify(g.seats)} // avoid repeating a past arrangement
  const seated=new Set(g.seats.filter(s=>s.stu).map(s=>s.stu!.id));
  if(seated.size!==studs.length||g.seats.filter(s=>s.stu).length!==studs.length)throw new Error('Integrity check failed: assignment mismatch');
  const v=((db.prepare('select max(version) m from arrangements where exam_id=?').get(q.params.id) as any).m||0)+1;
  const id=db.prepare('insert into arrangements(exam_id,version,data,notes) values(?,?,?,?)').run(q.params.id,v,data,JSON.stringify(g.notes)).lastInsertRowid;
  r.json({id,version:v});}));
app.post('/api/arrangements/:id/save',A((q:any,r:any)=>{db.prepare('update arrangements set saved=1 where id=?').run(q.params.id);r.json({ok:1})}));
app.get('/api/stats',A((_:any,r:any)=>{const c=(s:string)=>(db.prepare(s).get() as any).c;const rooms=db.prepare('select * from classrooms').all() as Room[];
  r.json({students:c('select count(*) c from students'),classes:c("select count(distinct class_name||section) c from students"),classrooms:rooms.length,capacity:rooms.reduce((a,x)=>a+capacity(x),0),exams:c('select count(*) c from exams'),arrangements:c('select count(*) c from arrangements')})}));
app.get('/api/arrangements/:id/xlsx',async(q,r)=>{const a:any=db.prepare('select a.*,e.name en,e.date ed,e.subject from arrangements a join exams e on e.id=a.exam_id where a.id=?').get(q.params.id);
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('Seating');ws.addRow(['Examination','Date','Room','Row','Bench','Seat','Name','Roll No','Class/Section']).font={bold:true};
  for(const s of JSON.parse(a.data))if(s.stu)ws.addRow([a.en,a.ed,s.room,s.row,s.bench,s.slot,s.stu.name,s.stu.roll_no,s.stu.cls]);
  ws.columns.forEach(c=>c.width=16);r.setHeader('Content-Disposition',`attachment; filename=seating-${a.exam_id}-v${a.version}.xlsx`);await wb.xlsx.write(r);r.end()});
app.listen(3001,()=>console.log('API on :3001'));

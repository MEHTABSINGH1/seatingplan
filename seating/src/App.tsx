import {useEffect,useState,useMemo} from 'react';
const api=async(p:string,m='GET',b?:any)=>{const r=await fetch('/api'+p,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});const j=await r.json();if(!r.ok)throw new Error(j.error);return j};
const PAL=['bg-red-100 border-red-300','bg-blue-100 border-blue-300','bg-green-100 border-green-300','bg-yellow-100 border-yellow-300','bg-purple-100 border-purple-300','bg-pink-100 border-pink-300','bg-orange-100 border-orange-300','bg-teal-100 border-teal-300'];
const col=(c:string)=>PAL[[...c].reduce((a,x)=>a+x.charCodeAt(0),0)%PAL.length];
const In=(p:any)=><input {...p} className={'border rounded px-2 py-1 '+(p.className||'')}/>;
const Btn=(p:any)=><button {...p} className={'px-3 py-1.5 rounded text-white '+(p.className||'bg-indigo-600 hover:bg-indigo-700')}/>;
const TABS=['Dashboard','Students','Classrooms','Exams','Generator','History'];
export default function App(){
  const [tab,setTab]=useState('Dashboard'),[students,setS]=useState<any[]>([]),[rooms,setR]=useState<any[]>([]),[exams,setE]=useState<any[]>([]),[stats,setSt]=useState<any>({}),[toast,setT]=useState(''),[menu,setM]=useState(false);
  const note=(m:string)=>{setT(m);setTimeout(()=>setT(''),4000)};
  const load=async()=>{setS(await api('/students'));setR(await api('/classrooms'));setE(await api('/exams'));setSt(await api('/stats'))};
  useEffect(()=>{load()},[]);
  const wrap=(f:()=>Promise<any>)=>async()=>{try{await f();await load()}catch(e:any){note('⚠ '+e.message)}};
  const classes=useMemo(()=>[...new Set(students.map(s=>s.class_name+'-'+s.section))],[students]);
  return <div className="flex min-h-screen">
    <aside className={`bg-slate-900 text-white w-52 p-4 space-y-1 ${menu?'':'hidden'} md:block fixed md:static h-full z-10`}>
      <h1 className="font-bold mb-4">🪑 Exam Seating</h1>
      {TABS.map(t=><button key={t} onClick={()=>{setTab(t);setM(false)}} className={`block w-full text-left px-3 py-2 rounded ${tab===t?'bg-indigo-600':'hover:bg-slate-700'}`}>{t}</button>)}</aside>
    <main className="flex-1 p-4 md:p-6 overflow-x-auto">
      <button className="md:hidden mb-2 noprint" onClick={()=>setM(!menu)}>☰ Menu</button>
      {toast&&<div className="fixed top-4 right-4 bg-slate-800 text-white px-4 py-2 rounded shadow z-20 max-w-sm">{toast}</div>}
      {tab==='Dashboard'&&<Dash stats={stats} exams={exams}/>}
      {tab==='Students'&&<Students students={students} wrap={wrap} note={note}/>}
      {tab==='Classrooms'&&<Rooms rooms={rooms} wrap={wrap}/>}
      {tab==='Exams'&&<Exams exams={exams} rooms={rooms} classes={classes} wrap={wrap}/>}
      {(tab==='Generator'||tab==='History')&&<Gen exams={exams} rooms={rooms} wrap={wrap} note={note} history={tab==='History'} reload={load}/>}
    </main></div>}
function Dash({stats,exams}:any){const C=[['Students',stats.students],['Classes',stats.classes],['Classrooms',stats.classrooms],['Capacity',stats.capacity],['Exams',stats.exams],['Arrangements',stats.arrangements]];
  return <div><h2 className="text-2xl font-bold mb-4">Dashboard</h2><div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{C.map(([k,v])=><div key={k} className="bg-white rounded-lg shadow p-4"><div className="text-slate-500 text-sm">{k}</div><div className="text-3xl font-bold">{v??'–'}</div></div>)}</div>
  <h3 className="font-semibold mt-6 mb-2">Recent examinations</h3>{exams.slice(0,5).map((e:any)=><div key={e.id} className="bg-white p-3 rounded shadow mb-2">{e.name} · {e.subject} · {e.date} {e.time}</div>)}</div>}
function Students({students,wrap,note}:any){
  const blank={name:'',roll_no:'',class_name:'',section:'',batch:''};const [f,setF]=useState<any>(blank),[q,setQ]=useState(''),[cf,setCf]=useState('');
  const rows=students.filter((s:any)=>(s.name+s.roll_no).toLowerCase().includes(q.toLowerCase())&&(!cf||s.class_name+'-'+s.section===cf||s.batch===cf));
  const upload=async(e:any)=>{const t=await e.target.files[0].text();const [h,...ls]=t.trim().split(/\r?\n/);const hs=h.split(',').map((x:string)=>x.trim().toLowerCase().replace(/ /g,'_'));
    const arr=ls.map((l:string)=>Object.fromEntries(l.split(',').map((v,i)=>[hs[i],v.trim()])));
    try{const r=await api('/students/bulk','POST',{students:arr});note(`Added ${r.added}. Duplicate roll numbers skipped: ${r.duplicates.length?r.duplicates.join(', '):'none'}`);await wrap(async()=>{})()}catch(x:any){note(x.message)}};
  return <div><h2 className="text-2xl font-bold mb-3">Students ({rows.length}/{students.length})</h2>
  <div className="bg-white p-3 rounded shadow mb-3 flex flex-wrap gap-2 items-center">
    {Object.keys(blank).map(k=><In key={k} placeholder={k} value={f[k]} onChange={(e:any)=>setF({...f,[k]:e.target.value})} className="w-32"/>)}
    <Btn onClick={wrap(async()=>{await api(f.id?'/students/'+f.id:'/students',f.id?'PUT':'POST',f);setF(blank)})}>{f.id?'Update':'Add'}</Btn>
    <label className="text-sm">CSV upload <input type="file" accept=".csv" onChange={upload}/></label><span className="text-xs text-slate-500">columns: name,roll_no,class_name,section,batch</span></div>
  <div className="flex gap-2 mb-2"><In placeholder="Search name / roll" value={q} onChange={(e:any)=>setQ(e.target.value)}/><In placeholder="Filter class-section or batch" value={cf} onChange={(e:any)=>setCf(e.target.value)}/></div>
  <table className="w-full bg-white text-sm shadow"><thead className="bg-slate-100"><tr>{['Name','Roll','Class','Sec','Batch',''].map(h=><th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>
  {rows.slice(0,300).map((s:any)=><tr key={s.id} className="border-t"><td className="p-2">{s.name}</td><td>{s.roll_no}</td><td>{s.class_name}</td><td>{s.section}</td><td>{s.batch}</td>
    <td><button className="text-indigo-600 mr-2" onClick={()=>setF(s)}>Edit</button><button className="text-red-600" onClick={()=>confirm('Delete '+s.name+'?')&&wrap(()=>api('/students/'+s.id,'DELETE'))()}>Delete</button></td></tr>)}</tbody></table>
  {rows.length>300&&<p className="text-sm text-slate-500">Showing first 300; refine search.</p>}</div>}
function Rooms({rooms,wrap}:any){const [f,setF]=useState<any>({name:'',rows:5,benches:4,per_bench:2});
  return <div><h2 className="text-2xl font-bold mb-3">Classrooms</h2><div className="bg-white p-3 rounded shadow mb-3 flex flex-wrap gap-2 items-center">
    <In placeholder="Room name" value={f.name} onChange={(e:any)=>setF({...f,name:e.target.value})}/>
    {[['rows','Rows'],['benches','Benches/row'],['per_bench','Students/bench']].map(([k,l])=><label key={k} className="text-sm">{l} <In type="number" min="1" className="w-16" value={f[k]} onChange={(e:any)=>setF({...f,[k]:+e.target.value})}/></label>)}
    <b>Capacity: {f.rows*f.benches*f.per_bench}</b><Btn onClick={wrap(()=>api('/classrooms','POST',f))}>Save room</Btn></div>
  <div className="grid md:grid-cols-3 gap-3">{rooms.map((r:any)=><div key={r.id} className="bg-white p-4 rounded shadow"><b>{r.name}</b><div className="text-sm">{r.rows}×{r.benches}×{r.per_bench} = {r.rows*r.benches*r.per_bench} seats</div>
    <button className="text-red-600 text-sm" onClick={()=>confirm('Delete room?')&&wrap(()=>api('/classrooms/'+r.id,'DELETE'))()}>Delete</button></div>)}</div></div>}
function Exams({exams,rooms,classes,wrap}:any){const [f,setF]=useState<any>({name:'',subject:'',date:'',time:'',classes:[],rooms:[]});
  const tog=(k:string,v:any)=>setF({...f,[k]:f[k].includes(v)?f[k].filter((x:any)=>x!==v):[...f[k],v]});
  return <div><h2 className="text-2xl font-bold mb-3">Examinations</h2><div className="bg-white p-3 rounded shadow mb-3 space-y-2">
    <div className="flex flex-wrap gap-2">{['name','subject'].map(k=><In key={k} placeholder={k} value={f[k]} onChange={(e:any)=>setF({...f,[k]:e.target.value})}/>)}<In type="date" value={f.date} onChange={(e:any)=>setF({...f,date:e.target.value})}/><In type="time" value={f.time} onChange={(e:any)=>setF({...f,time:e.target.value})}/></div>
    <div><b className="text-sm">Classes: </b>{classes.map((c:string)=><label key={c} className="mr-3 text-sm"><input type="checkbox" checked={f.classes.includes(c)} onChange={()=>tog('classes',c)}/> {c}</label>)}</div>
    <div><b className="text-sm">Rooms: </b>{rooms.map((r:any)=><label key={r.id} className="mr-3 text-sm"><input type="checkbox" checked={f.rooms.includes(r.id)} onChange={()=>tog('rooms',r.id)}/> {r.name}</label>)}</div>
    <Btn onClick={wrap(()=>api('/exams','POST',f))}>Create exam</Btn></div>
  {exams.map((e:any)=><div key={e.id} className="bg-white p-3 rounded shadow mb-2 flex justify-between"><span>{e.name} · {e.subject} · {e.date} · {e.classes.join(', ')}</span><button className="text-red-600" onClick={()=>confirm('Delete exam and its arrangements?')&&wrap(()=>api('/exams/'+e.id,'DELETE'))()}>Delete</button></div>)}</div>}
function Gen({exams,wrap,note,history,reload}:any){
  const [eid,setEid]=useState(0),[arrs,setA]=useState<any[]>([]),[cur,setCur]=useState<any>(null),[q,setQ]=useState(''),[view,setView]=useState('room'),[busy,setBusy]=useState(false);
  const loadA=async(id:number)=>{const a=await api(`/exams/${id}/arrangements`);setA(a);setCur((c:any)=>a.find((x:any)=>x.id===c?.id)||a[0]||null)};
  useEffect(()=>{if(eid)loadA(eid)},[eid]);
  const gen=async()=>{setBusy(true);try{const r=await api(`/exams/${eid}/generate`,'POST');await loadA(eid);setCur(null);note('Arrangement '+r.version+' generated');await reload()}catch(e:any){note('⚠ '+e.message)}setBusy(false)};
  useEffect(()=>{if(arrs.length&&!cur)setCur(arrs[0])},[arrs]);
  const seats:any[]=(cur?.data||[]).filter((s:any)=>s.stu),hit=q&&seats.find(s=>(s.stu.name+s.stu.roll_no).toLowerCase().includes(q.toLowerCase()));
  const roomNames=[...new Set(seats.map(s=>s.room))] as string[];
  const legend=[...new Set(seats.map(s=>s.stu.cls))] as string[];
  return <div><h2 className="text-2xl font-bold mb-3 noprint">{history?'Arrangement History':'Seating Generator'}</h2>
  <div className="flex flex-wrap gap-2 mb-3 noprint"><select className="border rounded px-2" value={eid} onChange={e=>setEid(+e.target.value)}><option value={0}>Select exam…</option>{exams.map((e:any)=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
    {!history&&<Btn disabled={!eid||busy} className="bg-green-600 hover:bg-green-700 font-bold" onClick={gen}>{busy?'Generating…':arrs.length?'GENERATE NEW SEATING ARRANGEMENT':'GENERATE SEATING ARRANGEMENT'}</Btn>}
    {cur&&<><Btn className="bg-indigo-600" onClick={wrap(()=>api(`/arrangements/${cur.id}/save`,'POST').then(()=>loadA(eid)))}>Save final</Btn><a className="px-3 py-1.5 rounded bg-emerald-600 text-white" href={`/api/arrangements/${cur.id}/xlsx`}>Excel</a><Btn className="bg-slate-600" onClick={()=>window.print()}>Print / PDF</Btn></>}</div>
  <div className="flex gap-2 mb-3 noprint flex-wrap">{arrs.map(a=><button key={a.id} onClick={()=>setCur(a)} className={`px-2 py-1 rounded border text-sm ${cur?.id===a.id?'bg-indigo-600 text-white':'bg-white'}`}>Arrangement {a.version}{a.saved?' ✓':''}</button>)}</div>
  {cur&&<>{cur.notes.map((n:string)=><div key={n} className="bg-amber-100 border border-amber-300 p-2 rounded mb-2 text-sm">⚠ {n}</div>)}
  <div className="flex gap-2 mb-3 noprint flex-wrap"><In placeholder="Find student's seat" value={q} onChange={(e:any)=>setQ(e.target.value)}/>{['room','row','list'].map(v=><button key={v} onClick={()=>setView(v)} className={`px-2 border rounded ${view===v?'bg-slate-800 text-white':'bg-white'}`}>{v==='room'?'Classroom view':v==='row'?'Row view':'Bench list'}</button>)}
    {q&&<span className="text-sm self-center">{hit?`${hit.stu.name}: ${hit.room}, Row ${hit.row}, Bench ${hit.bench}`:'Not found'}</span>}</div>
  <div className="flex gap-2 flex-wrap mb-3 text-xs">{legend.map(c=><span key={c} className={`border px-2 rounded ${col(c)}`}>{c}</span>)}</div>
  {view==='list'?<table className="w-full bg-white text-sm"><tbody>{seats.map((s,i)=><tr key={i} className="border-t"><td className="p-1">{s.room}</td><td>R{s.row}</td><td>B{s.bench}</td><td>{s.stu.name}</td><td>{s.stu.roll_no}</td><td>{s.stu.cls}</td></tr>)}</tbody></table>
  :roomNames.map(rn=>{const rs=seats.filter(s=>s.room===rn),R=Math.max(...rs.map(s=>s.row)),B=Math.max(...rs.map(s=>s.bench));
    return <div key={rn} className="mb-6 bg-white p-3 rounded shadow break-after-page"><h3 className="font-bold">{rn} — {cur&&exams.find((e:any)=>e.id===eid)?.name}</h3><div className="bg-slate-800 text-white text-center text-sm rounded my-2">WHITEBOARD</div>
    <div className="overflow-x-auto"><table className="text-xs border-separate border-spacing-1 w-full"><tbody>
    {Array.from({length:R},(_,i)=>i+1).map(row=><tr key={row}><td className="font-bold pr-1">Row {row}</td>
      {view==='row'&&<td><div className="flex flex-wrap gap-1">{rs.filter(s=>s.row===row).map((s,i)=><Seat key={i} s={s} hit={hit}/>)}</div></td>}
      {view==='room'&&Array.from({length:B},(_,i)=>i+1).map(b=><td key={b} className="border rounded p-1 align-top"><div className="text-[10px] text-slate-400">Bench {b}</div>{rs.filter(s=>s.row===row&&s.bench===b).map((s,i)=><Seat key={i} s={s} hit={hit}/>)}</td>)}</tr>)}
    </tbody></table></div></div>})}</>}</div>}
const Seat=({s,hit}:any)=><div className={`border rounded px-1 mb-0.5 ${col(s.stu.cls)} ${hit===s?'ring-2 ring-black':''}`}><div className="font-semibold">{s.stu.name}</div><div>{s.stu.roll_no} · {s.stu.cls}</div></div>;

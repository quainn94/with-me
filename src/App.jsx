import { useEffect, useMemo, useState } from 'react'
import './App.css'

const KEY='with-me-v02'
const seed={
 todos:[
  {id:'1',title:'이유식 용기 정리',group:'today',done:false,important:true},
  {id:'2',title:'세탁기 돌리기',group:'today',done:false,important:false},
  {id:'3',title:'병원 서류 정리',group:'next',done:false,important:false}
 ],
 templates:['물포트 세척','아기 식판 소독'],
 meals:Object.fromEntries(['월','화','수','목','금','토','일'].map(d=>[d,{아침:'',점심:'',간식:'',저녁:''}])),
 favorites:['순두부 계란찜','소고기 덮밥'],
 stock:[
  {id:'s1',name:'계란',category:'음식',quantity:4,unit:'개',threshold:6,expiry:'',alertDays:3,autoNeed:true},
  {id:'s2',name:'물티슈',category:'육아',quantity:1,unit:'팩',threshold:2,expiry:'',alertDays:7,autoNeed:true}
 ],
 needs:[{id:'n1',name:'아기 치약',purchased:false}]
}
seed.meals.월={아침:'순두부 계란찜',점심:'닭안심 야채볶음',간식:'바나나',저녁:'소고기 덮밥'}
const uid=()=>crypto.randomUUID()
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||seed}catch{return seed}}
const blankStock=()=>({name:'',category:'음식',quantity:1,unit:'개',threshold:0,expiry:'',alertDays:3,autoNeed:false})

export default function App(){
 const [data,setData]=useState(load)
 const [tab,setTab]=useState('home')
 const [todoView,setTodoView]=useState('today')
 const [mealView,setMealView]=useState('week')
 const [needView,setNeedView]=useState('need')
 const [hideDone,setHideDone]=useState(false)
 const [draft,setDraft]=useState('')
 const [templateDraft,setTemplateDraft]=useState('')
 const [favoriteDraft,setFavoriteDraft]=useState('')
 const [needDraft,setNeedDraft]=useState('')
 const [stockForm,setStockForm]=useState(blankStock)
 const [editing,setEditing]=useState(null)
 useEffect(()=>localStorage.setItem(KEY,JSON.stringify(data)),[data])
 const patch=x=>setData(p=>({...p,...x}))
 const low=useMemo(()=>data.stock.filter(x=>+x.quantity<=+x.threshold),[data.stock])
 const expiring=useMemo(()=>data.stock.filter(isExpiring),[data.stock])
 useEffect(()=>{
  setData(prev=>{
   const existing=new Set(prev.needs.filter(x=>!x.purchased).map(x=>x.name))
   const add=prev.stock.filter(x=>x.autoNeed&&+x.quantity<=+x.threshold&&!existing.has(x.name))
   return add.length?{...prev,needs:[...prev.needs,...add.map(x=>({id:uid(),name:x.name,purchased:false}))]}:prev
  })
 },[data.stock])

 const addTodo=()=>{if(!draft.trim())return;patch({todos:[...data.todos,{id:uid(),title:draft.trim(),group:todoView==='next'?'next':'today',done:false,important:false}]});setDraft('')}
 const move=(id,dir)=>{const list=data.todos.filter(x=>x.group===todoView),i=list.findIndex(x=>x.id===id),j=i+(dir==='up'?-1:1);if(j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];patch({todos:[...data.todos.filter(x=>x.group!==todoView),...list]})}
 const saveStock=()=>{if(!stockForm.name.trim())return;const item={...stockForm,name:stockForm.name.trim(),quantity:+stockForm.quantity,threshold:+stockForm.threshold,alertDays:+stockForm.alertDays};patch({stock:editing?data.stock.map(x=>x.id===editing?{...item,id:editing}:x):[...data.stock,{...item,id:uid()}]});setEditing(null);setStockForm(blankStock())}
 const purchase=(item,reflect)=>{let stock=data.stock;if(reflect){const found=stock.find(x=>x.name===item.name);stock=found?stock.map(x=>x.id===found.id?{...x,quantity:+x.quantity+1}:x):[...stock,{id:uid(),name:item.name,category:'생활',quantity:1,unit:'개',threshold:0,expiry:'',alertDays:3,autoNeed:false}]}setData(p=>({...p,stock,needs:p.needs.map(x=>x.id===item.id?{...x,purchased:true}:x)}))}

 return <div className="app"><main className="content">
  <header><p className="eyebrow">WITH ME</p><h1>{titles[tab]}</h1><p className="sub">{subs[tab]}</p></header>
  {tab==='home'&&<div className="stack">
   <Card title="Todo" kicker="TODAY" onClick={()=>setTab('todo')}>{data.todos.filter(x=>x.group==='today'&&!x.done).slice(0,4).map(x=><div className="row" key={x.id}><span className="dot"/>{x.title}{x.important&&<b>중요</b>}</div>)}</Card>
   <Card title="Meals" kicker="TODAY" onClick={()=>setTab('meals')}><div className="mealGrid">{['아침','점심','간식','저녁'].map(k=><Mini key={k} label={k} value={data.meals.월[k]}/>)}</div></Card>
   {(low.length||expiring.length)>0&&<Card title="Stock" kicker="ALERT" onClick={()=>setTab('stock')}><div className="chips">{low.map(x=><span className="chip alert" key={x.id}>{x.name} 부족</span>)}{expiring.map(x=><span className="chip expiry" key={'e'+x.id}>{x.name} 기한 임박</span>)}</div></Card>}
   {data.needs.some(x=>!x.purchased)&&<Card title="Need" kicker="TO BUY" onClick={()=>setTab('need')}><div className="chips">{data.needs.filter(x=>!x.purchased).map(x=><span className="chip" key={x.id}>{x.name}</span>)}</div></Card>}
  </div>}

  {tab==='todo'&&<section className="panel">
   <div className="seg">{['today','next','library'].map(v=><button className={todoView===v?'active':''} onClick={()=>setTodoView(v)} key={v}>{v==='today'?'Today':v==='next'?'Next':'Library'}</button>)}</div>
   {todoView!=='library'?<>
    <label className="hide"><input type="checkbox" checked={hideDone} onChange={e=>setHideDone(e.target.checked)}/> 완료 숨기기</label>
    <Add value={draft} setValue={setDraft} onAdd={addTodo} placeholder="할 일 추가"/>
    {data.todos.filter(x=>x.group===todoView).filter(x=>!(hideDone&&x.done)).map((x,i,list)=><div className={'task '+(x.done?'done':'')} key={x.id}>
     <input type="checkbox" checked={x.done} onChange={()=>patch({todos:data.todos.map(t=>t.id===x.id?{...t,done:!t.done}:t)})}/>
     <button className={'star '+(x.important?'on':'')} onClick={()=>patch({todos:data.todos.map(t=>t.id===x.id?{...t,important:!t.important}:t)})}>★</button>
     <span>{x.title}</span><button disabled={i===0} onClick={()=>move(x.id,'up')}>↑</button><button disabled={i===list.length-1} onClick={()=>move(x.id,'down')}>↓</button>
     <button onClick={()=>patch({todos:data.todos.map(t=>t.id===x.id?{...t,group:t.group==='today'?'next':'today'}:t)})}>{x.group==='today'?'다음':'오늘'}</button>
     <button className="delete" onClick={()=>patch({todos:data.todos.filter(t=>t.id!==x.id)})}>삭제</button>
    </div>)}
   </>:<>
    <Add value={templateDraft} setValue={setTemplateDraft} onAdd={()=>{if(!templateDraft.trim())return;patch({templates:[...data.templates,templateDraft.trim()]});setTemplateDraft('')}} placeholder="반복 템플릿 추가"/>
    {data.templates.map(t=><div className="template" key={t}><span>{t}</span><button onClick={()=>patch({todos:[...data.todos,{id:uid(),title:t,group:'today',done:false,important:false}]})}>오늘에 추가</button><button className="delete" onClick={()=>patch({templates:data.templates.filter(x=>x!==t)})}>삭제</button></div>)}
   </>}
  </section>}

  {tab==='meals'&&<>
   <div className="panel compact"><div className="seg two"><button className={mealView==='week'?'active':''} onClick={()=>setMealView('week')}>Week</button><button className={mealView==='favorites'?'active':''} onClick={()=>setMealView('favorites')}>Favorites</button></div></div>
   {mealView==='week'?<div className="week">{Object.keys(data.meals).map(day=><article className="dayCard" key={day}><div className="day">{day}</div><div className="dayBody">{['아침','점심','간식','저녁'].map(k=><label className="mealField" key={k}><span>{k}</span><textarea value={data.meals[day][k]} onChange={e=>patch({meals:{...data.meals,[day]:{...data.meals[day],[k]:e.target.value}}})}/><select value="" onChange={e=>e.target.value&&patch({meals:{...data.meals,[day]:{...data.meals[day],[k]:e.target.value}}})}><option value="">Favorites에서 선택</option>{data.favorites.map(f=><option key={f}>{f}</option>)}</select></label>)}</div></article>)}</div>:<section className="panel"><Add value={favoriteDraft} setValue={setFavoriteDraft} onAdd={()=>{if(!favoriteDraft.trim())return;patch({favorites:[...data.favorites,favoriteDraft.trim()]});setFavoriteDraft('')}} placeholder="자주 먹는 메뉴 추가"/>{data.favorites.map(f=><div className="template" key={f}><span>{f}</span><button className="delete" onClick={()=>patch({favorites:data.favorites.filter(x=>x!==f)})}>삭제</button></div>)}</section>}
  </>}

  {tab==='stock'&&<>
   <section className="panel"><h2>{editing?'재고 수정':'재고 추가'}</h2><div className="formGrid">
    <Field label="품목명"><input value={stockForm.name} onChange={e=>setStockForm({...stockForm,name:e.target.value})}/></Field>
    <Field label="카테고리"><select value={stockForm.category} onChange={e=>setStockForm({...stockForm,category:e.target.value})}>{['음식','육아','생활','화장품','반려동물'].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="현재 수량"><input type="number" value={stockForm.quantity} onChange={e=>setStockForm({...stockForm,quantity:e.target.value})}/></Field>
    <Field label="단위"><input value={stockForm.unit} onChange={e=>setStockForm({...stockForm,unit:e.target.value})}/></Field>
    <Field label="부족 기준"><input type="number" value={stockForm.threshold} onChange={e=>setStockForm({...stockForm,threshold:e.target.value})}/></Field>
    <Field label="유통기한"><input type="date" value={stockForm.expiry} onChange={e=>setStockForm({...stockForm,expiry:e.target.value})}/></Field>
    <Field label="며칠 전 알림"><input type="number" value={stockForm.alertDays} onChange={e=>setStockForm({...stockForm,alertDays:e.target.value})}/></Field>
    <label className="check"><input type="checkbox" checked={stockForm.autoNeed} onChange={e=>setStockForm({...stockForm,autoNeed:e.target.checked})}/> 부족 시 Need 자동 추가</label>
   </div><div className="actions">{editing&&<button className="secondary" onClick={()=>{setEditing(null);setStockForm(blankStock())}}>취소</button>}<button onClick={saveStock}>{editing?'수정 저장':'재고 추가'}</button></div></section>
   <div className="stockList">{data.stock.map(x=><article className={'stockCard '+((+x.quantity<=+x.threshold)||isExpiring(x)?'warning':'')} key={x.id}><div className="stockTop"><div><h3>{x.name}</h3><p>{x.category}</p></div><div>{+x.quantity<=+x.threshold&&<b className="badge">부족</b>}{isExpiring(x)&&<b className="badge purple">기한 임박</b>}</div></div><p>{x.quantity}{x.unit} · 부족 기준 {x.threshold}{x.unit}</p><p>{x.expiry?`유통기한 ${x.expiry}`:'유통기한 미설정'}</p><div className="actions"><button onClick={()=>{setEditing(x.id);setStockForm({...x});window.scrollTo(0,0)}}>수정</button><button className="delete" onClick={()=>patch({stock:data.stock.filter(s=>s.id!==x.id)})}>삭제</button></div></article>)}</div>
  </>}

  {tab==='need'&&<section className="panel"><div className="seg two"><button className={needView==='need'?'active':''} onClick={()=>setNeedView('need')}>Need</button><button className={needView==='purchased'?'active':''} onClick={()=>setNeedView('purchased')}>Purchased</button></div>{needView==='need'&&<Add value={needDraft} setValue={setNeedDraft} onAdd={()=>{if(!needDraft.trim())return;patch({needs:[...data.needs,{id:uid(),name:needDraft.trim(),purchased:false}]});setNeedDraft('')}} placeholder="구매할 품목 추가"/>}{data.needs.filter(x=>x.purchased===(needView==='purchased')).map(x=><div className="need" key={x.id}><strong>{x.name}</strong><div>{needView==='need'?<><button onClick={()=>purchase(x,false)}>구매 완료</button><button className="secondary" onClick={()=>purchase(x,true)}>완료 + 재고 반영</button></>:<button onClick={()=>patch({needs:data.needs.map(n=>n.id===x.id?{...n,purchased:false}:n)})}>Need로 되돌리기</button>}<button className="delete" onClick={()=>patch({needs:data.needs.filter(n=>n.id!==x.id)})}>삭제</button></div></div>)}</section>}
 </main><nav className="nav">{[['home','⌂','Home'],['meals','◫','Meals'],['stock','▣','Stock'],['need','✓','Need']].map(([k,i,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}><span>{i}</span>{l}</button>)}</nav></div>
}

function isExpiring(x){if(!x.expiry)return false;const a=new Date();a.setHours(0,0,0,0);return Math.ceil((new Date(x.expiry+'T00:00:00')-a)/86400000)<=+x.alertDays}
function Card({title,kicker,children,onClick}){return <article className="card" onClick={onClick}><div className="cardHead"><div><p className="kicker">{kicker}</p><h2>{title}</h2></div><span>›</span></div>{children}</article>}
function Mini({label,value}){return <div className="mini"><span>{label}</span><b>{value||'—'}</b></div>}
function Add({value,setValue,onAdd,placeholder}){return <div className="add"><input value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onAdd()} placeholder={placeholder}/><button onClick={onAdd}>추가</button></div>}
function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>}
const titles={home:'오늘도 가볍게.',todo:'Todo',meals:'Meals',stock:'Stock',need:'Need'}
const subs={home:'해야 할 일과 집안 흐름을 한곳에서 정리해요.',todo:'오늘과 다음을 가볍게 정리해요.',meals:'이번 주 식단을 한눈에.',stock:'부족 기준과 유통기한을 함께 관리해요.',need:'사야 할 것과 구매 완료를 나눠봐요.'}

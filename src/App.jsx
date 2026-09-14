import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

const VERSION = '0.1.0'
const LOCAL_KEY = 'with-me-life-v0.1'
const today = () => new Date().toISOString().slice(0, 10)
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
const money = (n = 0) => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`
const number = (n = 0, digits = 0) => Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: digits })
const round1 = (n = 0) => Math.round((Number(n) || 0) * 10) / 10

const defaultState = {
  ingredients: [],
  purchases: [],
  usages: [],
  recipes: [],
  weights: [],
}

const normalizeState = (raw) => ({
  ingredients: Array.isArray(raw?.ingredients) ? raw.ingredients : defaultState.ingredients,
  purchases: Array.isArray(raw?.purchases) ? raw.purchases : defaultState.purchases,
  usages: Array.isArray(raw?.usages) ? raw.usages : defaultState.usages,
  recipes: Array.isArray(raw?.recipes) ? raw.recipes : [],
  weights: Array.isArray(raw?.weights) ? raw.weights : [],
})

function loadLocal() {
  try {
    const saved = localStorage.getItem(LOCAL_KEY)
    return saved ? normalizeState(JSON.parse(saved)) : defaultState
  } catch {
    return defaultState
  }
}

function latestPurchaseFor(ingredientId, purchases) {
  return [...purchases]
    .filter((p) => p.ingredientId === ingredientId && Number(p.quantity) > 0)
    .sort((a, b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`))[0]
}

function unitPrice(ingredientId, purchases) {
  const p = latestPurchaseFor(ingredientId, purchases)
  return p ? Number(p.price) / Number(p.quantity) : 0
}

function usageDailyAverage(ingredientId, usages) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffKey = cutoff.toISOString().slice(0, 10)
  const rows = usages.filter((u) => u.ingredientId === ingredientId && (!u.date || u.date >= cutoffKey))
  if (!rows.length) return 0
  const qty = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
  const days = rows.reduce((sum, row) => sum + Math.max(1, Number(row.daysUsed || 1)), 0)
  return days ? qty / days : 0
}

function recipeTotals(recipe, ingredients, purchases) {
  return (recipe.items || []).reduce((acc, item) => {
    const ingredient = ingredients.find((i) => i.id === item.ingredientId)
    if (!ingredient) return acc
    const qty = Number(item.quantity || 0)
    const price = unitPrice(item.ingredientId, purchases) * qty
    const kcal = Number(ingredient.kcalBaseQty) > 0
      ? (qty / Number(ingredient.kcalBaseQty)) * Number(ingredient.kcalBaseValue || 0)
      : 0
    acc.cost += price
    acc.kcal += kcal
    return acc
  }, { cost: 0, kcal: 0 })
}

function Icon({ name }) {
  const map = {
    home: '⌂', ingredient: '◫', purchase: '₩', recipe: '☷', weight: '↗', plus: '+', delete: '×', edit: '✎', check: '✓', logout: '↪'
  }
  return <span aria-hidden="true">{map[name] || '•'}</span>
}

export default function App() {
  const [data, setData] = useState(loadLocal)
  const [tab, setTab] = useState('home')
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [login, setLogin] = useState({ email: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [syncState, setSyncState] = useState('로컬 저장')
  const [cloudEnabled, setCloudEnabled] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: auth }) => {
      if (!mounted) return
      setSession(auth.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
      if (!nextSession) setCloudEnabled(false)
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false
    const loadCloud = async () => {
      setSyncState('불러오는 중')
      const userId = session.user.id
      const [ingredients, purchases, usages, recipes, recipeItems, weights] = await Promise.all([
        supabase.from('life_ingredients').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('life_purchases').select('*').eq('user_id', userId).order('purchased_at', { ascending: false }),
        supabase.from('life_usages').select('*').eq('user_id', userId).order('used_at', { ascending: false }),
        supabase.from('life_recipes').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('life_recipe_items').select('*').eq('user_id', userId),
        supabase.from('life_weights').select('*').eq('user_id', userId).order('measured_at'),
      ])
      if (cancelled) return
      const anyError = [ingredients, purchases, usages, recipes, recipeItems, weights].find((r) => r.error)
      if (anyError) {
        console.warn('v0.1 tables not ready:', anyError.error)
        setCloudEnabled(false)
        setSyncState('로컬 모드')
        return
      }
      const cloud = {
        ingredients: ingredients.data.map((x) => ({ id: x.id, name: x.name, unit: x.unit, kcalBaseQty: x.kcal_base_qty, kcalBaseValue: x.kcal_base_value, category: x.category || '' })),
        purchases: purchases.data.map((x) => ({ id: x.id, ingredientId: x.ingredient_id, date: x.purchased_at, store: x.store || '', quantity: x.quantity, unit: x.unit, price: x.price, createdAt: x.created_at })),
        usages: usages.data.map((x) => ({ id: x.id, ingredientId: x.ingredient_id, date: x.used_at, quantity: x.quantity, unit: x.unit, daysUsed: x.days_used })),
        recipes: recipes.data.map((r) => ({
          id: r.id, name: r.name, servings: r.servings || 1,
          items: recipeItems.data.filter((i) => i.recipe_id === r.id).map((i) => ({ id: i.id, ingredientId: i.ingredient_id, quantity: i.quantity, unit: i.unit }))
        })),
        weights: weights.data.map((x) => ({ id: x.id, date: x.measured_at, value: x.weight_kg, note: x.note || '' })),
      }
      const hasCloud = Object.values(cloud).some((arr) => arr.length > 0)
      if (hasCloud) setData(cloud)
      setCloudEnabled(true)
      setSyncState('클라우드 연결')
    }
    loadCloud()
    return () => { cancelled = true }
  }, [session?.user?.id])

  const flash = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 1800)
  }

  const persist = async (kind, row, action = 'insert') => {
    if (!cloudEnabled || !session?.user?.id) return
    const user_id = session.user.id
    const tableMap = {
      ingredient: 'life_ingredients', purchase: 'life_purchases', usage: 'life_usages', recipe: 'life_recipes', recipeItem: 'life_recipe_items', weight: 'life_weights'
    }
    const table = tableMap[kind]
    if (!table) return
    setSyncState('저장 중')
    let q
    if (action === 'delete') q = supabase.from(table).delete().eq('id', row.id).eq('user_id', user_id)
    else q = supabase.from(table).upsert({ ...row, user_id }, { onConflict: 'id' })
    const { error } = await q
    setSyncState(error ? '로컬 저장됨' : '저장됨')
    if (error) console.warn('cloud save failed', error)
  }

  const monthlyEstimate = useMemo(() => data.ingredients.reduce((sum, ing) => {
    const daily = usageDailyAverage(ing.id, data.usages)
    return sum + daily * 30 * unitPrice(ing.id, data.purchases)
  }, 0), [data])

  const thisMonthSpend = useMemo(() => {
    const key = today().slice(0, 7)
    return data.purchases.filter((p) => p.date?.startsWith(key)).reduce((s, p) => s + Number(p.price || 0), 0)
  }, [data.purchases])

  const latestWeight = useMemo(() => [...data.weights].sort((a,b) => b.date.localeCompare(a.date))[0], [data.weights])
  const firstWeight = useMemo(() => [...data.weights].sort((a,b) => a.date.localeCompare(b.date))[0], [data.weights])

  if (!authReady) return <div className="centerPage"><div className="loader" /></div>

  if (!session) {
    const submitLogin = async (e) => {
      e.preventDefault(); setLoginError('')
      const { error } = await supabase.auth.signInWithPassword(login)
      if (error) setLoginError('로그인 정보를 확인해 주세요.')
    }
    return <div className="loginPage">
      <div className="loginCard">
        <div className="brandMark">W</div>
        <p className="eyebrow">WITH ME · LIFE</p>
        <h1>내 생활을<br/>가볍게 기록해요.</h1>
        <p className="muted">식재료 · 구매 · 레시피 원가 · 체중을 한곳에서.</p>
        <form onSubmit={submitLogin} className="loginForm">
          <input type="email" placeholder="이메일" value={login.email} onChange={(e)=>setLogin({...login,email:e.target.value})} required />
          <input type="password" placeholder="비밀번호" value={login.password} onChange={(e)=>setLogin({...login,password:e.target.value})} required />
          {loginError && <p className="errorText">{loginError}</p>}
          <button className="primaryButton" type="submit">로그인</button>
        </form>
        <small>v{VERSION}</small>
      </div>
    </div>
  }

  return <div className="appShell">
    {toast && <div className="toast">{toast}</div>}
    <main className="content">
      <header className="topbar">
        <div>
          <p className="eyebrow">WITH ME · v{VERSION}</p>
          <h1>{tab === 'home' ? '오늘도 가볍게.' : navItems.find((n)=>n.id===tab)?.label}</h1>
        </div>
        <div className="topActions">
          <span className="syncPill">{syncState}</span>
          <button className="iconButton" onClick={()=>supabase.auth.signOut()} aria-label="로그아웃"><Icon name="logout" /></button>
        </div>
      </header>

      {tab === 'home' && <Home data={data} monthlyEstimate={monthlyEstimate} thisMonthSpend={thisMonthSpend} latestWeight={latestWeight} firstWeight={firstWeight} go={setTab} />}
      {tab === 'ingredients' && <Ingredients data={data} setData={setData} persist={persist} flash={flash} />}
      {tab === 'purchases' && <Purchases data={data} setData={setData} persist={persist} flash={flash} />}
      {tab === 'recipes' && <Recipes data={data} setData={setData} persist={persist} flash={flash} />}
      {tab === 'weight' && <Weight data={data} setData={setData} persist={persist} flash={flash} />}
    </main>

    <nav className="bottomNav">
      {navItems.map((item) => <button key={item.id} className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}>
        <Icon name={item.icon}/><span>{item.label}</span>
      </button>)}
    </nav>
  </div>
}

const navItems = [
  { id:'home', label:'홈', icon:'home' },
  { id:'ingredients', label:'식재료', icon:'ingredient' },
  { id:'purchases', label:'구매', icon:'purchase' },
  { id:'recipes', label:'레시피', icon:'recipe' },
  { id:'weight', label:'체중', icon:'weight' },
]

function Home({ data, monthlyEstimate, thisMonthSpend, latestWeight, firstWeight, go }) {
  const recent = [...data.purchases].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4)
  const monthlyDelta = latestWeight && firstWeight ? round1(latestWeight.value - firstWeight.value) : null
  return <div className="pageStack">
    <section className="heroGrid">
      <article className="heroCard yellow">
        <p>내 식비 예상</p><strong>{money(monthlyEstimate)}</strong><span>현재 사용 패턴을 30일로 환산</span>
      </article>
      <article className="heroCard rose">
        <p>이번 달 장보기</p><strong>{money(thisMonthSpend)}</strong><span>실제로 결제한 구매 금액</span>
      </article>
      <article className="heroCard cream">
        <p>최근 체중</p><strong>{latestWeight ? `${latestWeight.value} kg` : '기록 없음'}</strong><span>{monthlyDelta === null ? '첫 기록을 남겨보세요' : `첫 기록 대비 ${monthlyDelta > 0 ? '+' : ''}${monthlyDelta}kg`}</span>
      </article>
    </section>

    <section className="panel">
      <div className="sectionHead"><div><p className="kicker">QUICK</p><h2>빠른 기록</h2></div></div>
      <div className="quickGrid">
        <button onClick={()=>go('purchases')}><b>＋</b><span>장본 것 기록</span><small>구매처 · 양 · 금액</small></button>
        <button onClick={()=>go('ingredients')}><b>＋</b><span>사용량 기록</span><small>오늘 사용 / 며칠 소진</small></button>
        <button onClick={()=>go('weight')}><b>＋</b><span>체중 기록</span><small>날짜별 변화 보기</small></button>
      </div>
    </section>

    <section className="panel">
      <div className="sectionHead"><div><p className="kicker">RECENT</p><h2>최근 구매</h2></div><button className="textButton" onClick={()=>go('purchases')}>전체보기</button></div>
      {recent.length ? <div className="simpleList">{recent.map((p)=>{
        const ing=data.ingredients.find((i)=>i.id===p.ingredientId)
        return <div className="simpleRow" key={p.id}><div><strong>{ing?.name||'삭제된 재료'}</strong><span>{p.store || '구매처 미입력'} · {number(p.quantity,1)}{p.unit}</span></div><b>{money(p.price)}</b></div>
      })}</div> : <Empty text="아직 구매 기록이 없어요." />}
    </section>
  </div>
}

function Ingredients({ data, setData, persist, flash }) {
  const [form, setForm] = useState({ name:'', unit:'g', kcalBaseQty:100, kcalBaseValue:'', category:'' })
  const [usage, setUsage] = useState({ ingredientId: data.ingredients[0]?.id || '', quantity:'', daysUsed:1, date:today() })
  useEffect(()=>{ if (!usage.ingredientId && data.ingredients[0]) setUsage((u)=>({...u, ingredientId:data.ingredients[0].id})) }, [data.ingredients, usage.ingredientId])

  const addIngredient = async (e) => {
    e.preventDefault(); if (!form.name.trim()) return
    const row={ id:uid(), ...form, name:form.name.trim(), kcalBaseQty:Number(form.kcalBaseQty)||1, kcalBaseValue:Number(form.kcalBaseValue)||0 }
    setData((d)=>({...d,ingredients:[...d.ingredients,row]}))
    await persist('ingredient',{ id:row.id, name:row.name, unit:row.unit, kcal_base_qty:row.kcalBaseQty, kcal_base_value:row.kcalBaseValue, category:row.category })
    setForm({ name:'', unit:'g', kcalBaseQty:100, kcalBaseValue:'', category:'' }); flash('식재료를 추가했어요')
  }
  const addUsage = async (e) => {
    e.preventDefault(); if (!usage.ingredientId || !Number(usage.quantity)) return
    const ing=data.ingredients.find((i)=>i.id===usage.ingredientId)
    const row={ id:uid(), ...usage, quantity:Number(usage.quantity), daysUsed:Number(usage.daysUsed)||1, unit:ing?.unit||'g' }
    setData((d)=>({...d,usages:[row,...d.usages]}))
    await persist('usage',{ id:row.id, ingredient_id:row.ingredientId, used_at:row.date, quantity:row.quantity, unit:row.unit, days_used:row.daysUsed })
    setUsage((u)=>({...u,quantity:'',daysUsed:1})); flash('사용량을 기록했어요')
  }

  return <div className="pageStack">
    <section className="panel splitPanel">
      <div>
        <p className="kicker">USE</p><h2>사용량 기록</h2><p className="muted">매번 g을 재기 귀찮으면 “300g을 5일 사용”처럼 적어도 돼요.</p>
      </div>
      <form className="formGrid compactForm" onSubmit={addUsage}>
        <label>식재료<select value={usage.ingredientId} onChange={(e)=>setUsage({...usage,ingredientId:e.target.value})}>{data.ingredients.map((i)=><option value={i.id} key={i.id}>{i.name}</option>)}</select></label>
        <label>사용량<input type="number" step="0.1" value={usage.quantity} onChange={(e)=>setUsage({...usage,quantity:e.target.value})} placeholder="예: 300" /></label>
        <label>사용 기간<input type="number" min="1" value={usage.daysUsed} onChange={(e)=>setUsage({...usage,daysUsed:e.target.value})} /></label>
        <label>기록일<input type="date" value={usage.date} onChange={(e)=>setUsage({...usage,date:e.target.value})} /></label>
        <button className="primaryButton" type="submit">사용 기록 추가</button>
      </form>
    </section>

    <section className="panel">
      <div className="sectionHead"><div><p className="kicker">PANTRY</p><h2>식재료</h2></div><span className="countPill">{data.ingredients.length}개</span></div>
      <div className="ingredientGrid">{data.ingredients.map((ing)=>{
        const latest=latestPurchaseFor(ing.id,data.purchases); const per=unitPrice(ing.id,data.purchases); const daily=usageDailyAverage(ing.id,data.usages); const monthly=daily*30*per
        return <article className="ingredientCard" key={ing.id}>
          <div className="ingredientTitle"><div><span>{ing.category || '미분류'}</span><h3>{ing.name}</h3></div><button className="miniDelete" onClick={async()=>{setData((d)=>({...d, ingredients:d.ingredients.filter(x=>x.id!==ing.id), purchases:d.purchases.filter(x=>x.ingredientId!==ing.id), usages:d.usages.filter(x=>x.ingredientId!==ing.id), recipes:d.recipes.map(r=>({...r,items:(r.items||[]).filter(x=>x.ingredientId!==ing.id)}))})); await persist('ingredient',{id:ing.id},'delete')}}>×</button></div>
          <dl><div><dt>최근 단가</dt><dd>{per ? `${money(per)}/${ing.unit}` : '구매 기록 없음'}</dd></div><div><dt>평균 사용</dt><dd>{daily ? `${number(daily,1)}${ing.unit}/일` : '사용 기록 없음'}</dd></div><div><dt>월 예상</dt><dd className="roseText">{monthly ? money(monthly) : '-'}</dd></div><div><dt>열량 기준</dt><dd>{number(ing.kcalBaseQty,1)}{ing.unit} = {number(ing.kcalBaseValue,1)}kcal</dd></div></dl>
          {latest && <p className="cardFoot">최근 {latest.store || '구매'} · {latest.date}</p>}
        </article>
      })}</div>
    </section>

    <section className="panel">
      <div className="sectionHead"><div><p className="kicker">NEW</p><h2>식재료 추가</h2></div></div>
      <form className="formGrid" onSubmit={addIngredient}>
        <label>이름<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="예: 또띠아" /></label>
        <label>기준 단위<select value={form.unit} onChange={(e)=>setForm({...form,unit:e.target.value,kcalBaseQty:['g','ml'].includes(e.target.value)?100:1})}>{['g','ml','개','장','팩'].map((u)=><option key={u}>{u}</option>)}</select></label>
        <label>칼로리 기준량<input type="number" step="0.1" value={form.kcalBaseQty} onChange={(e)=>setForm({...form,kcalBaseQty:e.target.value})} /></label>
        <label>기준 kcal<input type="number" step="0.1" value={form.kcalBaseValue} onChange={(e)=>setForm({...form,kcalBaseValue:e.target.value})} placeholder="예: 100g당 41" /></label>
        <label>분류<input value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} placeholder="채소, 단백질…" /></label>
        <button className="primaryButton" type="submit">식재료 추가</button>
      </form>
    </section>
  </div>
}

function Purchases({ data, setData, persist, flash }) {
  const [form,setForm]=useState({ ingredientId:data.ingredients[0]?.id||'',date:today(),store:'',quantity:'',price:'' })
  useEffect(()=>{if(!form.ingredientId&&data.ingredients[0])setForm((f)=>({...f,ingredientId:data.ingredients[0].id}))},[data.ingredients,form.ingredientId])
  const add=async(e)=>{e.preventDefault(); const ing=data.ingredients.find(i=>i.id===form.ingredientId); if(!ing||!Number(form.quantity)||!Number(form.price))return
    const row={id:uid(),...form,quantity:Number(form.quantity),price:Number(form.price),unit:ing.unit,createdAt:new Date().toISOString()}
    setData(d=>({...d,purchases:[row,...d.purchases]})); await persist('purchase',{id:row.id,ingredient_id:row.ingredientId,purchased_at:row.date,store:row.store,quantity:row.quantity,unit:row.unit,price:row.price}); setForm(f=>({...f,store:'',quantity:'',price:''})); flash('구매를 기록했어요') }
  const sorted=[...data.purchases].sort((a,b)=>b.date.localeCompare(a.date))
  return <div className="pageStack">
    <section className="panel accentPanel">
      <div><p className="kicker">SHOPPING</p><h2>장본 즉시 기록</h2><p className="muted">구매처 · 용량 · 금액만 넣으면 단가가 자동으로 계산돼요.</p></div>
      <form className="formGrid" onSubmit={add}>
        <label>식재료<select value={form.ingredientId} onChange={e=>setForm({...form,ingredientId:e.target.value})}>{data.ingredients.map(i=><option value={i.id} key={i.id}>{i.name} ({i.unit})</option>)}</select></label>
        <label>구매일<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
        <label>구매처<input value={form.store} onChange={e=>setForm({...form,store:e.target.value})} placeholder="코스트코, 쿠팡…"/></label>
        <label>구매량<input type="number" step="0.1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="예: 300"/></label>
        <label>결제 금액<input type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="예: 4500"/></label>
        <button className="primaryButton" type="submit">구매 기록 추가</button>
      </form>
    </section>
    <section className="panel"><div className="sectionHead"><div><p className="kicker">HISTORY</p><h2>구매 일지</h2></div><span className="countPill">{sorted.length}건</span></div>
      {sorted.length ? <div className="purchaseList">{sorted.map(p=>{const ing=data.ingredients.find(i=>i.id===p.ingredientId); const per=Number(p.price)/Number(p.quantity)
        return <article className="purchaseRow" key={p.id}><div className="dateBadge"><b>{p.date.slice(8,10)}</b><span>{p.date.slice(5,7)}월</span></div><div className="purchaseMain"><h3>{ing?.name||'삭제된 재료'}</h3><p>{p.store||'구매처 미입력'} · {number(p.quantity,1)}{p.unit}</p><small>{p.unit}당 {money(per)}</small></div><strong>{money(p.price)}</strong><button className="miniDelete" onClick={async()=>{setData(d=>({...d,purchases:d.purchases.filter(x=>x.id!==p.id)})); await persist('purchase',{id:p.id},'delete')}}>×</button></article>})}</div> : <Empty text="구매 기록을 추가해 주세요." />}
    </section>
  </div>
}

function Recipes({ data, setData, persist, flash }) {
  const [name,setName]=useState(''); const [servings,setServings]=useState(1); const [items,setItems]=useState([{id:uid(),ingredientId:data.ingredients[0]?.id||'',quantity:''}])
  const totals=recipeTotals({items},data.ingredients,data.purchases)
  const addItem=()=>setItems([...items,{id:uid(),ingredientId:data.ingredients[0]?.id||'',quantity:''}])
  const save=async(e)=>{e.preventDefault(); if(!name.trim())return; const rid=uid(); const clean=items.filter(i=>i.ingredientId&&Number(i.quantity)).map(i=>{const ing=data.ingredients.find(x=>x.id===i.ingredientId); return {...i,quantity:Number(i.quantity),unit:ing?.unit||'g'}}); const recipe={id:rid,name:name.trim(),servings:Number(servings)||1,items:clean}; setData(d=>({...d,recipes:[...d.recipes,recipe]})); await persist('recipe',{id:rid,name:recipe.name,servings:recipe.servings}); for(const item of clean){await persist('recipeItem',{id:item.id,recipe_id:rid,ingredient_id:item.ingredientId,quantity:item.quantity,unit:item.unit})}; setName('');setItems([{id:uid(),ingredientId:data.ingredients[0]?.id||'',quantity:''}]);flash('레시피를 저장했어요')}
  return <div className="pageStack">
    <section className="panel recipeBuilder"><div className="sectionHead"><div><p className="kicker">RECIPE</p><h2>레시피 원가 계산</h2></div><div className="liveTotals"><span>{money(totals.cost)}</span><b>{number(totals.kcal,0)} kcal</b></div></div>
      <form onSubmit={save}>
        <div className="formGrid twoCols"><label>레시피 이름<input value={name} onChange={e=>setName(e.target.value)} placeholder="예: 불고기 또띠아랩"/></label><label>몇 인분<input type="number" min="1" value={servings} onChange={e=>setServings(e.target.value)}/></label></div>
        <div className="recipeItems">{items.map((item)=><div className="recipeItem" key={item.id}><select value={item.ingredientId} onChange={e=>setItems(items.map(x=>x.id===item.id?{...x,ingredientId:e.target.value}:x))}>{data.ingredients.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select><input type="number" step="0.1" value={item.quantity} onChange={e=>setItems(items.map(x=>x.id===item.id?{...x,quantity:e.target.value}:x))} placeholder="사용량"/><span>{data.ingredients.find(i=>i.id===item.ingredientId)?.unit}</span><button type="button" className="miniDelete" onClick={()=>setItems(items.filter(x=>x.id!==item.id))}>×</button></div>)}</div>
        <div className="formActions"><button className="secondaryButton" type="button" onClick={addItem}>재료 추가</button><button className="primaryButton" type="submit">레시피 저장</button></div>
      </form>
    </section>
    <section className="panel"><div className="sectionHead"><div><p className="kicker">MY RECIPES</p><h2>저장된 레시피</h2></div></div>
      {data.recipes.length?<div className="recipeGrid">{data.recipes.map(r=>{const t=recipeTotals(r,data.ingredients,data.purchases);return <article className="recipeCard" key={r.id}><div><span>{r.servings}인분</span><h3>{r.name}</h3></div><div className="recipeNumbers"><strong>{money(t.cost)}</strong><b>{number(t.kcal,0)} kcal</b></div><p>1인분 약 {money(t.cost/Math.max(1,r.servings))} · {number(t.kcal/Math.max(1,r.servings),0)} kcal</p></article>})}</div>:<Empty text="첫 레시피를 만들어 보세요."/>}
    </section>
  </div>
}

function Weight({ data,setData,persist,flash }) {
  const [form,setForm]=useState({date:today(),value:'',note:''})
  const sorted=[...data.weights].sort((a,b)=>a.date.localeCompare(b.date)); const latest=sorted.at(-1); const first=sorted[0]; const min=sorted.length?Math.min(...sorted.map(x=>Number(x.value))):0; const max=sorted.length?Math.max(...sorted.map(x=>Number(x.value))):0
  const add=async(e)=>{e.preventDefault();if(!Number(form.value))return;const row={id:uid(),date:form.date,value:Number(form.value),note:form.note};setData(d=>({...d,weights:[...d.weights,row]}));await persist('weight',{id:row.id,measured_at:row.date,weight_kg:row.value,note:row.note});setForm({...form,value:'',note:''});flash('체중을 기록했어요')}
  return <div className="pageStack"><section className="heroGrid weightHero"><article className="heroCard yellow"><p>현재</p><strong>{latest?`${latest.value} kg`:'-'}</strong><span>{latest?.date||'첫 기록을 추가해 주세요'}</span></article><article className="heroCard rose"><p>변화</p><strong>{latest&&first?`${round1(latest.value-first.value)>0?'+':''}${round1(latest.value-first.value)} kg`:'-'}</strong><span>첫 기록 대비</span></article><article className="heroCard cream"><p>최저 / 최고</p><strong>{sorted.length?`${min} / ${max}`:'-'}</strong><span>kg</span></article></section>
    <section className="panel"><div className="sectionHead"><div><p className="kicker">TREND</p><h2>체중 변화</h2></div></div><WeightChart rows={sorted}/></section>
    <section className="panel splitPanel"><div><p className="kicker">ADD</p><h2>체중 기록</h2></div><form className="formGrid compactForm" onSubmit={add}><label>날짜<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>체중 kg<input type="number" step="0.01" value={form.value} onChange={e=>setForm({...form,value:e.target.value})}/></label><label className="wide">메모<input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="선택"/></label><button className="primaryButton" type="submit">기록 추가</button></form></section>
    {sorted.length>0&&<section className="panel"><div className="simpleList">{[...sorted].reverse().map(w=><div className="simpleRow" key={w.id}><div><strong>{w.value} kg</strong><span>{w.date} {w.note&&`· ${w.note}`}</span></div><button className="miniDelete" onClick={async()=>{setData(d=>({...d,weights:d.weights.filter(x=>x.id!==w.id)}));await persist('weight',{id:w.id},'delete')}}>×</button></div>)}</div></section>}
  </div>
}

function WeightChart({rows}){
  if(rows.length<2)return <Empty text="체중을 2번 이상 기록하면 그래프가 보여요."/>
  const vals=rows.map(r=>Number(r.value)); const min=Math.min(...vals)-.5,max=Math.max(...vals)+.5,span=Math.max(1,max-min); const w=640,h=180,pad=18; const points=rows.map((r,i)=>{const x=pad+(i/(rows.length-1))*(w-pad*2);const y=pad+((max-Number(r.value))/span)*(h-pad*2);return `${x},${y}`}).join(' ')
  return <div className="chartWrap"><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="체중 변화 그래프"><line x1="18" y1="162" x2="622" y2="162" className="chartAxis"/><polyline points={points} className="chartLine" fill="none"/>{rows.map((r,i)=>{const [x,y]=points.split(' ')[i].split(',');return <circle key={r.id} cx={x} cy={y} r="4" className="chartDot"/>})}</svg><div className="chartLabels"><span>{rows[0].date.slice(5)}</span><span>{rows.at(-1).date.slice(5)}</span></div></div>
}

function Empty({text}){return <div className="empty"><span>○</span><p>{text}</p></div>}

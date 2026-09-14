import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

const VERSION = '0.2.0'
const LOCAL_KEY = 'with-me-life-v0.2'
const LEGACY_LOCAL_KEY = 'with-me-life-v0.1'
const today = () => new Date().toISOString().slice(0, 10)
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
const money = (n = 0) => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`
const number = (n = 0, digits = 0) => Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: digits })
const round1 = (n = 0) => Math.round((Number(n) || 0) * 10) / 10
const dateKey = (value) => new Date(`${value}T12:00:00`)

const defaultState = { ingredients: [], purchases: [], usages: [], recipes: [], weights: [] }

const normalizeIngredient = (x) => ({
  ...x,
  isPersonal: x?.isPersonal ?? x?.is_personal ?? true,
  kcalBaseQty: Number(x?.kcalBaseQty ?? x?.kcal_base_qty ?? 100),
  kcalBaseValue: Number(x?.kcalBaseValue ?? x?.kcal_base_value ?? 0),
})

const normalizeUsage = (x) => ({
  ...x,
  daysUsed: Number(x?.daysUsed ?? x?.days_used ?? 1),
  usageMode: x?.usageMode ?? x?.usage_mode ?? (Number(x?.daysUsed ?? x?.days_used ?? 1) > 1 ? 'depletion' : 'direct'),
  wasteIncluded: Boolean(x?.wasteIncluded ?? x?.waste_included ?? false),
})

const normalizeState = (raw) => ({
  ingredients: Array.isArray(raw?.ingredients) ? raw.ingredients.map(normalizeIngredient) : [],
  purchases: Array.isArray(raw?.purchases) ? raw.purchases : [],
  usages: Array.isArray(raw?.usages) ? raw.usages.map(normalizeUsage) : [],
  recipes: Array.isArray(raw?.recipes) ? raw.recipes : [],
  weights: Array.isArray(raw?.weights) ? raw.weights : [],
})

function loadLocal() {
  try {
    const saved = localStorage.getItem(LOCAL_KEY) || localStorage.getItem(LEGACY_LOCAL_KEY)
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

function usageDailyAverage7(ingredientId, usages) {
  const rows = usages.filter((u) => u.ingredientId === ingredientId)
  if (!rows.length) return 0
  const end = dateKey(today())
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  const byDay = new Map()

  rows.forEach((row) => {
    const quantity = Number(row.quantity || 0)
    if (!quantity) return
    const mode = row.usageMode || (Number(row.daysUsed) > 1 ? 'depletion' : 'direct')
    const days = mode === 'depletion' ? Math.max(1, Number(row.daysUsed || 1)) : 1
    const rowEnd = dateKey(row.date || today())
    const dailyQty = quantity / days
    for (let offset = 0; offset < days; offset += 1) {
      const d = new Date(rowEnd)
      d.setDate(d.getDate() - offset)
      if (d < start || d > end) continue
      const key = d.toISOString().slice(0, 10)
      byDay.set(key, (byDay.get(key) || 0) + dailyQty)
    }
  })

  if (!byDay.size) return 0
  return [...byDay.values()].reduce((sum, value) => sum + value, 0) / byDay.size
}

function todayUsage(ingredientId, usages) {
  const key = today()
  return usages.reduce((sum, row) => {
    if (row.ingredientId !== ingredientId) return sum
    const mode = row.usageMode || (Number(row.daysUsed) > 1 ? 'depletion' : 'direct')
    if (mode === 'direct') return row.date === key ? sum + Number(row.quantity || 0) : sum
    const days = Math.max(1, Number(row.daysUsed || 1))
    const end = dateKey(row.date || key)
    const start = new Date(end)
    start.setDate(start.getDate() - days + 1)
    const target = dateKey(key)
    return target >= start && target <= end ? sum + Number(row.quantity || 0) / days : sum
  }, 0)
}

function recipeTotals(recipe, ingredients, purchases) {
  return (recipe.items || []).reduce((acc, item) => {
    const ingredient = ingredients.find((i) => i.id === item.ingredientId)
    if (!ingredient) return acc
    const qty = Number(item.quantity || 0)
    acc.cost += unitPrice(item.ingredientId, purchases) * qty
    acc.kcal += Number(ingredient.kcalBaseQty) > 0
      ? (qty / Number(ingredient.kcalBaseQty)) * Number(ingredient.kcalBaseValue || 0)
      : 0
    return acc
  }, { cost: 0, kcal: 0 })
}

function Icon({ name }) {
  const map = { home: '⌂', ingredient: '◫', purchase: '₩', recipe: '☷', weight: '↗', logout: '↪' }
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

  useEffect(() => { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)) }, [data])

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
        console.warn('v0.2 tables not ready:', anyError.error)
        setCloudEnabled(false)
        setSyncState('로컬 모드')
        return
      }
      const cloud = {
        ingredients: ingredients.data.map((x) => normalizeIngredient({ id: x.id, name: x.name, unit: x.unit, kcalBaseQty: x.kcal_base_qty, kcalBaseValue: x.kcal_base_value, category: x.category || '', isPersonal: x.is_personal })),
        purchases: purchases.data.map((x) => ({ id: x.id, ingredientId: x.ingredient_id, date: x.purchased_at, store: x.store || '', quantity: x.quantity, unit: x.unit, price: x.price, createdAt: x.created_at })),
        usages: usages.data.map((x) => normalizeUsage({ id: x.id, ingredientId: x.ingredient_id, date: x.used_at, quantity: x.quantity, unit: x.unit, daysUsed: x.days_used, usageMode: x.usage_mode, wasteIncluded: x.waste_included })),
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
    if (!cloudEnabled || !session?.user?.id) return true
    const user_id = session.user.id
    const tableMap = { ingredient: 'life_ingredients', purchase: 'life_purchases', usage: 'life_usages', recipe: 'life_recipes', recipeItem: 'life_recipe_items', weight: 'life_weights' }
    const table = tableMap[kind]
    if (!table) return false
    setSyncState('저장 중')
    const q = action === 'delete'
      ? supabase.from(table).delete().eq('id', row.id).eq('user_id', user_id)
      : supabase.from(table).upsert({ ...row, user_id }, { onConflict: 'id' })
    const { error } = await q
    setSyncState(error ? '로컬 저장됨' : '저장됨')
    if (error) console.warn('cloud save failed', error)
    return !error
  }

  const monthlyEstimate = useMemo(() => data.ingredients.reduce((sum, ing) => {
    if (!ing.isPersonal) return sum
    return sum + usageDailyAverage7(ing.id, data.usages) * 30 * unitPrice(ing.id, data.purchases)
  }, 0), [data.ingredients, data.usages, data.purchases])

  const thisMonthSpend = useMemo(() => {
    const key = today().slice(0, 7)
    return data.purchases.filter((p) => p.date?.startsWith(key)).reduce((s, p) => s + Number(p.price || 0), 0)
  }, [data.purchases])

  const latestWeight = useMemo(() => [...data.weights].sort((a, b) => b.date.localeCompare(a.date))[0], [data.weights])
  const firstWeight = useMemo(() => [...data.weights].sort((a, b) => a.date.localeCompare(b.date))[0], [data.weights])

  if (!authReady) return <div className="centerPage"><div className="loader" /></div>

  if (!session) {
    const submitLogin = async (e) => {
      e.preventDefault(); setLoginError('')
      const { error } = await supabase.auth.signInWithPassword(login)
      if (error) setLoginError('로그인 정보를 확인해 주세요.')
    }
    return <div className="loginPage"><div className="loginCard">
      <div className="brandMark">W</div><p className="eyebrow">WITH ME · LIFE</p>
      <h1>내 생활을<br/>가볍게 기록해요.</h1>
      <p className="muted">장보면 바로 기록하고, 내 식비와 체중은 자동으로.</p>
      <form onSubmit={submitLogin} className="loginForm">
        <input type="email" placeholder="이메일" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} required />
        <input type="password" placeholder="비밀번호" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} required />
        {loginError && <p className="errorText">{loginError}</p>}
        <button className="primaryButton" type="submit">로그인</button>
      </form><small>v{VERSION}</small>
    </div></div>
  }

  return <div className="appShell">
    {toast && <div className="toast">{toast}</div>}
    <main className="content">
      <header className="topbar"><div><p className="eyebrow">WITH ME · v{VERSION}</p><h1>{tab === 'home' ? '오늘도 가볍게.' : navItems.find((n) => n.id === tab)?.label}</h1></div>
        <div className="topActions"><span className="syncPill">{syncState}</span><button className="iconButton" onClick={() => supabase.auth.signOut()} aria-label="로그아웃"><Icon name="logout" /></button></div>
      </header>
      {tab === 'home' && <Home data={data} monthlyEstimate={monthlyEstimate} thisMonthSpend={thisMonthSpend} latestWeight={latestWeight} firstWeight={firstWeight} go={setTab} />}
      {tab === 'ingredients' && <Ingredients data={data} setData={setData} persist={persist} flash={flash} />}
      {tab === 'purchases' && <Purchases data={data} setData={setData} persist={persist} flash={flash} />}
      {tab === 'recipes' && <Recipes data={data} setData={setData} persist={persist} flash={flash} />}
      {tab === 'weight' && <Weight data={data} setData={setData} persist={persist} flash={flash} />}
    </main>
    <nav className="bottomNav">{navItems.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav>
  </div>
}

const navItems = [
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'ingredients', label: '식재료', icon: 'ingredient' },
  { id: 'purchases', label: '구매', icon: 'purchase' },
  { id: 'recipes', label: '레시피', icon: 'recipe' },
  { id: 'weight', label: '체중', icon: 'weight' },
]

function Home({ data, monthlyEstimate, thisMonthSpend, latestWeight, firstWeight, go }) {
  const recent = [...data.purchases].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const monthlyDelta = latestWeight && firstWeight ? round1(latestWeight.value - firstWeight.value) : null
  return <div className="pageStack">
    <section className="heroGrid">
      <article className="heroCard yellow"><p>내 식비 예상</p><strong>{money(monthlyEstimate)}</strong><span>내 식단 재료 · 최근 7일 사용 패턴</span></article>
      <article className="heroCard rose"><p>이번 달 장보기</p><strong>{money(thisMonthSpend)}</strong><span>가족 포함 실제 구매 금액</span></article>
      <article className="heroCard cream"><p>최근 체중</p><strong>{latestWeight ? `${latestWeight.value} kg` : '기록 없음'}</strong><span>{monthlyDelta === null ? '첫 기록을 남겨보세요' : `첫 기록 대비 ${monthlyDelta > 0 ? '+' : ''}${monthlyDelta}kg`}</span></article>
    </section>
    <section className="panel"><div className="sectionHead"><div><p className="kicker">QUICK</p><h2>빠른 기록</h2></div></div>
      <div className="quickGrid">
        <button onClick={() => go('purchases')}><b>＋</b><span>오늘 산 것</span><small>처음 사는 재료도 바로 입력</small></button>
        <button onClick={() => go('ingredients')}><b>＋</b><span>사용 / 소진</span><small>2장 먹음 · 한 봉지 5일</small></button>
        <button onClick={() => go('weight')}><b>＋</b><span>체중 기록</span><small>날짜별 변화 보기</small></button>
      </div>
    </section>
    <section className="panel"><div className="sectionHead"><div><p className="kicker">RECENT</p><h2>최근 구매</h2></div><button className="textButton" onClick={() => go('purchases')}>전체보기</button></div>
      {recent.length ? <div className="simpleList">{recent.map((p) => { const ing = data.ingredients.find((i) => i.id === p.ingredientId); return <div className="simpleRow" key={p.id}><div><strong>{ing?.name || '삭제된 재료'}</strong><span>{p.store || '구매처 미입력'} · {number(p.quantity, 1)}{p.unit} {ing?.isPersonal ? '· 내 식단' : ''}</span></div><b>{money(p.price)}</b></div> })}</div> : <Empty text="아직 구매 기록이 없어요." />}
    </section>
  </div>
}

function Ingredients({ data, setData, persist, flash }) {
  const firstId = data.ingredients[0]?.id || ''
  const [usage, setUsage] = useState({ id: '', ingredientId: firstId, quantity: '', daysUsed: 1, date: today(), usageMode: 'direct', wasteIncluded: false })
  const [ingredientForm, setIngredientForm] = useState({ id: '', name: '', unit: 'g', kcalBaseQty: 100, kcalBaseValue: '', category: '', isPersonal: true })
  const resetUsage = () => setUsage({ id: '', ingredientId: data.ingredients[0]?.id || '', quantity: '', daysUsed: 1, date: today(), usageMode: 'direct', wasteIncluded: false })
  const saveUsage = async (e) => {
    e.preventDefault()
    const selectedIngredientId = usage.ingredientId || firstId
    const ing = data.ingredients.find((i) => i.id === selectedIngredientId)
    if (!ing || !Number(usage.quantity)) return
    const row = { ...usage, ingredientId: selectedIngredientId, id: usage.id || uid(), quantity: Number(usage.quantity), daysUsed: usage.usageMode === 'depletion' ? Math.max(1, Number(usage.daysUsed) || 1) : 1, unit: ing.unit }
    setData((d) => ({ ...d, usages: usage.id ? d.usages.map((x) => x.id === row.id ? row : x) : [row, ...d.usages] }))
    await persist('usage', { id: row.id, ingredient_id: row.ingredientId, used_at: row.date, quantity: row.quantity, unit: row.unit, days_used: row.daysUsed, usage_mode: row.usageMode, waste_included: row.wasteIncluded })
    resetUsage(); flash(usage.id ? '사용 기록을 수정했어요' : '사용 기록을 추가했어요')
  }
  const editUsage = (row) => setUsage({ ...row })
  const deleteUsage = async (id) => {
    setData((d) => ({ ...d, usages: d.usages.filter((x) => x.id !== id) }))
    await persist('usage', { id }, 'delete')
    if (usage.id === id) resetUsage()
    flash('사용 기록을 삭제했어요')
  }

  const saveIngredient = async (e) => {
    e.preventDefault(); if (!ingredientForm.name.trim()) return
    const row = { ...ingredientForm, id: ingredientForm.id || uid(), name: ingredientForm.name.trim(), kcalBaseQty: Number(ingredientForm.kcalBaseQty) || 1, kcalBaseValue: Number(ingredientForm.kcalBaseValue) || 0 }
    setData((d) => ({ ...d, ingredients: ingredientForm.id ? d.ingredients.map((x) => x.id === row.id ? row : x) : [...d.ingredients, row] }))
    await persist('ingredient', { id: row.id, name: row.name, unit: row.unit, kcal_base_qty: row.kcalBaseQty, kcal_base_value: row.kcalBaseValue, category: row.category, is_personal: row.isPersonal })
    setIngredientForm({ id: '', name: '', unit: 'g', kcalBaseQty: 100, kcalBaseValue: '', category: '', isPersonal: true })
    flash(ingredientForm.id ? '식재료 정보를 수정했어요' : '식재료를 추가했어요')
  }

  const recentUsages = [...data.usages].sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`)).slice(0, 8)

  return <div className="pageStack">
    <section className="panel splitPanel"><div><p className="kicker">USE</p><h2>{usage.id ? '사용 기록 수정' : '사용 / 소진 기록'}</h2><p className="muted">또띠아는 “오늘 2장”, 채소는 “300g 한 봉지를 5일 만에 소진”처럼 기록해요.</p></div>
      <form className="formGrid compactForm" onSubmit={saveUsage}>
        <label>식재료<select value={usage.ingredientId || firstId} onChange={(e) => setUsage({ ...usage, ingredientId: e.target.value })}>{data.ingredients.map((i) => <option value={i.id} key={i.id}>{i.name}</option>)}</select></label>
        <label>기록 방식<select value={usage.usageMode} onChange={(e) => setUsage({ ...usage, usageMode: e.target.value, daysUsed: e.target.value === 'direct' ? 1 : usage.daysUsed })}><option value="direct">오늘 사용한 양</option><option value="depletion">한 봉지 소진</option></select></label>
        <label>{usage.usageMode === 'direct' ? '사용량' : '봉지 / 구매량'}<input type="number" step="0.1" value={usage.quantity} onChange={(e) => setUsage({ ...usage, quantity: e.target.value })} placeholder="예: 2 또는 300" /></label>
        {usage.usageMode === 'depletion' && <label>며칠 만에 소진<input type="number" min="1" value={usage.daysUsed} onChange={(e) => setUsage({ ...usage, daysUsed: e.target.value })} /></label>}
        <label>{usage.usageMode === 'depletion' ? '소진일' : '사용일'}<input type="date" value={usage.date} onChange={(e) => setUsage({ ...usage, date: e.target.value })} /></label>
        {usage.usageMode === 'depletion' && <label className="checkLabel"><input type="checkbox" checked={usage.wasteIncluded} onChange={(e) => setUsage({ ...usage, wasteIncluded: e.target.checked })} /><span>시들어서 버린 양도 포함</span></label>}
        <div className="inlineActions"><button className="primaryButton" type="submit">{usage.id ? '수정 저장' : '기록 추가'}</button>{usage.id && <button className="secondaryButton" type="button" onClick={resetUsage}>취소</button>}</div>
      </form>
    </section>

    <section className="panel"><div className="sectionHead"><div><p className="kicker">HISTORY</p><h2>최근 사용 기록</h2></div><span className="countPill">최근 {recentUsages.length}건</span></div>
      {recentUsages.length ? <div className="usageList">{recentUsages.map((u) => { const ing = data.ingredients.find((i) => i.id === u.ingredientId); return <article className="usageRow" key={u.id}><div><strong>{ing?.name || '삭제된 재료'}</strong><span>{u.date} · {u.usageMode === 'depletion' ? `${number(u.quantity, 1)}${u.unit} / ${u.daysUsed}일 소진${u.wasteIncluded ? ' · 폐기 포함' : ''}` : `${number(u.quantity, 1)}${u.unit} 사용`}</span></div><div className="rowActions"><button className="smallButton" onClick={() => editUsage(u)}>수정</button><button className="smallButton danger" onClick={() => deleteUsage(u.id)}>삭제</button></div></article> })}</div> : <Empty text="사용 기록이 아직 없어요." />}
    </section>

    <section className="panel"><div className="sectionHead"><div><p className="kicker">PANTRY</p><h2>식재료 현황</h2></div><span className="countPill">{data.ingredients.length}개</span></div>
      <div className="ingredientGrid">{data.ingredients.map((ing) => {
        const latest = latestPurchaseFor(ing.id, data.purchases); const per = unitPrice(ing.id, data.purchases); const daily = usageDailyAverage7(ing.id, data.usages); const todayQty = todayUsage(ing.id, data.usages); const monthly = ing.isPersonal ? daily * 30 * per : 0
        return <article className="ingredientCard" key={ing.id}><div className="ingredientTitle"><div><span>{ing.isPersonal ? '내 식단' : '구매 기록만'}{ing.category ? ` · ${ing.category}` : ''}</span><h3>{ing.name}</h3></div><button className="smallButton" onClick={() => setIngredientForm({ ...ing })}>관리</button></div>
          <dl><div><dt>오늘 사용</dt><dd>{todayQty ? `${number(todayQty, 1)}${ing.unit}` : '-'}</dd></div><div><dt>최근 7일 평균</dt><dd>{daily ? `${number(daily, 1)}${ing.unit}/일` : '-'}</dd></div><div><dt>{ing.isPersonal ? '최근 단가' : '비용 계산'}</dt><dd>{ing.isPersonal ? (per ? `${money(per)}/${ing.unit}` : '구매 기록 없음') : '제외'}</dd></div><div><dt>월 예상</dt><dd className="roseText">{ing.isPersonal && monthly ? money(monthly) : '-'}</dd></div></dl>
          {latest && <p className="cardFoot">최근 구매 · {latest.store || '구매처 미입력'} · {latest.date}</p>}
        </article>
      })}</div>
    </section>

    <section className="panel"><div className="sectionHead"><div><p className="kicker">MANAGE</p><h2>{ingredientForm.id ? `${ingredientForm.name} 관리` : '식재료 직접 추가 / 관리'}</h2></div></div>
      <p className="muted manageHint">보통은 구매 탭에서 새 재료가 자동 생성돼요. 여기서는 칼로리, 분류, 내 식단 포함 여부를 고쳐요.</p>
      <form className="formGrid" onSubmit={saveIngredient}>
        <label>이름<input value={ingredientForm.name} onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })} placeholder="예: 또띠아" /></label>
        <label>기준 단위<select value={ingredientForm.unit} onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value, kcalBaseQty: ['g', 'ml'].includes(e.target.value) ? 100 : 1 })}>{['g', 'ml', '개', '장', '팩', '봉'].map((u) => <option key={u}>{u}</option>)}</select></label>
        <label>칼로리 기준량<input type="number" step="0.1" value={ingredientForm.kcalBaseQty} onChange={(e) => setIngredientForm({ ...ingredientForm, kcalBaseQty: e.target.value })} /></label>
        <label>기준 kcal<input type="number" step="0.1" value={ingredientForm.kcalBaseValue} onChange={(e) => setIngredientForm({ ...ingredientForm, kcalBaseValue: e.target.value })} placeholder="모르면 0" /></label>
        <label>분류<input value={ingredientForm.category} onChange={(e) => setIngredientForm({ ...ingredientForm, category: e.target.value })} placeholder="채소, 단백질…" /></label>
        <label className="checkLabel"><input type="checkbox" checked={ingredientForm.isPersonal} onChange={(e) => setIngredientForm({ ...ingredientForm, isPersonal: e.target.checked })} /><span>내 식단 원가 · 예상비용에 포함</span></label>
        <div className="inlineActions"><button className="primaryButton" type="submit">{ingredientForm.id ? '정보 수정' : '직접 추가'}</button>{ingredientForm.id && <button className="secondaryButton" type="button" onClick={() => setIngredientForm({ id: '', name: '', unit: 'g', kcalBaseQty: 100, kcalBaseValue: '', category: '', isPersonal: true })}>취소</button>}</div>
      </form>
    </section>
  </div>
}

function Purchases({ data, setData, persist, flash }) {
  const [form, setForm] = useState({ name: '', date: today(), store: '', quantity: '', unit: 'g', price: '', isPersonal: true })
  const findExisting = (name) => data.ingredients.find((i) => i.name.trim().toLowerCase() === name.trim().toLowerCase())
  const nameList = [...data.ingredients].sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  const add = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !Number(form.quantity) || !Number(form.price)) return
    let ing = findExisting(form.name)
    if (!ing) {
      ing = { id: uid(), name: form.name.trim(), unit: form.unit, kcalBaseQty: ['g', 'ml'].includes(form.unit) ? 100 : 1, kcalBaseValue: 0, category: '', isPersonal: form.isPersonal }
      setData((d) => ({ ...d, ingredients: [...d.ingredients, ing] }))
      await persist('ingredient', { id: ing.id, name: ing.name, unit: ing.unit, kcal_base_qty: ing.kcalBaseQty, kcal_base_value: 0, category: '', is_personal: ing.isPersonal })
    } else if (form.isPersonal && !ing.isPersonal) {
      ing = { ...ing, isPersonal: true }
      setData((d) => ({ ...d, ingredients: d.ingredients.map((x) => x.id === ing.id ? ing : x) }))
      await persist('ingredient', { id: ing.id, name: ing.name, unit: ing.unit, kcal_base_qty: ing.kcalBaseQty, kcal_base_value: ing.kcalBaseValue, category: ing.category || '', is_personal: true })
    }
    const row = { id: uid(), ingredientId: ing.id, date: form.date, store: form.store, quantity: Number(form.quantity), price: Number(form.price), unit: ing.unit, createdAt: new Date().toISOString() }
    setData((d) => ({ ...d, purchases: [row, ...d.purchases] }))
    await persist('purchase', { id: row.id, ingredient_id: row.ingredientId, purchased_at: row.date, store: row.store, quantity: row.quantity, unit: row.unit, price: row.price })
    setForm((f) => ({ ...f, name: '', store: '', quantity: '', price: '', unit: 'g', isPersonal: true }))
    flash('구매를 기록했어요')
  }

  const onNameChange = (value) => {
    const existing = findExisting(value)
    setForm((f) => ({ ...f, name: value, unit: existing?.unit || f.unit, isPersonal: existing?.isPersonal ?? f.isPersonal }))
  }
  const sorted = [...data.purchases].sort((a, b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`))

  return <div className="pageStack">
    <section className="panel accentPanel"><div><p className="kicker">SHOPPING</p><h2>오늘 산 것 바로 기록</h2><p className="muted">처음 사는 재료면 식재료 목록에 자동으로 만들어져요. 가족 장보기도 함께 기록할 수 있어요.</p></div>
      <form className="formGrid purchaseFirst" onSubmit={add}>
        <label>품목 이름<input list="ingredientNames" value={form.name} onChange={(e) => onNameChange(e.target.value)} placeholder="예: 깻잎" /><datalist id="ingredientNames">{nameList.map((i) => <option value={i.name} key={i.id} />)}</datalist></label>
        <label>구매량<input type="number" step="0.1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="예: 300" /></label>
        <label>단위<select value={form.unit} disabled={Boolean(findExisting(form.name))} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{['g', 'ml', '개', '장', '팩', '봉'].map((u) => <option key={u}>{u}</option>)}</select></label>
        <label>결제 금액<input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="예: 4500" /></label>
        <label>구매처<input value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} placeholder="쿠팡, 코스트코…" /></label>
        <label>구매일<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
        <label className="checkLabel"><input type="checkbox" checked={form.isPersonal} onChange={(e) => setForm({ ...form, isPersonal: e.target.checked })} /><span>내 식단에 쓰는 재료</span></label>
        <button className="primaryButton" type="submit">구매 기록 추가</button>
      </form>
    </section>
    <section className="panel"><div className="sectionHead"><div><p className="kicker">HISTORY</p><h2>구매 일지</h2></div><span className="countPill">{sorted.length}건</span></div>
      {sorted.length ? <div className="purchaseList">{sorted.map((p) => { const ing = data.ingredients.find((i) => i.id === p.ingredientId); const per = Number(p.price) / Number(p.quantity); return <article className="purchaseRow" key={p.id}><div className="dateBadge"><b>{p.date.slice(8, 10)}</b><span>{p.date.slice(5, 7)}월</span></div><div className="purchaseMain"><h3>{ing?.name || '삭제된 재료'} {ing?.isPersonal && <em className="mineTag">내 식단</em>}</h3><p>{p.store || '구매처 미입력'} · {number(p.quantity, 1)}{p.unit}</p><small>{ing?.isPersonal ? `${p.unit}당 ${money(per)}` : '구매 이력만 기록 · 내 식비 계산 제외'}</small></div><strong>{money(p.price)}</strong><button className="miniDelete" onClick={async () => { setData((d) => ({ ...d, purchases: d.purchases.filter((x) => x.id !== p.id) })); await persist('purchase', { id: p.id }, 'delete'); flash('구매 기록을 삭제했어요') }}>×</button></article> })}</div> : <Empty text="구매 기록을 추가해 주세요." />}
    </section>
  </div>
}

function Recipes({ data, setData, persist, flash }) {
  const personalIngredients = data.ingredients.filter((i) => i.isPersonal)
  const firstId = personalIngredients[0]?.id || ''
  const [name, setName] = useState(''); const [servings, setServings] = useState(1); const [items, setItems] = useState([{ id: uid(), ingredientId: firstId, quantity: '' }])
  const totals = recipeTotals({ items }, data.ingredients, data.purchases)
  const addItem = () => setItems([...items, { id: uid(), ingredientId: firstId, quantity: '' }])
  const save = async (e) => {
    e.preventDefault(); if (!name.trim()) return
    const rid = uid(); const clean = items.filter((i) => i.ingredientId && Number(i.quantity)).map((i) => { const ing = data.ingredients.find((x) => x.id === i.ingredientId); return { ...i, quantity: Number(i.quantity), unit: ing?.unit || 'g' } })
    const recipe = { id: rid, name: name.trim(), servings: Number(servings) || 1, items: clean }
    setData((d) => ({ ...d, recipes: [...d.recipes, recipe] })); await persist('recipe', { id: rid, name: recipe.name, servings: recipe.servings }); for (const item of clean) await persist('recipeItem', { id: item.id, recipe_id: rid, ingredient_id: item.ingredientId, quantity: item.quantity, unit: item.unit })
    setName(''); setItems([{ id: uid(), ingredientId: firstId, quantity: '' }]); flash('레시피를 저장했어요')
  }
  return <div className="pageStack"><section className="panel recipeBuilder"><div className="sectionHead"><div><p className="kicker">RECIPE</p><h2>내 음식 원가 · 칼로리</h2></div><div className="liveTotals"><span>{money(totals.cost)}</span><b>{number(totals.kcal, 0)} kcal</b></div></div>
    <p className="muted manageHint">‘내 식단’으로 표시된 재료만 선택돼요. 칼로리는 식재료 관리에서 기준값을 넣으면 자동 계산돼요.</p>
    {personalIngredients.length ? <form onSubmit={save}><div className="formGrid twoCols"><label>레시피 이름<input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 불고기 또띠아랩" /></label><label>몇 인분<input type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)} /></label></div>
      <div className="recipeItems">{items.map((item) => <div className="recipeItem" key={item.id}><select value={item.ingredientId} onChange={(e) => setItems(items.map((x) => x.id === item.id ? { ...x, ingredientId: e.target.value } : x))}>{personalIngredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select><input type="number" step="0.1" value={item.quantity} onChange={(e) => setItems(items.map((x) => x.id === item.id ? { ...x, quantity: e.target.value } : x))} placeholder="사용량" /><span>{data.ingredients.find((i) => i.id === item.ingredientId)?.unit}</span><button type="button" className="miniDelete" onClick={() => setItems(items.filter((x) => x.id !== item.id))}>×</button></div>)}</div>
      <div className="formActions"><button className="secondaryButton" type="button" onClick={addItem}>재료 추가</button><button className="primaryButton" type="submit">레시피 저장</button></div></form> : <Empty text="구매 기록에서 ‘내 식단’ 재료를 먼저 추가해 주세요." />}
  </section>
  <section className="panel"><div className="sectionHead"><div><p className="kicker">MY RECIPES</p><h2>저장된 레시피</h2></div></div>{data.recipes.length ? <div className="recipeGrid">{data.recipes.map((r) => { const t = recipeTotals(r, data.ingredients, data.purchases); return <article className="recipeCard" key={r.id}><div><span>{r.servings}인분</span><h3>{r.name}</h3></div><div className="recipeNumbers"><strong>{money(t.cost)}</strong><b>{number(t.kcal, 0)} kcal</b></div><p>1인분 약 {money(t.cost / Math.max(1, r.servings))} · {number(t.kcal / Math.max(1, r.servings), 0)} kcal</p></article> })}</div> : <Empty text="첫 레시피를 만들어 보세요." />}</section></div>
}

function Weight({ data, setData, persist, flash }) {
  const [form, setForm] = useState({ date: today(), value: '', note: '' })
  const sorted = [...data.weights].sort((a, b) => a.date.localeCompare(b.date)); const latest = sorted.at(-1); const first = sorted[0]; const min = sorted.length ? Math.min(...sorted.map((x) => Number(x.value))) : 0; const max = sorted.length ? Math.max(...sorted.map((x) => Number(x.value))) : 0
  const add = async (e) => { e.preventDefault(); if (!Number(form.value)) return; const row = { id: uid(), date: form.date, value: Number(form.value), note: form.note }; setData((d) => ({ ...d, weights: [...d.weights, row] })); await persist('weight', { id: row.id, measured_at: row.date, weight_kg: row.value, note: row.note }); setForm({ ...form, value: '', note: '' }); flash('체중을 기록했어요') }
  return <div className="pageStack"><section className="heroGrid weightHero"><article className="heroCard yellow"><p>현재</p><strong>{latest ? `${latest.value} kg` : '-'}</strong><span>{latest?.date || '첫 기록을 추가해 주세요'}</span></article><article className="heroCard rose"><p>변화</p><strong>{latest && first ? `${round1(latest.value - first.value) > 0 ? '+' : ''}${round1(latest.value - first.value)} kg` : '-'}</strong><span>첫 기록 대비</span></article><article className="heroCard cream"><p>최저 / 최고</p><strong>{sorted.length ? `${min} / ${max}` : '-'}</strong><span>kg</span></article></section>
    <section className="panel"><div className="sectionHead"><div><p className="kicker">TREND</p><h2>체중 변화</h2></div></div><WeightChart rows={sorted} /></section>
    <section className="panel splitPanel"><div><p className="kicker">ADD</p><h2>체중 기록</h2></div><form className="formGrid compactForm" onSubmit={add}><label>날짜<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label>체중 kg<input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></label><label className="wide">메모<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="선택" /></label><button className="primaryButton" type="submit">기록 추가</button></form></section>
    {sorted.length > 0 && <section className="panel"><div className="simpleList">{[...sorted].reverse().map((w) => <div className="simpleRow" key={w.id}><div><strong>{w.value} kg</strong><span>{w.date} {w.note && `· ${w.note}`}</span></div><button className="miniDelete" onClick={async () => { setData((d) => ({ ...d, weights: d.weights.filter((x) => x.id !== w.id) })); await persist('weight', { id: w.id }, 'delete') }}>×</button></div>)}</div></section>}
  </div>
}

function WeightChart({ rows }) {
  if (rows.length < 2) return <Empty text="체중을 2번 이상 기록하면 그래프가 보여요." />
  const vals = rows.map((r) => Number(r.value)); const min = Math.min(...vals) - .5; const max = Math.max(...vals) + .5; const span = Math.max(1, max - min); const w = 640; const h = 180; const pad = 18; const pointList = rows.map((r, i) => ({ x: pad + (i / (rows.length - 1)) * (w - pad * 2), y: pad + ((max - Number(r.value)) / span) * (h - pad * 2), id: r.id })); const points = pointList.map((p) => `${p.x},${p.y}`).join(' ')
  return <div className="chartWrap"><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="체중 변화 그래프"><line x1="18" y1="162" x2="622" y2="162" className="chartAxis" /><polyline points={points} className="chartLine" fill="none" />{pointList.map((p) => <circle key={p.id} cx={p.x} cy={p.y} r="4" className="chartDot" />)}</svg><div className="chartLabels"><span>{rows[0].date.slice(5)}</span><span>{rows.at(-1).date.slice(5)}</span></div></div>
}

function Empty({ text }) { return <div className="empty"><span>○</span><p>{text}</p></div> }

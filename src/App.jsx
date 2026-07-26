import { useMemo, useState } from 'react'
import './App.css'

const initialTodos = [
  { id: 1, title: '이유식 용기 정리', done: false, important: true },
  { id: 2, title: '세탁기 돌리기', done: false, important: false },
]

const initialStock = [
  { id: 1, name: '계란', category: '음식', quantity: 4, unit: '개', threshold: 6 },
  { id: 2, name: '물티슈', category: '육아', quantity: 1, unit: '팩', threshold: 2 },
  { id: 3, name: '선크림', category: '화장품', quantity: 1, unit: '개', threshold: 0 },
]

const initialNeeds = [
  { id: 1, name: '계란', done: false },
  { id: 2, name: '아기 치약', done: false },
]

const meals = [
  ['월', '순두부 계란찜', '닭안심 야채볶음', '바나나', '소고기 덮밥'],
  ['화', '', '', '', ''], ['수', '', '', '', ''], ['목', '', '', '', ''],
  ['금', '', '', '', ''], ['토', '', '', '', ''], ['일', '', '', '', ''],
]

export default function App() {
  const [tab, setTab] = useState('home')
  const [todos, setTodos] = useState(initialTodos)
  const [stock, setStock] = useState(initialStock)
  const [needs, setNeeds] = useState(initialNeeds)
  const [todoDraft, setTodoDraft] = useState('')
  const [needDraft, setNeedDraft] = useState('')

  const lowStock = useMemo(
    () => stock.filter((item) => Number(item.quantity) <= Number(item.threshold)),
    [stock],
  )

  const addTodo = () => {
    const title = todoDraft.trim()
    if (!title) return
    setTodos((prev) => [...prev, { id: Date.now(), title, done: false, important: false }])
    setTodoDraft('')
  }

  const addNeed = () => {
    const name = needDraft.trim()
    if (!name) return
    setNeeds((prev) => [...prev, { id: Date.now(), name, done: false }])
    setNeedDraft('')
  }

  return (
    <div className="app">
      <main className="content">
        <header className="header">
          <p className="eyebrow">WITH ME</p>
          <h1>{titleFor(tab)}</h1>
          <p className="sub">{subtitleFor(tab)}</p>
        </header>

        {tab === 'home' && (
          <section className="stack">
            <Card title="Todo" kicker="TODAY" onClick={() => setTab('todo')}>
              <div className="list">
                {todos.slice(0, 4).map((item) => (
                  <label className={item.done ? 'row done' : 'row'} key={item.id}>
                    <input type="checkbox" checked={item.done}
                      onChange={() => setTodos((prev) => prev.map((x) => x.id === item.id ? {...x, done: !x.done} : x))}/>
                    <span>{item.title}</span>
                    {item.important && <b className="badge yellow">중요</b>}
                  </label>
                ))}
              </div>
            </Card>

            <Card title="Meals" kicker="TODAY" onClick={() => setTab('meals')}>
              <div className="mealGrid">
                <Mini label="아침" value="순두부 계란찜" />
                <Mini label="점심" value="닭안심 야채볶음" />
                <Mini label="간식" value="바나나" />
                <Mini label="저녁" value="소고기 덮밥" />
              </div>
            </Card>

            {lowStock.length > 0 && (
              <Card title="Stock" kicker="ALERT" onClick={() => setTab('stock')}>
                <div className="chips">{lowStock.map((item) => (
                  <span className="chip alert" key={item.id}>{item.name} · {item.quantity}{item.unit}</span>
                ))}</div>
              </Card>
            )}

            {needs.some((item) => !item.done) && (
              <Card title="Need" kicker="TO BUY" onClick={() => setTab('need')}>
                <div className="chips">{needs.filter((x) => !x.done).map((item) => (
                  <span className="chip" key={item.id}>{item.name}</span>
                ))}</div>
              </Card>
            )}
          </section>
        )}

        {tab === 'todo' && (
          <section className="pageCard">
            <div className="segmented"><button className="active">Today</button><button>Next</button><button>Library</button></div>
            <div className="addRow">
              <input value={todoDraft} onChange={(e) => setTodoDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTodo()} placeholder="할 일 추가"/>
              <button onClick={addTodo}>추가</button>
            </div>
            <div className="list large">
              {todos.map((item) => (
                <div className={item.done ? 'task done' : 'task'} key={item.id}>
                  <span className="drag">⋮⋮</span>
                  <input type="checkbox" checked={item.done}
                    onChange={() => setTodos((prev) => prev.map((x) => x.id === item.id ? {...x, done: !x.done} : x))}/>
                  <button className={item.important ? 'star active' : 'star'}
                    onClick={() => setTodos((prev) => prev.map((x) => x.id === item.id ? {...x, important: !x.important} : x))}>★</button>
                  <span className="taskTitle">{item.title}</span>
                  <button className="delete" onClick={() => setTodos((prev) => prev.filter((x) => x.id !== item.id))}>삭제</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'meals' && (
          <section className="week">{meals.map(([day, a, l, s, d]) => (
            <article className="dayCard" key={day}>
              <div className="day">{day}</div>
              <div className="dayBody">
                <MealField label="아침" value={a}/><MealField label="점심" value={l}/>
                <MealField label="간식" value={s}/><MealField label="저녁" value={d}/>
              </div>
            </article>
          ))}</section>
        )}

        {tab === 'stock' && (
          <section className="stockList">{stock.map((item) => {
            const low = Number(item.quantity) <= Number(item.threshold)
            return (
              <article className={low ? 'stockCard low' : 'stockCard'} key={item.id}>
                <div className="stockTop">
                  <div><h3>{item.name}</h3><p>{item.category}</p></div>
                  {low && <span className="badge coral">부족</span>}
                </div>
                <div className="stockFields">
                  <label>현재 수량<input type="number" value={item.quantity}
                    onChange={(e) => setStock((prev) => prev.map((x) => x.id === item.id ? {...x, quantity: Number(e.target.value)} : x))}/></label>
                  <label>부족 기준<input type="number" value={item.threshold}
                    onChange={(e) => setStock((prev) => prev.map((x) => x.id === item.id ? {...x, threshold: Number(e.target.value)} : x))}/></label>
                  <label>단위<input value={item.unit} readOnly/></label>
                </div>
              </article>
            )
          })}</section>
        )}

        {tab === 'need' && (
          <section className="pageCard">
            <div className="segmented two"><button className="active">Need</button><button>Purchased</button></div>
            <div className="addRow">
              <input value={needDraft} onChange={(e) => setNeedDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNeed()} placeholder="구매할 품목 추가"/>
              <button onClick={addNeed}>추가</button>
            </div>
            <div className="list large">{needs.map((item) => (
              <label className={item.done ? 'needRow done' : 'needRow'} key={item.id}>
                <input type="checkbox" checked={item.done}
                  onChange={() => setNeeds((prev) => prev.map((x) => x.id === item.id ? {...x, done: !x.done} : x))}/>
                <span>{item.name}</span>
                <button className="delete" onClick={(e) => {e.preventDefault(); setNeeds((prev) => prev.filter((x) => x.id !== item.id))}}>삭제</button>
              </label>
            ))}</div>
          </section>
        )}
      </main>

      <nav className="nav">
        <Nav label="Home" icon="⌂" active={tab === 'home'} onClick={() => setTab('home')}/>
        <Nav label="Meals" icon="◫" active={tab === 'meals'} onClick={() => setTab('meals')}/>
        <Nav label="Stock" icon="▣" active={tab === 'stock'} onClick={() => setTab('stock')}/>
        <Nav label="Need" icon="✓" active={tab === 'need'} onClick={() => setTab('need')}/>
      </nav>
    </div>
  )
}

function Card({ title, kicker, children, onClick }) {
  return <article className="card" onClick={onClick}>
    <div className="cardHead"><div><p className="kicker">{kicker}</p><h2>{title}</h2></div><span className="arrow">›</span></div>
    {children}
  </article>
}
function Mini({ label, value }) { return <div className="mini"><span>{label}</span><b>{value}</b></div> }
function MealField({ label, value }) { return <label className="mealField"><span>{label}</span><textarea defaultValue={value} placeholder="메뉴 입력" rows="2"/></label> }
function Nav({ label, icon, active, onClick }) { return <button className={active ? 'navButton active' : 'navButton'} onClick={onClick}><span className="navIcon">{icon}</span><span>{label}</span></button> }

function titleFor(tab) {
  return { home: '오늘도 가볍게.', todo: 'Todo', meals: 'Meals', stock: 'Stock', need: 'Need' }[tab]
}
function subtitleFor(tab) {
  return {
    home: '해야 할 일과 집안 흐름을 한곳에서 정리해요.',
    todo: '오늘과 다음을 가볍게 정리해요.',
    meals: '이번 주 식단을 한눈에.',
    stock: '부족 기준은 품목마다 다르게.',
    need: '사야 할 것만 간단히 모아둬요.',
  }[tab]
}

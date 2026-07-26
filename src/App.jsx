import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'with-me-v0.3'

const defaultState = {
  todos: [
    { id: 't1', title: '이유식 용기 정리', bucket: 'today', done: false, important: true },
    { id: 't2', title: '세탁기 돌리기', bucket: 'today', done: false, important: false },
    { id: 't3', title: '병원 서류 정리', bucket: 'next', done: false, important: false },
  ],
  templates: [
    { id: 'tpl1', title: '물포트 세척' },
    { id: 'tpl2', title: '아기 식판 소독' },
  ],
  meals: {
    월: { 아침: '순두부 계란찜', 점심: '닭안심 야채볶음', 간식: '바나나', 저녁: '소고기 덮밥' },
    화: { 아침: '', 점심: '', 간식: '', 저녁: '' },
    수: { 아침: '', 점심: '', 간식: '', 저녁: '' },
    목: { 아침: '', 점심: '', 간식: '', 저녁: '' },
    금: { 아침: '', 점심: '', 간식: '', 저녁: '' },
    토: { 아침: '', 점심: '', 간식: '', 저녁: '' },
    일: { 아침: '', 점심: '', 간식: '', 저녁: '' },
  },
  favorites: ['순두부 계란찜', '소고기 덮밥'],
  stock: [
    { id: 's1', name: '계란', category: '음식', quantity: 4, unit: '개', threshold: 6, expiryDate: '', alertDays: 3, autoNeed: true },
    { id: 's2', name: '물티슈', category: '육아', quantity: 1, unit: '팩', threshold: 2, expiryDate: '', alertDays: 7, autoNeed: true },
  ],
  needs: [
    { id: 'n1', name: '아기 치약', purchased: false, stockQuantity: 1, stockUnit: '개' },
  ],
}

const days = ['월', '화', '수', '목', '금', '토', '일']
const mealTypes = ['아침', '점심', '간식', '저녁']
const categories = ['음식', '육아', '생활', '화장품', '반려동물']

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : defaultState
  } catch {
    return defaultState
  }
}

export default function App() {
  const [data, setData] = useState(loadState)
  const [tab, setTab] = useState('home')
  const [todoMode, setTodoMode] = useState('today')
  const [mealMode, setMealMode] = useState('week')
  const [needMode, setNeedMode] = useState('need')
  const [hideDone, setHideDone] = useState(false)
  const [todoDraft, setTodoDraft] = useState('')
  const [templateDraft, setTemplateDraft] = useState('')
  const [favoriteDraft, setFavoriteDraft] = useState('')
  const [needDraft, setNeedDraft] = useState('')
  const [editingStock, setEditingStock] = useState(null)
  const [stockForm, setStockForm] = useState(blankStockForm())
  const [draggedTodoId, setDraggedTodoId] = useState(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    setData((prev) => {
      const activeNeedNames = new Set(
        prev.needs.filter((item) => !item.purchased).map((item) => item.name),
      )
      const toAdd = prev.stock.filter(
        (item) =>
          item.autoNeed &&
          Number(item.quantity) <= Number(item.threshold) &&
          !activeNeedNames.has(item.name),
      )
      if (!toAdd.length) return prev
      return {
        ...prev,
        needs: [
          ...prev.needs,
          ...toAdd.map((item) => ({
            id: crypto.randomUUID(),
            name: item.name,
            purchased: false,
            stockQuantity: 1,
            stockUnit: item.unit || '개',
          })),
        ],
      }
    })
  }, [data.stock])

  const lowStock = useMemo(
    () => data.stock.filter((item) => Number(item.quantity) <= Number(item.threshold)),
    [data.stock],
  )
  const expiringStock = useMemo(() => data.stock.filter(isExpiring), [data.stock])

  const updateData = (patch) => setData((prev) => ({ ...prev, ...patch }))

  const addTodo = () => {
    const title = todoDraft.trim()
    if (!title) return
    updateData({
      todos: [
        ...data.todos,
        {
          id: crypto.randomUUID(),
          title,
          bucket: todoMode === 'next' ? 'next' : 'today',
          done: false,
          important: false,
        },
      ],
    })
    setTodoDraft('')
  }

  const reorderTodos = (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) return
    const bucket = todoMode
    const bucketItems = data.todos.filter((item) => item.bucket === bucket)
    const sourceIndex = bucketItems.findIndex((item) => item.id === sourceId)
    const targetIndex = bucketItems.findIndex((item) => item.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const reordered = [...bucketItems]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    let bucketIndex = 0
    const merged = data.todos.map((item) =>
      item.bucket === bucket ? reordered[bucketIndex++] : item,
    )
    updateData({ todos: merged })
  }

  const saveStock = () => {
    const name = stockForm.name.trim()
    if (!name) return
    const normalized = {
      ...stockForm,
      name,
      quantity: Number(stockForm.quantity || 0),
      threshold: Number(stockForm.threshold || 0),
      alertDays: Number(stockForm.alertDays || 0),
    }

    if (editingStock) {
      updateData({
        stock: data.stock.map((item) =>
          item.id === editingStock ? { ...normalized, id: editingStock } : item,
        ),
      })
    } else {
      updateData({ stock: [...data.stock, { ...normalized, id: crypto.randomUUID() }] })
    }
    setEditingStock(null)
    setStockForm(blankStockForm())
  }

  const addNeed = () => {
    const name = needDraft.trim()
    if (!name) return
    updateData({
      needs: [
        ...data.needs,
        {
          id: crypto.randomUUID(),
          name,
          purchased: false,
          stockQuantity: 1,
          stockUnit: '개',
        },
      ],
    })
    setNeedDraft('')
  }

  const markPurchased = (item, reflectStock) => {
    const addQuantity = Math.max(0, Number(item.stockQuantity || 0))
    let nextStock = data.stock

    if (reflectStock && addQuantity > 0) {
      const existing = data.stock.find((stockItem) => stockItem.name === item.name)
      nextStock = existing
        ? data.stock.map((stockItem) =>
            stockItem.id === existing.id
              ? { ...stockItem, quantity: Number(stockItem.quantity) + addQuantity }
              : stockItem,
          )
        : [
            ...data.stock,
            {
              id: crypto.randomUUID(),
              name: item.name,
              category: '생활',
              quantity: addQuantity,
              unit: item.stockUnit || '개',
              threshold: 0,
              expiryDate: '',
              alertDays: 3,
              autoNeed: false,
            },
          ]
    }

    setData((prev) => ({
      ...prev,
      stock: nextStock,
      needs: prev.needs.map((need) =>
        need.id === item.id ? { ...need, purchased: true } : need,
      ),
    }))
  }

  const todayTodos = data.todos.filter((item) => item.bucket === 'today')
  const todayPreview = todayTodos.filter((item) => !item.done).slice(0, 4)
  const todayMeals = data.meals.월

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
              {todayPreview.length ? (
                <div className="list">
                  {todayPreview.map((item) => (
                    <div className="row" key={item.id}>
                      <span className="dot" />
                      <span>{item.title}</span>
                      {item.important && <b className="badge yellow">중요</b>}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title="오늘은 무엇을 할까요?" text="첫 번째 할 일을 추가해보세요." />
              )}
            </Card>

            <Card title="Meals" kicker="TODAY" onClick={() => setTab('meals')}>
              <div className="mealGrid">
                {mealTypes.map((type) => (
                  <Mini key={type} label={type} value={todayMeals[type]} />
                ))}
              </div>
            </Card>

            {(lowStock.length > 0 || expiringStock.length > 0) && (
              <Card title="Stock" kicker="ALERT" onClick={() => setTab('stock')}>
                <div className="chips">
                  {lowStock.map((item) => (
                    <span className="chip alert" key={`low-${item.id}`}>
                      {item.name} 부족 · {item.quantity}{item.unit}
                    </span>
                  ))}
                  {expiringStock.map((item) => (
                    <span className="chip expiry" key={`exp-${item.id}`}>
                      {item.name} 유통기한 임박
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {data.needs.some((item) => !item.purchased) && (
              <Card title="Need" kicker="TO BUY" onClick={() => setTab('need')}>
                <div className="chips">
                  {data.needs
                    .filter((item) => !item.purchased)
                    .slice(0, 6)
                    .map((item) => (
                      <span className="chip" key={item.id}>{item.name}</span>
                    ))}
                </div>
              </Card>
            )}
          </section>
        )}

        {tab === 'todo' && (
          <section className="pageCard">
            <div className="segmented">
              {['today', 'next', 'library'].map((mode) => (
                <button
                  key={mode}
                  className={todoMode === mode ? 'active' : ''}
                  onClick={() => setTodoMode(mode)}
                >
                  {mode === 'today' ? 'Today' : mode === 'next' ? 'Next' : 'Library'}
                </button>
              ))}
            </div>

            {todoMode !== 'library' && (
              <>
                <div className="toolbar">
                  <span className="dragHelp">⋮⋮ 손잡이를 끌어 순서 변경</span>
                  <label className="switchLabel">
                    <input
                      type="checkbox"
                      checked={hideDone}
                      onChange={(e) => setHideDone(e.target.checked)}
                    />
                    완료 숨기기
                  </label>
                </div>

                <div className="addRow">
                  <input
                    value={todoDraft}
                    onChange={(e) => setTodoDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                    placeholder="할 일 추가"
                  />
                  <button onClick={addTodo}>추가</button>
                </div>

                <div className="list large">
                  {data.todos
                    .filter((item) => item.bucket === todoMode)
                    .filter((item) => !(hideDone && item.done))
                    .map((item) => (
                      <div
                        className={`${item.done ? 'task done' : 'task'} ${draggedTodoId === item.id ? 'dragging' : ''}`}
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedTodoId(item.id)
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', item.id)
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          const sourceId = e.dataTransfer.getData('text/plain') || draggedTodoId
                          reorderTodos(sourceId, item.id)
                          setDraggedTodoId(null)
                        }}
                        onDragEnd={() => setDraggedTodoId(null)}
                      >
                        <span className="dragHandle" title="끌어서 순서 변경">⋮⋮</span>
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() =>
                            updateData({
                              todos: data.todos.map((todo) =>
                                todo.id === item.id ? { ...todo, done: !todo.done } : todo,
                              ),
                            })
                          }
                        />
                        <button
                          className={item.important ? 'star active' : 'star'}
                          onClick={() =>
                            updateData({
                              todos: data.todos.map((todo) =>
                                todo.id === item.id
                                  ? { ...todo, important: !todo.important }
                                  : todo,
                              ),
                            })
                          }
                        >
                          ★
                        </button>
                        <span className="taskTitle">{item.title}</span>
                        <button
                          className="smallButton"
                          onClick={() =>
                            updateData({
                              todos: data.todos.map((todo) =>
                                todo.id === item.id
                                  ? {
                                      ...todo,
                                      bucket: todo.bucket === 'today' ? 'next' : 'today',
                                    }
                                  : todo,
                              ),
                            })
                          }
                        >
                          {item.bucket === 'today' ? '미루기' : '오늘로'}
                        </button>
                        <button
                          className="delete"
                          onClick={() =>
                            updateData({
                              todos: data.todos.filter((todo) => todo.id !== item.id),
                            })
                          }
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                </div>
              </>
            )}

            {todoMode === 'library' && (
              <>
                <div className="addRow">
                  <input
                    value={templateDraft}
                    onChange={(e) => setTemplateDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && templateDraft.trim()) {
                        updateData({
                          templates: [
                            ...data.templates,
                            { id: crypto.randomUUID(), title: templateDraft.trim() },
                          ],
                        })
                        setTemplateDraft('')
                      }
                    }}
                    placeholder="반복 템플릿 추가"
                  />
                  <button
                    onClick={() => {
                      if (!templateDraft.trim()) return
                      updateData({
                        templates: [
                          ...data.templates,
                          { id: crypto.randomUUID(), title: templateDraft.trim() },
                        ],
                      })
                      setTemplateDraft('')
                    }}
                  >
                    추가
                  </button>
                </div>

                <div className="list large">
                  {data.templates.map((template) => (
                    <div className="templateRow" key={template.id}>
                      <span>{template.title}</span>
                      <button
                        onClick={() =>
                          updateData({
                            todos: [
                              ...data.todos,
                              {
                                id: crypto.randomUUID(),
                                title: template.title,
                                bucket: 'today',
                                done: false,
                                important: false,
                              },
                            ],
                          })
                        }
                      >
                        오늘에 추가
                      </button>
                      <button
                        className="delete"
                        onClick={() =>
                          updateData({
                            templates: data.templates.filter(
                              (item) => item.id !== template.id,
                            ),
                          })
                        }
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {tab === 'meals' && (
          <section>
            <div className="pageCard compact">
              <div className="segmented two">
                <button className={mealMode === 'week' ? 'active' : ''} onClick={() => setMealMode('week')}>Week</button>
                <button className={mealMode === 'favorites' ? 'active' : ''} onClick={() => setMealMode('favorites')}>Favorites</button>
              </div>
            </div>

            {mealMode === 'week' && (
              <section className="week">
                {days.map((day) => (
                  <article className="dayCard" key={day}>
                    <div className="day">{day}</div>
                    <div className="dayBody">
                      {mealTypes.map((type) => (
                        <MealField
                          key={type}
                          label={type}
                          value={data.meals[day][type]}
                          favorites={data.favorites}
                          onChange={(value) =>
                            updateData({
                              meals: {
                                ...data.meals,
                                [day]: { ...data.meals[day], [type]: value },
                              },
                            })
                          }
                        />
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            )}

            {mealMode === 'favorites' && (
              <section className="pageCard">
                <div className="addRow">
                  <input
                    value={favoriteDraft}
                    onChange={(e) => setFavoriteDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && favoriteDraft.trim()) {
                        updateData({ favorites: [...data.favorites, favoriteDraft.trim()] })
                        setFavoriteDraft('')
                      }
                    }}
                    placeholder="자주 먹는 메뉴 추가"
                  />
                  <button
                    onClick={() => {
                      if (!favoriteDraft.trim()) return
                      updateData({ favorites: [...data.favorites, favoriteDraft.trim()] })
                      setFavoriteDraft('')
                    }}
                  >
                    추가
                  </button>
                </div>
                <div className="favoriteList">
                  {data.favorites.map((item) => (
                    <div className="favoriteRow" key={item}>
                      <span>{item}</span>
                      <button
                        className="delete"
                        onClick={() =>
                          updateData({
                            favorites: data.favorites.filter(
                              (favorite) => favorite !== item,
                            ),
                          })
                        }
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </section>
        )}

        {tab === 'stock' && (
          <section>
            <section className="pageCard stockForm">
              <h2>{editingStock ? '재고 수정' : '재고 추가'}</h2>
              <div className="formGrid">
                <Field label="품목명">
                  <input value={stockForm.name} onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })} />
                </Field>
                <Field label="카테고리">
                  <select value={stockForm.category} onChange={(e) => setStockForm({ ...stockForm, category: e.target.value })}>
                    {categories.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </Field>
                <Field label="현재 수량">
                  <input type="number" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} />
                </Field>
                <Field label="단위">
                  <input value={stockForm.unit} onChange={(e) => setStockForm({ ...stockForm, unit: e.target.value })} />
                </Field>
                <Field label="부족 기준">
                  <input type="number" value={stockForm.threshold} onChange={(e) => setStockForm({ ...stockForm, threshold: e.target.value })} />
                </Field>
                <Field label="유통기한">
                  <input type="date" value={stockForm.expiryDate} onChange={(e) => setStockForm({ ...stockForm, expiryDate: e.target.value })} />
                </Field>
                <Field label="며칠 전 알림">
                  <input type="number" value={stockForm.alertDays} onChange={(e) => setStockForm({ ...stockForm, alertDays: e.target.value })} />
                </Field>
                <label className="checkField">
                  <input type="checkbox" checked={stockForm.autoNeed} onChange={(e) => setStockForm({ ...stockForm, autoNeed: e.target.checked })} />
                  부족하면 Need에 자동 추가
                </label>
              </div>
              <div className="formActions">
                {editingStock && (
                  <button className="secondary" onClick={() => { setEditingStock(null); setStockForm(blankStockForm()) }}>
                    취소
                  </button>
                )}
                <button onClick={saveStock}>{editingStock ? '수정 저장' : '재고 추가'}</button>
              </div>
            </section>

            <section className="stockList">
              {data.stock.map((item) => {
                const low = Number(item.quantity) <= Number(item.threshold)
                const expiring = isExpiring(item)
                return (
                  <article className={low || expiring ? 'stockCard warning' : 'stockCard'} key={item.id}>
                    <div className="stockTop">
                      <div><h3>{item.name}</h3><p>{item.category}</p></div>
                      <div className="badgeGroup">
                        {low && <span className="badge coral">부족</span>}
                        {expiring && <span className="badge purple">기한 임박</span>}
                      </div>
                    </div>
                    <div className="stockSummary">
                      <b>{item.quantity}{item.unit}</b>
                      <span>부족 기준 {item.threshold}{item.unit}</span>
                      <span>{item.expiryDate ? `유통기한 ${item.expiryDate}` : '유통기한 미설정'}</span>
                    </div>
                    <div className="cardActions">
                      <button onClick={() => { setEditingStock(item.id); setStockForm({ ...item }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>수정</button>
                      <button className="delete" onClick={() => updateData({ stock: data.stock.filter((stockItem) => stockItem.id !== item.id) })}>삭제</button>
                    </div>
                  </article>
                )
              })}
            </section>
          </section>
        )}

        {tab === 'need' && (
          <section className="pageCard">
            <div className="segmented two">
              <button className={needMode === 'need' ? 'active' : ''} onClick={() => setNeedMode('need')}>Need</button>
              <button className={needMode === 'purchased' ? 'active' : ''} onClick={() => setNeedMode('purchased')}>Purchased</button>
            </div>

            {needMode === 'need' && (
              <div className="addRow">
                <input
                  value={needDraft}
                  onChange={(e) => setNeedDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addNeed()}
                  placeholder="구매할 품목 추가"
                />
                <button onClick={addNeed}>추가</button>
              </div>
            )}

            <div className="list large">
              {data.needs
                .filter((item) => item.purchased === (needMode === 'purchased'))
                .map((item) => (
                  <div className="needCard" key={item.id}>
                    <div className="needInfo">
                      <strong>{item.name}</strong>
                      {needMode === 'need' && (
                        <div className="quantityEditor">
                          <label>
                            재고에 더할 개수
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.stockQuantity}
                              onChange={(e) =>
                                updateData({
                                  needs: data.needs.map((need) =>
                                    need.id === item.id
                                      ? { ...need, stockQuantity: e.target.value }
                                      : need,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label>
                            단위
                            <input
                              value={item.stockUnit}
                              onChange={(e) =>
                                updateData({
                                  needs: data.needs.map((need) =>
                                    need.id === item.id
                                      ? { ...need, stockUnit: e.target.value }
                                      : need,
                                  ),
                                })
                              }
                            />
                          </label>
                        </div>
                      )}
                      {needMode === 'purchased' && (
                        <p>{item.stockQuantity || 0}{item.stockUnit || '개'}</p>
                      )}
                    </div>

                    {needMode === 'need' ? (
                      <div className="needActions">
                        <button onClick={() => markPurchased(item, false)}>구매 완료</button>
                        <button className="secondary" onClick={() => markPurchased(item, true)}>
                          완료 + {item.stockQuantity || 0}{item.stockUnit || '개'} 재고 반영
                        </button>
                        <button className="delete" onClick={() => updateData({ needs: data.needs.filter((need) => need.id !== item.id) })}>삭제</button>
                      </div>
                    ) : (
                      <div className="needActions">
                        <button onClick={() => updateData({ needs: data.needs.map((need) => need.id === item.id ? { ...need, purchased: false } : need) })}>
                          Need로 되돌리기
                        </button>
                        <button className="delete" onClick={() => updateData({ needs: data.needs.filter((need) => need.id !== item.id) })}>삭제</button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}
      </main>

      <nav className="nav">
        <Nav label="Home" icon="⌂" active={tab === 'home'} onClick={() => setTab('home')} />
        <Nav label="Meals" icon="◫" active={tab === 'meals'} onClick={() => setTab('meals')} />
        <Nav label="Stock" icon="▣" active={tab === 'stock'} onClick={() => setTab('stock')} />
        <Nav label="Need" icon="✓" active={tab === 'need'} onClick={() => setTab('need')} />
      </nav>
    </div>
  )
}

function blankStockForm() {
  return { name: '', category: '음식', quantity: 1, unit: '개', threshold: 0, expiryDate: '', alertDays: 3, autoNeed: false }
}
function isExpiring(item) {
  if (!item.expiryDate) return false
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const expiry = new Date(`${item.expiryDate}T00:00:00`)
  return Math.ceil((expiry - now) / 86400000) <= Number(item.alertDays || 0)
}
function Card({ title, kicker, children, onClick }) {
  return <article className="card" onClick={onClick}>
    <div className="cardHead"><div><p className="kicker">{kicker}</p><h2>{title}</h2></div><span className="arrow">›</span></div>
    {children}
  </article>
}
function Empty({ title, text }) { return <div className="empty"><strong>{title}</strong><span>{text}</span></div> }
function Mini({ label, value }) { return <div className="mini"><span>{label}</span><b>{value || '—'}</b></div> }
function MealField({ label, value, favorites, onChange }) {
  return <label className="mealField">
    <span>{label}</span>
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder="메뉴 입력" rows="2" />
    <select value="" onChange={(e) => e.target.value && onChange(e.target.value)}>
      <option value="">Favorites에서 선택</option>
      {favorites.map((favorite) => <option key={favorite} value={favorite}>{favorite}</option>)}
    </select>
  </label>
}
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
function Nav({ label, icon, active, onClick }) {
  return <button className={active ? 'navButton active' : 'navButton'} onClick={onClick}>
    <span className="navIcon">{icon}</span><span>{label}</span>
  </button>
}
function titleFor(tab) {
  return { home: '오늘도 가볍게.', todo: 'Todo', meals: 'Meals', stock: 'Stock', need: 'Need' }[tab]
}
function subtitleFor(tab) {
  return {
    home: '해야 할 일과 집안 흐름을 한곳에서 정리해요.',
    todo: '오늘과 다음을 가볍게 정리해요.',
    meals: '이번 주 식단을 한눈에.',
    stock: '부족 기준과 유통기한을 함께 관리해요.',
    need: '사야 할 것과 구매 완료를 나눠봐요.',
  }[tab]
}

import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'with-me-data'
const days = ['월', '화', '수', '목', '금', '토', '일']
const mealTypes = ['아침', '간식 A', '점심', '간식 B', '저녁']
const defaultCategories = ['음식', '육아', '생활', '화장품', '반려동물']
const reactionOptions = [
  { value: 'love', label: '아주 잘 먹음', icon: '😍' },
  { value: 'good', label: '잘 먹음', icon: '🙂' },
  { value: 'okay', label: '보통', icon: '😐' },
  { value: 'bad', label: '잘 안 먹음', icon: '🙁' },
  { value: 'refuse', label: '거부', icon: '😣' },
]

const defaultState = {
  todos: [
    { id: 't1', title: '이유식 용기 정리', bucket: 'today', done: false, important: true },
    { id: 't2', title: '세탁기 돌리기', bucket: 'today', done: false, important: false },
    { id: 't3', title: '병원 서류 정리', bucket: 'next', done: false, important: false },
  ],
  routineGroups: [
    {
      id: 'rg1',
      name: '아침 루틴',
      items: [
        { id: 'ri1', title: '물포트 세척' },
        { id: 'ri2', title: '아기 식판 준비' },
      ],
    },
  ],
  meals: Object.fromEntries(days.map((day) => [day, Object.fromEntries(mealTypes.map((type) => [type, '']))])),
  favorites: ['순두부 계란찜', '소고기 덮밥'],
  menuReviews: [
    { id: 'mr1', menu: '순두부 계란찜', reaction: 'love', note: '부드러워서 잘 먹음' },
  ],
  stockCategories: defaultCategories,
  stock: [
    { id: 's1', name: '계란', category: '음식', quantity: 4, unit: '개', threshold: 6, expiryDate: '', alertDays: 3, autoNeed: true },
    { id: 's2', name: '물티슈', category: '육아', quantity: 1, unit: '팩', threshold: 2, expiryDate: '', alertDays: 7, autoNeed: true },
  ],
  needs: [
    { id: 'n1', name: '아기 치약', purchased: false, stockQuantity: 1, stockUnit: '개', sortOrder: 1 },
  ],
}

defaultState.meals.월 = {
  아침: '순두부 계란찜',
  점심: '닭안심 야채볶음',
  '간식 A': '바나나',
  '간식 B': '',
  저녁: '소고기 덮밥',
}

function loadState() {
  try {
    const legacyKeys = [
      STORAGE_KEY,
      'with-me-v0.0.6',
      'with-me-v0.0.5',
      'with-me-v0.4',
      'with-me-v0.3',
      'with-me-v0.2',
    ]
    const saved = legacyKeys
      .map((key) => localStorage.getItem(key))
      .find(Boolean)

    if (!saved) return defaultState

    const parsed = JSON.parse(saved)
    return {
      ...defaultState,
      ...parsed,
      stockCategories:
        parsed.stockCategories?.length
          ? parsed.stockCategories
          : Array.from(
              new Set([
                ...defaultCategories,
                ...(parsed.stock || []).map((item) => item.category).filter(Boolean),
              ]),
            ),
    }
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
  const [draggedTodoId, setDraggedTodoId] = useState(null)
  const [draggedNeedId, setDraggedNeedId] = useState(null)
  const [routineNameDraft, setRoutineNameDraft] = useState('')
  const [routineItemDrafts, setRoutineItemDrafts] = useState({})
  const [favoriteDraft, setFavoriteDraft] = useState('')
  const [reviewDraft, setReviewDraft] = useState({ menu: '', reaction: 'good', note: '' })
  const [pasteText, setPasteText] = useState('')
  const [pasteMessage, setPasteMessage] = useState('')
  const [needDraft, setNeedDraft] = useState('')
  const [editingStock, setEditingStock] = useState(null)
  const [stockForm, setStockForm] = useState(blankStockForm())
  const [categoryDraft, setCategoryDraft] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    setData((prev) => {
      const activeNames = new Set(prev.needs.filter((x) => !x.purchased).map((x) => x.name))
      const additions = prev.stock
        .filter((item) => item.autoNeed && Number(item.quantity) <= Number(item.threshold) && !activeNames.has(item.name))
        .map((item, index) => ({
          id: crypto.randomUUID(),
          name: item.name,
          purchased: false,
          stockQuantity: 1,
          stockUnit: item.unit || '개',
          sortOrder: Date.now() + index,
        }))

      return additions.length ? { ...prev, needs: [...prev.needs, ...additions] } : prev
    })
  }, [data.stock])

  const updateData = (patch) => setData((prev) => ({ ...prev, ...patch }))

  const lowStock = useMemo(
    () => data.stock.filter((item) => Number(item.quantity) <= Number(item.threshold)),
    [data.stock],
  )

  const expiringStock = useMemo(() => data.stock.filter(isExpiring), [data.stock])
  const todayTodos = data.todos.filter((item) => item.bucket === 'today')
  const todayPreview = todayTodos.slice(0, 3)
  const todayMeals = data.meals.월

  const addTodo = () => {
    const title = todoDraft.trim()
    if (!title) return
    updateData({
      todos: [
        ...data.todos,
        { id: crypto.randomUUID(), title, bucket: todoMode === 'next' ? 'next' : 'today', done: false, important: false },
      ],
    })
    setTodoDraft('')
  }

  const reorderTodos = (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) return
    const current = data.todos.filter((item) => item.bucket === todoMode)
    const sourceIndex = current.findIndex((item) => item.id === sourceId)
    const targetIndex = current.findIndex((item) => item.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    const reordered = [...current]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    let index = 0
    updateData({
      todos: data.todos.map((item) => item.bucket === todoMode ? reordered[index++] : item),
    })
  }

  const addRoutineGroup = () => {
    const name = routineNameDraft.trim()
    if (!name) return
    updateData({
      routineGroups: [...data.routineGroups, { id: crypto.randomUUID(), name, items: [] }],
    })
    setRoutineNameDraft('')
  }

  const addRoutineItem = (groupId) => {
    const title = (routineItemDrafts[groupId] || '').trim()
    if (!title) return
    updateData({
      routineGroups: data.routineGroups.map((group) =>
        group.id === groupId
          ? { ...group, items: [...group.items, { id: crypto.randomUUID(), title }] }
          : group,
      ),
    })
    setRoutineItemDrafts((prev) => ({ ...prev, [groupId]: '' }))
  }

  const addRoutineToToday = (group, onlyItem = null) => {
    const source = onlyItem ? [onlyItem] : group.items
    if (!source.length) return
    updateData({
      todos: [
        ...data.todos,
        ...source.map((item) => ({
          id: crypto.randomUUID(),
          title: item.title,
          bucket: 'today',
          done: false,
          important: false,
        })),
      ],
    })
  }

  const applyPastedMealTable = () => {
    const lines = pasteText
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split('\t').map((cell) => cell.trim()))

    if (!lines.length || !lines[0].length) {
      setPasteMessage('붙여넣은 표를 읽지 못했어요.')
      return
    }

    let rows = lines
    const firstCell = (rows[0][0] || '').replace(/\s/g, '')
    if (firstCell === '' || /요일|구분|식단/.test(firstCell)) rows = rows.slice(1)

    const nextMeals = structuredClone(data.meals)
    let applied = 0

    rows.slice(0, 5).forEach((row, rowIndex) => {
      const type = mealTypes[rowIndex]
      if (!type) return

      const values = row.length >= 8 ? row.slice(1, 8) : row.slice(0, 7)
      values.forEach((value, dayIndex) => {
        if (days[dayIndex] && value !== undefined) {
          nextMeals[days[dayIndex]][type] = value
          applied += 1
        }
      })
    })

    updateData({ meals: nextMeals })
    setPasteMessage(applied ? '표를 식단에 반영했어요.' : '5행 × 7열 형태의 표가 필요해요.')
  }

  const addStockCategory = () => {
    const name = categoryDraft.trim()
    if (!name || data.stockCategories.includes(name)) return
    updateData({ stockCategories: [...data.stockCategories, name] })
    setCategoryDraft('')
  }

  const renameStockCategory = (oldName, newName) => {
    const name = newName.trim()
    if (!name || name === oldName || data.stockCategories.includes(name)) return
    updateData({
      stockCategories: data.stockCategories.map((category) =>
        category === oldName ? name : category,
      ),
      stock: data.stock.map((item) =>
        item.category === oldName ? { ...item, category: name } : item,
      ),
    })
    if (stockForm.category === oldName) {
      setStockForm((prev) => ({ ...prev, category: name }))
    }
  }

  const deleteStockCategory = (category) => {
    const fallback = '미분류'
    const hasItems = data.stock.some((item) => item.category === category)
    const nextCategories = data.stockCategories.filter((item) => item !== category)

    if (hasItems && !nextCategories.includes(fallback)) {
      nextCategories.push(fallback)
    }

    updateData({
      stockCategories: nextCategories,
      stock: hasItems
        ? data.stock.map((item) =>
            item.category === category ? { ...item, category: fallback } : item,
          )
        : data.stock,
    })

    if (stockForm.category === category) {
      setStockForm((prev) => ({
        ...prev,
        category: nextCategories[0] || fallback,
      }))
    }
  }

  const moveStockCategory = (category, direction) => {
    const index = data.stockCategories.indexOf(category)
    const target = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || target < 0 || target >= data.stockCategories.length) return
    const reordered = [...data.stockCategories]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    updateData({ stockCategories: reordered })
  }

  const saveStock = () => {
    const name = stockForm.name.trim()
    if (!name) return
    const item = {
      ...stockForm,
      name,
      quantity: Number(stockForm.quantity || 0),
      threshold: Number(stockForm.threshold || 0),
      alertDays: Number(stockForm.alertDays || 0),
    }
    updateData({
      stock: editingStock
        ? data.stock.map((x) => x.id === editingStock ? { ...item, id: editingStock } : x)
        : [...data.stock, { ...item, id: crypto.randomUUID() }],
    })
    setEditingStock(null)
    setStockForm(blankStockForm())
  }

  const addNeed = () => {
    const name = needDraft.trim()
    if (!name) return
    updateData({
      needs: [
        ...data.needs,
        { id: crypto.randomUUID(), name, purchased: false, stockQuantity: 1, stockUnit: '개', sortOrder: Date.now() },
      ],
    })
    setNeedDraft('')
  }

  const reorderNeeds = (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) return
    const visible = data.needs.filter((item) => item.purchased === (needMode === 'purchased'))
    const sourceIndex = visible.findIndex((item) => item.id === sourceId)
    const targetIndex = visible.findIndex((item) => item.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    const reordered = [...visible]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    let index = 0
    updateData({
      needs: data.needs.map((item) =>
        item.purchased === (needMode === 'purchased') ? reordered[index++] : item,
      ),
    })
  }

  const markPurchased = (item, reflectStock) => {
    const quantity = Math.max(0, Number(item.stockQuantity || 0))
    let nextStock = data.stock
    if (reflectStock && quantity > 0) {
      const existing = data.stock.find((stockItem) => stockItem.name === item.name)
      nextStock = existing
        ? data.stock.map((stockItem) =>
            stockItem.id === existing.id
              ? { ...stockItem, quantity: Number(stockItem.quantity) + quantity }
              : stockItem,
          )
        : [
            ...data.stock,
            {
              id: crypto.randomUUID(),
              name: item.name,
              category: '생활',
              quantity,
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
      needs: prev.needs.map((need) => need.id === item.id ? { ...need, purchased: true } : need),
    }))
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
              {todayPreview.length ? (
                <div className="list">
                  {todayPreview.map((item) => (
                    <label
                      className={item.done ? 'row homeTodoRow done' : 'row homeTodoRow'}
                      key={item.id}
                      onClick={(e) => e.stopPropagation()}
                    >
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
                      <span>{item.title}</span>
                      {item.important && <b className="badge yellow">중요</b>}
                    </label>
                  ))}
                </div>
              ) : <Empty title="오늘은 무엇을 할까요?" text="첫 번째 할 일을 추가해보세요." />}
            </Card>

            <Card title="Meals" kicker="TODAY" onClick={() => setTab('meals')}>
              <div className="mealGrid">
                {mealTypes.map((type) => <Mini key={type} label={type} value={todayMeals[type]} />)}
              </div>
            </Card>

            {(lowStock.length > 0 || expiringStock.length > 0) && (
              <Card title="Stock" kicker="ALERT" onClick={() => setTab('stock')}>
                <div className="chips">
                  {lowStock.map((item) => (
                    <span className="chip alert" key={`low-${item.id}`}>{item.name}</span>
                  ))}
                  {expiringStock
                    .filter((item) => !lowStock.some((low) => low.id === item.id))
                    .map((item) => (
                      <span className="chip expiry" key={`exp-${item.id}`}>{item.name}</span>
                    ))}
                </div>
              </Card>
            )}

            {data.needs.some((item) => !item.purchased) && (
              <Card title="Need" kicker="TO BUY" onClick={() => setTab('need')}>
                <div className="chips">
                  {data.needs.filter((item) => !item.purchased).slice(0, 6).map((item) => (
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
              {[
                ['today', 'Today'],
                ['next', 'Next'],
                ['library', 'Library'],
              ].map(([mode, label]) => (
                <button key={mode} className={todoMode === mode ? 'active' : ''} onClick={() => setTodoMode(mode)}>
                  {label}
                </button>
              ))}
            </div>

            {todoMode !== 'library' ? (
              <>
                <div className="toolbar">
                  <span className="dragHelp">⋮⋮ 끌어서 순서 변경</span>
                  <label className="switchLabel">
                    <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
                    완료 숨기기
                  </label>
                </div>
                <div className="addRow">
                  <input value={todoDraft} onChange={(e) => setTodoDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTodo()} placeholder="할 일 추가" />
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
                          e.dataTransfer.setData('text/plain', item.id)
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          reorderTodos(e.dataTransfer.getData('text/plain') || draggedTodoId, item.id)
                          setDraggedTodoId(null)
                        }}
                        onDragEnd={() => setDraggedTodoId(null)}
                      >
                        <span className="dragHandle">⋮⋮</span>
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => updateData({
                            todos: data.todos.map((todo) => todo.id === item.id ? { ...todo, done: !todo.done } : todo),
                          })}
                        />
                        <button
                          className={item.important ? 'star active' : 'star'}
                          onClick={() => updateData({
                            todos: data.todos.map((todo) => todo.id === item.id ? { ...todo, important: !todo.important } : todo),
                          })}
                        >★</button>
                        <span className="taskTitle">{item.title}</span>
                        <button
                          className="smallButton"
                          onClick={() => updateData({
                            todos: data.todos.map((todo) =>
                              todo.id === item.id
                                ? { ...todo, bucket: todo.bucket === 'today' ? 'next' : 'today' }
                                : todo,
                            ),
                          })}
                        >
                          {item.bucket === 'today' ? '미루기' : '오늘로'}
                        </button>
                        <button className="delete" onClick={() => updateData({ todos: data.todos.filter((todo) => todo.id !== item.id) })}>삭제</button>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <section className="routineLibrary">
                <div className="addRow">
                  <input value={routineNameDraft} onChange={(e) => setRoutineNameDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRoutineGroup()} placeholder="새 루틴 그룹 이름" />
                  <button onClick={addRoutineGroup}>그룹 추가</button>
                </div>

                <div className="routineGroups">
                  {data.routineGroups.map((group) => (
                    <article className="routineCard" key={group.id}>
                      <div className="routineHead">
                        <input
                          className="routineName"
                          value={group.name}
                          onChange={(e) => updateData({
                            routineGroups: data.routineGroups.map((x) => x.id === group.id ? { ...x, name: e.target.value } : x),
                          })}
                        />
                        <div className="routineHeadActions">
                          <button onClick={() => addRoutineToToday(group)}>전체 추가</button>
                          <button className="delete" onClick={() => updateData({ routineGroups: data.routineGroups.filter((x) => x.id !== group.id) })}>삭제</button>
                        </div>
                      </div>

                      <div className="routineItems">
                        {group.items.map((item) => (
                          <div className="routineItem" key={item.id}>
                            <input
                              value={item.title}
                              onChange={(e) => updateData({
                                routineGroups: data.routineGroups.map((x) =>
                                  x.id === group.id
                                    ? { ...x, items: x.items.map((i) => i.id === item.id ? { ...i, title: e.target.value } : i) }
                                    : x,
                                ),
                              })}
                            />
                            <button onClick={() => addRoutineToToday(group, item)}>추가</button>
                            <button className="delete" onClick={() => updateData({
                              routineGroups: data.routineGroups.map((x) =>
                                x.id === group.id ? { ...x, items: x.items.filter((i) => i.id !== item.id) } : x,
                              ),
                            })}>삭제</button>
                          </div>
                        ))}
                      </div>

                      <div className="inlineAdd">
                        <input
                          value={routineItemDrafts[group.id] || ''}
                          onChange={(e) => setRoutineItemDrafts((prev) => ({ ...prev, [group.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && addRoutineItem(group.id)}
                          placeholder="루틴 항목 추가"
                        />
                        <button onClick={() => addRoutineItem(group.id)}>추가</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>
        )}

        {tab === 'meals' && (
          <section>
            <div className="pageCard compact">
              <div className="segmented three">
                {[
                  ['week', 'Week'],
                  ['favorites', 'Favorites'],
                  ['reviews', '메뉴 후기'],
                ].map(([mode, label]) => (
                  <button key={mode} className={mealMode === mode ? 'active' : ''} onClick={() => setMealMode(mode)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {mealMode === 'week' && (
              <>
                <section className="pageCard pasteCard">
                  <h3>표 붙여넣기</h3>
                  <p>구글 독스·시트에서 5행 × 7열 표를 복사해 붙여넣으세요. 행 순서는 아침, 간식 A, 점심, 간식 B, 저녁입니다.</p>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={'아침메뉴\t아침메뉴\t...\n점심메뉴\t점심메뉴\t...'}
                    rows="5"
                  />
                  <div className="pasteActions">
                    <span>{pasteMessage}</span>
                    <button onClick={applyPastedMealTable}>식단에 반영</button>
                  </div>
                </section>

                <section className="weeklyTableWrap">
                  <table className="weeklyTable">
                    <thead>
                      <tr>
                        <th>구분</th>
                        {days.map((day) => <th key={day}>{day}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {mealTypes.map((type) => (
                        <tr key={type}>
                          <th>{type}</th>
                          {days.map((day) => (
                            <td key={`${day}-${type}`}>
                              <textarea
                                value={data.meals[day][type]}
                                onChange={(e) => updateData({
                                  meals: {
                                    ...data.meals,
                                    [day]: { ...data.meals[day], [type]: e.target.value },
                                  },
                                })}
                                placeholder="메뉴"
                                rows="3"
                              />
                              <select value="" onChange={(e) => e.target.value && updateData({
                                meals: {
                                  ...data.meals,
                                  [day]: { ...data.meals[day], [type]: e.target.value },
                                },
                              })}>
                                <option value="">Fav</option>
                                {data.favorites.map((favorite) => <option key={favorite} value={favorite}>{favorite}</option>)}
                              </select>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </>
            )}

            {mealMode === 'favorites' && (
              <section className="pageCard">
                <div className="addRow">
                  <input value={favoriteDraft} onChange={(e) => setFavoriteDraft(e.target.value)} placeholder="자주 먹는 메뉴 추가" />
                  <button onClick={() => {
                    if (!favoriteDraft.trim()) return
                    updateData({ favorites: [...data.favorites, favoriteDraft.trim()] })
                    setFavoriteDraft('')
                  }}>추가</button>
                </div>
                <div className="favoriteList">
                  {data.favorites.map((item) => (
                    <div className="favoriteRow" key={item}>
                      <span>{item}</span>
                      <button className="delete" onClick={() => updateData({ favorites: data.favorites.filter((x) => x !== item) })}>삭제</button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {mealMode === 'reviews' && (
              <section className="reviewsGrid">
                <section className="pageCard reviewForm">
                  <h3>메뉴 후기 추가</h3>
                  <input
                    value={reviewDraft.menu}
                    onChange={(e) => setReviewDraft({ ...reviewDraft, menu: e.target.value })}
                    placeholder="메뉴명"
                    list="favorite-menus"
                  />
                  <datalist id="favorite-menus">
                    {data.favorites.map((item) => <option key={item} value={item} />)}
                  </datalist>
                  <select value={reviewDraft.reaction} onChange={(e) => setReviewDraft({ ...reviewDraft, reaction: e.target.value })}>
                    {reactionOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.icon} {option.label}</option>
                    ))}
                  </select>
                  <textarea value={reviewDraft.note} onChange={(e) => setReviewDraft({ ...reviewDraft, note: e.target.value })} placeholder="반응 메모" rows="3" />
                  <button onClick={() => {
                    if (!reviewDraft.menu.trim()) return
                    updateData({
                      menuReviews: [
                        ...data.menuReviews,
                        { id: crypto.randomUUID(), menu: reviewDraft.menu.trim(), reaction: reviewDraft.reaction, note: reviewDraft.note.trim() },
                      ],
                    })
                    setReviewDraft({ menu: '', reaction: 'good', note: '' })
                  }}>후기 저장</button>
                </section>

                <section className="reviewList">
                  {data.menuReviews.map((review) => {
                    const reaction = reactionOptions.find((option) => option.value === review.reaction)
                    return (
                      <article className="reviewCard" key={review.id}>
                        <div className="reviewReaction">
                          <span>{reaction?.icon}</span>
                          <small>{reaction?.label}</small>
                        </div>
                        <div className="reviewBody">
                          <h3>{review.menu}</h3>
                          <p>{review.note || '메모 없음'}</p>
                        </div>
                        <button className="delete" onClick={() => updateData({ menuReviews: data.menuReviews.filter((x) => x.id !== review.id) })}>삭제</button>
                      </article>
                    )
                  })}
                </section>
              </section>
            )}
          </section>
        )}

        {tab === 'stock' && (
          <section>
            <section className="pageCard categoryManager">
              <div className="categoryManagerHead">
                <div>
                  <h2>카테고리 관리</h2>
                  <p>추가·이름 변경·순서 변경을 앱에서 직접 할 수 있어요.</p>
                </div>
              </div>

              <div className="addRow categoryAddRow">
                <input
                  value={categoryDraft}
                  onChange={(e) => setCategoryDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addStockCategory()}
                  placeholder="새 카테고리 이름"
                />
                <button onClick={addStockCategory}>추가</button>
              </div>

              <div className="categoryRows">
                {data.stockCategories.map((category, index) => (
                  <div className="categoryRow" key={category}>
                    <input
                      defaultValue={category}
                      key={category}
                      onBlur={(e) => renameStockCategory(category, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                      }}
                    />
                    <div className="categoryButtons">
                      <button
                        className="categoryMove"
                        disabled={index === 0}
                        onClick={() => moveStockCategory(category, 'up')}
                        aria-label="위로"
                      >
                        ↑
                      </button>
                      <button
                        className="categoryMove"
                        disabled={index === data.stockCategories.length - 1}
                        onClick={() => moveStockCategory(category, 'down')}
                        aria-label="아래로"
                      >
                        ↓
                      </button>
                      <button
                        className="delete"
                        onClick={() => deleteStockCategory(category)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="pageCard stockForm">
              <h2>{editingStock ? '재고 수정' : '재고 추가'}</h2>
              <div className="formGrid">
                <Field label="품목명"><input value={stockForm.name} onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })} /></Field>
                <Field label="카테고리">
                  <select value={stockForm.category} onChange={(e) => setStockForm({ ...stockForm, category: e.target.value })}>
                    {data.stockCategories.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </Field>
                <Field label="현재 수량"><input type="number" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} /></Field>
                <Field label="단위"><input value={stockForm.unit} onChange={(e) => setStockForm({ ...stockForm, unit: e.target.value })} /></Field>
                <Field label="부족 기준"><input type="number" value={stockForm.threshold} onChange={(e) => setStockForm({ ...stockForm, threshold: e.target.value })} /></Field>
                <Field label="유통기한"><input type="date" value={stockForm.expiryDate} onChange={(e) => setStockForm({ ...stockForm, expiryDate: e.target.value })} /></Field>
                <Field label="며칠 전 알림"><input type="number" value={stockForm.alertDays} onChange={(e) => setStockForm({ ...stockForm, alertDays: e.target.value })} /></Field>
                <label className="checkField">
                  <input type="checkbox" checked={stockForm.autoNeed} onChange={(e) => setStockForm({ ...stockForm, autoNeed: e.target.checked })} />
                  부족하면 Need에 자동 추가
                </label>
              </div>
              <div className="formActions">
                {editingStock && <button className="secondary" onClick={() => { setEditingStock(null); setStockForm(blankStockForm()) }}>취소</button>}
                <button onClick={saveStock}>{editingStock ? '수정 저장' : '재고 추가'}</button>
              </div>
            </section>

            <section className="stockCategoryList">
              {Array.from(new Set([...data.stockCategories, ...data.stock.map((item) => item.category)]))
                .filter((category) => data.stock.some((item) => item.category === category))
                .map((category) => (
                  <section className="stockCategory" key={category}>
                    <div className="stockCategoryHead">
                      <h3>{category}</h3>
                      <span>{data.stock.filter((item) => item.category === category).length}개</span>
                    </div>
                    <div className="stockList">
                      {data.stock
                        .filter((item) => item.category === category)
                        .map((item) => {
                          const low = Number(item.quantity) <= Number(item.threshold)
                          const expiring = isExpiring(item)
                          return (
                            <article className={low || expiring ? 'stockCard warning' : 'stockCard'} key={item.id}>
                              <div className="stockTop">
                                <div><h3>{item.name}</h3></div>
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
                                <button className="delete" onClick={() => updateData({ stock: data.stock.filter((x) => x.id !== item.id) })}>삭제</button>
                              </div>
                            </article>
                          )
                        })}
                    </div>
                  </section>
                ))}
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
                <input value={needDraft} onChange={(e) => setNeedDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNeed()} placeholder="구매할 품목 추가" />
                <button onClick={addNeed}>추가</button>
              </div>
            )}

            <div className="needList">
              {data.needs
                .filter((item) => item.purchased === (needMode === 'purchased'))
                .map((item) => (
                  <article
                    className={`needRow ${draggedNeedId === item.id ? 'dragging' : ''}`}
                    key={item.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedNeedId(item.id)
                      e.dataTransfer.setData('text/plain', item.id)
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      reorderNeeds(e.dataTransfer.getData('text/plain') || draggedNeedId, item.id)
                      setDraggedNeedId(null)
                    }}
                    onDragEnd={() => setDraggedNeedId(null)}
                  >
                    <span className="dragHandle">⋮⋮</span>
                    <div className="needMain">
                      <strong>{item.name}</strong>
                      {needMode === 'need' && (
                        <div className="quantityEditor">
                          <input type="number" min="0" value={item.stockQuantity} onChange={(e) => updateData({
                            needs: data.needs.map((x) => x.id === item.id ? { ...x, stockQuantity: e.target.value } : x),
                          })} />
                          <input value={item.stockUnit} onChange={(e) => updateData({
                            needs: data.needs.map((x) => x.id === item.id ? { ...x, stockUnit: e.target.value } : x),
                          })} />
                        </div>
                      )}
                    </div>

                    <div className="needButtons">
                      {needMode === 'need' ? (
                        <>
                          <button onClick={() => markPurchased(item, false)}>구매완료</button>
                          <button className="secondary" onClick={() => markPurchased(item, true)}>재고 반영</button>
                        </>
                      ) : (
                        <button onClick={() => updateData({
                          needs: data.needs.map((x) => x.id === item.id ? { ...x, purchased: false } : x),
                        })}>되돌리기</button>
                      )}
                      <button className="delete" onClick={() => updateData({ needs: data.needs.filter((x) => x.id !== item.id) })}>삭제</button>
                    </div>
                  </article>
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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(`${item.expiryDate}T00:00:00`)
  return Math.ceil((expiry - today) / 86400000) <= Number(item.alertDays || 0)
}

function Card({ title, kicker, children, onClick }) {
  return (
    <article className="card" onClick={onClick}>
      <div className="cardHead">
        <div><p className="kicker">{kicker}</p><h2>{title}</h2></div>
        <span className="arrow">›</span>
      </div>
      {children}
    </article>
  )
}

function Empty({ title, text }) {
  return <div className="empty"><strong>{title}</strong><span>{text}</span></div>
}

function Mini({ label, value }) {
  return (
    <div className="mini">
      <strong>{label}</strong>
      <span className="miniValue">{value || '—'}</span>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function Nav({ label, icon, active, onClick }) {
  return (
    <button className={active ? 'navButton active' : 'navButton'} onClick={onClick}>
      <span className="navIcon">{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function titleFor(tab) {
  return { home: '오늘도 가볍게.', todo: 'Todo', meals: 'Meals', stock: 'Stock', need: 'Need' }[tab]
}

function subtitleFor(tab) {
  return {
    home: '해야 할 일과 집안 흐름을 한곳에서 정리해요.',
    todo: '오늘과 다음을 가볍게 정리해요.',
    meals: '이번 주 식단과 메뉴 반응을 한눈에.',
    stock: '부족 기준과 유통기한을 함께 관리해요.',
    need: '사야 할 것과 구매 완료를 나눠봐요.',
  }[tab]
}

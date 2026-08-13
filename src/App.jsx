import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
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
    { id: 't1', title: '이유식 용기 정리', bucket: 'today', done: false, important: true, inProgress: true },
    { id: 't2', title: '세탁기 돌리기', bucket: 'today', done: false, important: false, inProgress: false },
    { id: 't3', title: '병원 서류 정리', bucket: 'next', done: false, important: false, inProgress: false },
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
    { id: 's1', name: '계란', category: '음식', quantity: 4, unit: '개', threshold: 6, expiryDate: '', noExpiry: true, alertDays: 3, autoNeed: true, storageLocation: '냉장' },
    { id: 's2', name: '물티슈', category: '육아', quantity: 1, unit: '팩', threshold: 2, expiryDate: '', noExpiry: true, alertDays: 7, autoNeed: true, storageLocation: '팬트리' },
  ],
  needs: [
    { id: 'n1', name: '아기 치약', purchased: false, stockQuantity: 1, stockUnit: '개', sortOrder: 1 },
  ],
  houseLocations: [],
  careNotes: [],
  developmentRecords: [],
  wipeQuest: {
    unitPrice: 35,
    transferTarget: 10000,
    currentCount: 0,
    totalSaved: 0,
    transferCount: 0,
    lastTransferAmount: 0,
    lastTransferAt: '',
  },
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
    return normalizeState(parsed)
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
  const [stockForm, setStockForm] = useState(() => blankStockForm(defaultCategories[0]))
  const [categoryDraft, setCategoryDraft] = useState('')
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [showStockForm, setShowStockForm] = useState(false)
  const [openStockCategories, setOpenStockCategories] = useState({})
  const [houseLocationForm, setHouseLocationForm] = useState({ room: '', storage: '', detail: '' })
  const [careNoteForm, setCareNoteForm] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    symptoms: '',
    actions: '',
    result: '',
    hospitalGuide: '',
  })
  const [developmentForm, setDevelopmentForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: '대근육',
    status: '처음 성공',
    title: '',
    correctedAge: '',
    note: '',
  })
  const [developmentFilter, setDevelopmentFilter] = useState('전체')
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [cloudReady, setCloudReady] = useState(false)
  const [householdId, setHouseholdId] = useState(null)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [syncStatus, setSyncStatus] = useState('')

  useEffect(() => {
    if (!data.stockCategories.length) return
    if (!data.stockCategories.includes(stockForm.category)) {
      setStockForm((prev) => ({ ...prev, category: data.stockCategories[0] }))
    }
  }, [data.stockCategories, stockForm.category])


  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: authData }) => {
      if (!mounted) return
      setSession(authData.session)
      setAuthLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
      if (!nextSession) {
        setHouseholdId(null)
        setCloudReady(false)
        setSyncStatus('')
      }
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (!session?.user) return
    let cancelled = false

    const loadCloudData = async () => {
      setCloudLoading(true)
      setCloudReady(false)
      setSyncStatus('불러오는 중')

      const { data: household, error: householdError } = await supabase
        .from('households')
        .select('id')
        .limit(1)
        .maybeSingle()

      if (cancelled) return
      if (householdError || !household) {
        console.error('가족 데이터 조회 실패:', householdError)
        setLoginError('우리 집 데이터 공간을 찾지 못했어요.')
        setCloudLoading(false)
        setSyncStatus('연결 오류')
        return
      }

      const { data: cloudRow, error: cloudError } = await supabase
        .from('app_data')
        .select('data')
        .eq('household_id', household.id)
        .maybeSingle()

      if (cancelled) return
      if (cloudError) {
        console.error('앱 데이터 조회 실패:', cloudError)
        setLoginError('Supabase 데이터를 불러오지 못했어요.')
        setCloudLoading(false)
        setSyncStatus('연결 오류')
        return
      }

      const cloudData = cloudRow?.data
      const hasCloudData = cloudData && typeof cloudData === 'object' && !Array.isArray(cloudData) && Object.keys(cloudData).length > 0

      if (hasCloudData) {
        setData(normalizeState(cloudData))
      } else {
        const localData = normalizeState(loadState())
        const { error: uploadError } = await supabase
          .from('app_data')
          .upsert({ household_id: household.id, data: localData, updated_at: new Date().toISOString() }, { onConflict: 'household_id' })

        if (cancelled) return
        if (uploadError) {
          console.error('기존 데이터 이전 실패:', uploadError)
          setLoginError('기존 데이터를 Supabase로 옮기지 못했어요.')
          setCloudLoading(false)
          setSyncStatus('이전 실패')
          return
        }
        setData(localData)
      }

      setHouseholdId(household.id)
      setCloudReady(true)
      setCloudLoading(false)
      setSyncStatus('저장됨')
    }

    loadCloudData()
    return () => { cancelled = true }
  }, [session?.user?.id])

  useEffect(() => {
    if (!cloudReady || !householdId) return
    setSyncStatus('저장 중')
    const timer = window.setTimeout(async () => {
      const { error } = await supabase
        .from('app_data')
        .update({ data, updated_at: new Date().toISOString() })
        .eq('household_id', householdId)

      if (error) {
        console.error('Supabase 저장 실패:', error)
        setSyncStatus('저장 실패')
      } else {
        setSyncStatus('저장됨')
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [data, cloudReady, householdId])

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

  const addHouseLocation = () => {
    const room = houseLocationForm.room.trim()
    const storage = houseLocationForm.storage.trim()
    if (!room || !storage) return
    updateData({
      houseLocations: [
        ...data.houseLocations,
        {
          id: crypto.randomUUID(),
          room,
          storage,
          detail: houseLocationForm.detail.trim(),
        },
      ],
    })
    setHouseLocationForm({ room: '', storage: '', detail: '' })
  }

  const addCareNote = () => {
    if (!careNoteForm.title.trim()) return
    updateData({
      careNotes: [
        {
          id: crypto.randomUUID(),
          ...careNoteForm,
          title: careNoteForm.title.trim(),
        },
        ...data.careNotes,
      ],
    })
    setCareNoteForm({
      title: '',
      date: new Date().toISOString().slice(0, 10),
      symptoms: '',
      actions: '',
      result: '',
      hospitalGuide: '',
    })
  }

  const addDevelopmentRecord = () => {
    if (!developmentForm.title.trim()) return
    updateData({
      developmentRecords: [
        {
          id: crypto.randomUUID(),
          ...developmentForm,
          title: developmentForm.title.trim(),
        },
        ...data.developmentRecords,
      ],
    })
    setDevelopmentForm({
      date: new Date().toISOString().slice(0, 10),
      category: '대근육',
      status: '처음 성공',
      title: '',
      correctedAge: '',
      note: '',
    })
  }

  const addWipeSticker = () => {
    const quest = data.wipeQuest || defaultState.wipeQuest
    updateData({
      wipeQuest: {
        ...quest,
        currentCount: Number(quest.currentCount || 0) + 1,
        totalSaved: Number(quest.totalSaved || 0) + 35,
      },
    })
  }

  const resetWipeQuestAfterTransfer = () => {
    const quest = data.wipeQuest || defaultState.wipeQuest
    const currentAmount = Number(quest.currentCount || 0) * 35
    if (currentAmount < 10000) return
    const confirmed = window.confirm(
      `${currentAmount.toLocaleString('ko-KR')}원을 하나은행에 송금했나요?\n현재 스티커판만 초기화하고 누적 절약액은 유지해요.`,
    )
    if (!confirmed) return

    updateData({
      wipeQuest: {
        ...quest,
        currentCount: 0,
        transferCount: Number(quest.transferCount || 0) + 1,
        lastTransferAmount: currentAmount,
        lastTransferAt: new Date().toISOString(),
      },
    })
  }

  const lowStock = useMemo(
    () => data.stock.filter((item) => Number(item.quantity) <= Number(item.threshold)),
    [data.stock],
  )

  const expiringStock = useMemo(() => data.stock.filter(isExpiring), [data.stock])
  const todayTodos = data.todos.filter((item) => item.bucket === 'today')
  const todayPreview = todayTodos.slice(0, 3)
  const completedTodayCount = todayTodos.filter((item) => item.done).length
  const todayProgress = todayTodos.length ? Math.round((completedTodayCount / todayTodos.length) * 100) : 0
  const todayLabel = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())
  const todayMeals = data.meals.월

  const visibleBucketTodos = (bucket = todoMode) =>
    data.todos
      .filter((item) => item.bucket === bucket)
      .filter((item) => !(hideDone && item.done))

  const placeTodoByDefault = (todos, todo) => {
    const bucketItems = todos.filter((item) => item.bucket === todo.bucket && item.id !== todo.id)
    const otherItems = todos.filter((item) => item.bucket !== todo.bucket)
    const progressingOpen = bucketItems.filter((item) => !item.done && item.inProgress)
    const importantOpen = bucketItems.filter((item) => !item.done && !item.inProgress && item.important)
    const regularOpen = bucketItems.filter((item) => !item.done && !item.inProgress && !item.important)
    const completed = bucketItems.filter((item) => item.done)

    let arranged
    if (todo.done) {
      arranged = [...progressingOpen, ...importantOpen, ...regularOpen, ...completed, todo]
    } else if (todo.inProgress) {
      arranged = [todo, ...progressingOpen, ...importantOpen, ...regularOpen, ...completed]
    } else if (todo.important) {
      arranged = [...progressingOpen, todo, ...importantOpen, ...regularOpen, ...completed]
    } else {
      arranged = [...progressingOpen, ...importantOpen, todo, ...regularOpen, ...completed]
    }

    const firstBucketIndex = todos.findIndex((item) => item.bucket === todo.bucket)
    if (firstBucketIndex < 0) return [...todos, todo]
    const result = [...otherItems]
    result.splice(firstBucketIndex, 0, ...arranged)
    return result
  }

  const addTodo = () => {
    const title = todoDraft.trim()
    if (!title) return
    const newTodo = {
      id: crypto.randomUUID(),
      title,
      bucket: todoMode === 'next' ? 'next' : 'today',
      done: false,
      important: false,
      inProgress: false,
      createdAt: Date.now(),
    }
    updateData({ todos: placeTodoByDefault(data.todos, newTodo) })
    setTodoDraft('')
  }

  const reorderTodos = (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) return
    const visible = visibleBucketTodos()
    const sourceIndex = visible.findIndex((item) => item.id === sourceId)
    const targetIndex = visible.findIndex((item) => item.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    const reorderedVisible = [...visible]
    const [moved] = reorderedVisible.splice(sourceIndex, 1)
    reorderedVisible.splice(targetIndex, 0, moved)
    let visibleIndex = 0
    updateData({
      todos: data.todos.map((item) =>
        item.bucket === todoMode && !(hideDone && item.done)
          ? reorderedVisible[visibleIndex++]
          : item,
      ),
    })
  }

  const moveTodo = (todoId, direction) => {
    const visible = visibleBucketTodos()
    const index = visible.findIndex((item) => item.id === todoId)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || targetIndex < 0 || targetIndex >= visible.length) return
    const reorderedVisible = [...visible]
    ;[reorderedVisible[index], reorderedVisible[targetIndex]] = [reorderedVisible[targetIndex], reorderedVisible[index]]
    let visibleIndex = 0
    updateData({
      todos: data.todos.map((item) =>
        item.bucket === todoMode && !(hideDone && item.done)
          ? reorderedVisible[visibleIndex++]
          : item,
      ),
    })
  }

  const toggleTodoDone = (todoId) => {
    const target = data.todos.find((item) => item.id === todoId)
    if (!target) return
    const changed = { ...target, done: !target.done, inProgress: target.done ? target.inProgress : false }
    updateData({ todos: placeTodoByDefault(data.todos, changed) })
  }

  const toggleTodoImportant = (todoId) => {
    const target = data.todos.find((item) => item.id === todoId)
    if (!target) return
    const changed = { ...target, important: !target.important }
    updateData({ todos: placeTodoByDefault(data.todos, changed) })
  }

  const toggleTodoProgress = (todoId) => {
    const target = data.todos.find((item) => item.id === todoId)
    if (!target) return
    const changed = {
      ...target,
      inProgress: !target.inProgress,
      done: target.inProgress ? target.done : false,
    }
    updateData({ todos: placeTodoByDefault(data.todos, changed) })
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

  const signIn = async (event) => {
    event.preventDefault()
    setLoginError('')
    setLoginBusy(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email.trim(),
      password: loginForm.password,
    })
    if (error) setLoginError('이메일 또는 비밀번호를 확인해 주세요.')
    setLoginBusy(false)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
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

  const adjustStockQuantity = (id, delta) => {
    updateData({
      stock: data.stock.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(0, Number(item.quantity || 0) + delta) }
          : item
      ),
    })
  }

  const saveStock = () => {
    const name = stockForm.name.trim()
    if (!name) return
    const item = {
      ...stockForm,
      name,
      storageLocation: stockForm.storageLocation.trim(),
      quantity: Number(stockForm.quantity || 0),
      threshold: Number(stockForm.threshold || 0),
      alertDays: Number(stockForm.alertDays || 0),
      expiryDate: stockForm.noExpiry ? '' : stockForm.expiryDate,
    }
    updateData({
      stock: editingStock
        ? data.stock.map((x) => x.id === editingStock ? { ...item, id: editingStock } : x)
        : [...data.stock, { ...item, id: crypto.randomUUID() }],
    })
    setEditingStock(null)
    const nextCategory = stockForm.category || data.stockCategories[0] || defaultCategories[0]
    setStockForm(blankStockForm(nextCategory))
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
              noExpiry: true,
              alertDays: 3,
              autoNeed: false,
              storageLocation: '',
            },
          ]
    }

    setData((prev) => ({
      ...prev,
      stock: nextStock,
      needs: prev.needs.map((need) => need.id === item.id ? { ...need, purchased: true } : need),
    }))
  }

  if (authLoading) {
    return (
      <div className="authShell">
        <div className="authCard authLoadingCard">
          <span className="authSpinner" />
          <p>With Me를 준비하고 있어요.</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="authShell">
        <form className="authCard" onSubmit={signIn}>
          <p className="eyebrow">WITH ME</p>
          <h1>우리 집에 로그인</h1>
          <p className="authDescription">Supabase에 저장된 내 생활 데이터를 불러와요.</p>
          <label className="authField">
            <span>이메일</span>
            <input type="email" autoComplete="email" value={loginForm.email} onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="이메일 주소" required />
          </label>
          <label className="authField">
            <span>비밀번호</span>
            <input type="password" autoComplete="current-password" value={loginForm.password} onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))} placeholder="비밀번호" required />
          </label>
          {loginError && <p className="authError">{loginError}</p>}
          <button className="authSubmit" type="submit" disabled={loginBusy}>{loginBusy ? '로그인 중…' : '로그인'}</button>
        </form>
      </div>
    )
  }

  if (cloudLoading || !cloudReady) {
    return (
      <div className="authShell">
        <div className="authCard authLoadingCard">
          <span className="authSpinner" />
          <p>우리 집 데이터를 불러오고 있어요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <main className="content">
        <header className="header">
          <div className="headerAccount">
            <div>
              <p className="eyebrow">WITH ME</p>
              {syncStatus === '저장 실패' && <span className="syncStatus error">저장 실패</span>}
            </div>
            <button className="logoutButton" onClick={signOut}>로그아웃</button>
          </div>
          <h1>{titleFor(tab)}</h1>
          <p className="sub">{subtitleFor(tab)}</p>
        </header>

        {tab === 'home' && (
          <section className="stack">
            <Card title="Todo" kicker="TODAY" onClick={() => setTab('todo')}>
              <div className="homeTodoSummary">
                <span>{todayLabel}</span>
                <strong>{todayProgress}%</strong>
              </div>
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
                      {!item.done && item.inProgress && <b className="badge progressBadge"><span className="statusDot" />진행중</b>}
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
                  <span className="dragHelp">PC는 드래그 · 휴대폰은 ↑↓ 버튼으로 순서 변경</span>
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
                    .map((item, visibleIndex, visibleItems) => (
                      <div
                        className={`${item.done ? 'task done' : 'task'} ${item.inProgress ? 'inProgress' : ''} ${draggedTodoId === item.id ? 'dragging' : ''}`}
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
                          onChange={() => toggleTodoDone(item.id)}
                        />
                        {!item.done && (
                          <button
                            type="button"
                            className={item.inProgress ? 'progressToggle active' : 'progressToggle'}
                            onClick={() => toggleTodoProgress(item.id)}
                            aria-pressed={Boolean(item.inProgress)}
                            aria-label={`${item.title} 진행중 상태 ${item.inProgress ? '해제' : '설정'}`}
                          ><span className="statusDot" />진행중</button>
                        )}
                        <button
                          className={item.important ? 'star active' : 'star'}
                          onClick={() => toggleTodoImportant(item.id)}
                        >★</button>
                        <span className="taskTitle">{item.title}</span>
                        <div className="todoMoveButtons" aria-label="순서 변경">
                          <button
                            type="button"
                            onClick={() => moveTodo(item.id, 'up')}
                            disabled={visibleItems.findIndex((todo) => todo.id === item.id) === 0}
                            aria-label={`${item.title} 위로 이동`}
                          >↑</button>
                          <button
                            type="button"
                            onClick={() => moveTodo(item.id, 'down')}
                            disabled={visibleItems.findIndex((todo) => todo.id === item.id) === visibleItems.length - 1}
                            aria-label={`${item.title} 아래로 이동`}
                          >↓</button>
                        </div>
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
            <section className="pageCard collapsibleCard stockForm">
              <button
                className="collapseHeader"
                onClick={() => setShowStockForm((prev) => !prev)}
                aria-expanded={showStockForm}
              >
                <div>
                  <h2>{editingStock ? '재고 수정' : '재고 추가'}</h2>
                  <p>{editingStock ? '선택한 품목 정보를 수정해요.' : '새 품목을 재고에 등록해요.'}</p>
                </div>
                <span className={showStockForm ? 'collapseIcon open' : 'collapseIcon'} aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>

              <div className={showStockForm ? 'collapsePanel open' : 'collapsePanel'}>
                <div className="collapseInner">
                  <div className="collapseBody">
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
                <Field label="보관 위치">
                  <input
                    value={stockForm.storageLocation}
                    onChange={(e) => setStockForm({ ...stockForm, storageLocation: e.target.value })}
                    placeholder="예: 냉장고, 팬트리, 욕실장"
                  />
                </Field>
                <Field label="유통기한">
                  <input
                    type="date"
                    value={stockForm.expiryDate}
                    disabled={stockForm.noExpiry}
                    onChange={(e) => setStockForm({ ...stockForm, expiryDate: e.target.value })}
                  />
                </Field>
                <label className="checkField expiryCheckField">
                  <input
                    type="checkbox"
                    checked={stockForm.noExpiry}
                    onChange={(e) =>
                      setStockForm({
                        ...stockForm,
                        noExpiry: e.target.checked,
                        expiryDate: e.target.checked ? '' : stockForm.expiryDate,
                      })
                    }
                  />
                  유통기한 없음
                </label>
                <Field label="며칠 전 알림">
                  <input
                    type="number"
                    value={stockForm.alertDays}
                    disabled={stockForm.noExpiry}
                    onChange={(e) => setStockForm({ ...stockForm, alertDays: e.target.value })}
                  />
                </Field>
                <label className="checkField">
                  <input type="checkbox" checked={stockForm.autoNeed} onChange={(e) => setStockForm({ ...stockForm, autoNeed: e.target.checked })} />
                  부족하면 Need에 자동 추가
                </label>
              </div>
                  <div className="formActions">
                    {editingStock && (
                      <button
                        className="secondary"
                        onClick={() => {
                          setEditingStock(null)
                          setStockForm(blankStockForm(data.stockCategories[0] || defaultCategories[0]))
                        }}
                      >
                        취소
                      </button>
                    )}
                    <button onClick={saveStock}>
                      {editingStock ? '수정 저장' : '재고 추가'}
                    </button>
                  </div>
                </div>
              </div>
              </div>
            </section>


            <section className="pageCard collapsibleCard categoryManager">
              <button
                className="collapseHeader"
                onClick={() => setShowCategoryManager((prev) => !prev)}
                aria-expanded={showCategoryManager}
              >
                <div>
                  <h2>카테고리 관리</h2>
                  <p>추가·이름 변경·삭제·순서 변경</p>
                </div>
                <span className={showCategoryManager ? 'collapseIcon open' : 'collapseIcon'} aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>

              <div className={showCategoryManager ? 'collapsePanel open' : 'collapsePanel'}>
                <div className="collapseInner">
                  <div className="collapseBody">
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
                </div>
              </div>
              </div>
            </section>

            <section className="stockCategoryList">
              {Array.from(new Set([...data.stockCategories, ...data.stock.map((item) => item.category)]))
                .filter((category) => data.stock.some((item) => item.category === category))
                .map((category) => {
                  const categoryItems = data.stock.filter((item) => item.category === category)
                  const hasWarning = categoryItems.some(
                    (item) => Number(item.quantity) <= Number(item.threshold) || isExpiring(item),
                  )
                  const isOpen = Boolean(openStockCategories[category])

                  return (
                    <section className={isOpen ? 'stockCategory open' : 'stockCategory'} key={category}>
                      <button
                        type="button"
                        className="stockCategoryHead"
                        onClick={() =>
                          setOpenStockCategories((prev) => ({
                            ...prev,
                            [category]: !prev[category],
                          }))
                        }
                        aria-expanded={isOpen}
                      >
                        <span className="stockCategoryTitleWrap">
                          <h3>{category}</h3>
                          {hasWarning && <span className="stockCategoryAlertDot" aria-label="확인할 재고 있음" />}
                        </span>
                        <span className="stockCategoryChevron" aria-hidden="true">⌄</span>
                      </button>

                      <div className="stockCategoryBody">
                        <div className="stockCategoryBodyInner">
                          <div className="stockList">
                            {categoryItems.map((item) => {
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
                                  <div className="stockTable" role="group" aria-label={`${item.name} 재고 정보`}>
                                    <div className="stockTableLabels">
                                      <span>현재 수량</span>
                                      <span>부족 기준</span>
                                      <span>보관 위치</span>
                                      <span>유통기한</span>
                                    </div>
                                    <div className="stockTableValues">
                                      <div className="stockQuantityQuick">
                                        <button
                                          type="button"
                                          className="quantityQuickButton"
                                          onClick={() => adjustStockQuantity(item.id, -1)}
                                          disabled={Number(item.quantity) <= 0}
                                          aria-label={`${item.name} 수량 1 감소`}
                                        >−</button>
                                        <strong>{item.quantity}{item.unit}</strong>
                                        <button
                                          type="button"
                                          className="quantityQuickButton"
                                          onClick={() => adjustStockQuantity(item.id, 1)}
                                          aria-label={`${item.name} 수량 1 증가`}
                                        >+</button>
                                      </div>
                                      <strong>{item.threshold}{item.unit}</strong>
                                      <strong>{item.storageLocation || '미설정'}</strong>
                                      <strong>{item.noExpiry ? '없음' : item.expiryDate || '미설정'}</strong>
                                    </div>
                                  </div>
                                  <div className="cardActions">
                                    <button onClick={() => { setEditingStock(item.id); setStockForm({ ...item }); setShowStockForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>수정</button>
                                    <button className="delete" onClick={() => updateData({ stock: data.stock.filter((x) => x.id !== item.id) })}>삭제</button>
                                  </div>
                                </article>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </section>
                  )
                })}
            </section>
          </section>
        )}

        {tab === 'more' && (
          <section className="morePage">
            <div className="moreSectionLabel">생활</div>
            <button type="button" className="moreMenuCard" onClick={() => setTab('houseMap')}>
              <span className="moreMenuIcon">⌂</span>
              <span className="moreMenuText">
                <strong>집안 위치도</strong>
                <small>방과 수납 위치를 한눈에 정리해요</small>
              </span>
              <span className="moreMenuArrow">›</span>
            </button>

            <div className="moreSectionLabel">육아</div>
            <button type="button" className="moreMenuCard" onClick={() => setTab('careNotes')}>
              <span className="moreMenuIcon">♡</span>
              <span className="moreMenuText">
                <strong>증상 대응 노트</strong>
                <small>아팠을 때 증상과 대응 결과를 기록해요</small>
              </span>
              <span className="moreMenuArrow">›</span>
            </button>

            <button type="button" className="moreMenuCard" onClick={() => setTab('development')}>
              <span className="moreMenuIcon">★</span>
              <span className="moreMenuText">
                <strong>발달 기록</strong>
                <small>작은 변화와 처음 성공한 날을 남겨요</small>
              </span>
              <span className="moreMenuArrow">›</span>
            </button>

            <div className="moreSectionLabel">관리</div>
            <button type="button" className="moreMenuCard" onClick={() => setTab('need')}>
              <span className="moreMenuIcon">✓</span>
              <span className="moreMenuText">
                <strong>Need</strong>
                <small>사야 할 것과 구매 완료 항목</small>
              </span>
              {data.needs.filter((item) => !item.purchased).length > 0 && (
                <span className="moreMenuBadge">
                  {data.needs.filter((item) => !item.purchased).length}
                </span>
              )}
              <span className="moreMenuArrow">›</span>
            </button>

            <section className="moreInfoCard">
              <div>
                <strong>앱 버전</strong>
                <span>v0.1.13</span>
              </div>
              <button type="button" onClick={signOut}>로그아웃</button>
            </section>
          </section>
        )}

        {tab === 'wipeQuest' && (() => {
          const quest = data.wipeQuest || defaultState.wipeQuest
          const currentCount = Number(quest.currentCount || 0)
          const currentAmount = currentCount * 35
          const totalSaved = Number(quest.totalSaved || 0)
          const target = 10000
          const remaining = Math.max(0, target - currentAmount)
          const progress = Math.min(100, (currentAmount / target) * 100)
          const currentBoardNumber = Math.floor(Math.max(currentCount - 1, 0) / 100) + 1
          const currentBoardFilled = currentCount === 0 ? 0 : ((currentCount - 1) % 100) + 1

          return (
            <section className="featurePage wipeQuestPage">
              <button className="backToMore" type="button" onClick={() => setTab('more')}>‹ 더보기</button>

              <section className="wipeHero">
                <div className="wipeHeroTop">
                  <div>
                    <span className="wipeEyebrow">현재 적립</span>
                    <strong className="wipeCurrentAmount">{currentAmount.toLocaleString('ko-KR')}원</strong>
                  </div>
                  <div className="wipeUnitPrice">1장 = 35원</div>
                </div>

                <div className="wipeProgressTrack" aria-label="하나은행 송금 목표 진행률">
                  <div className="wipeProgressBar" style={{ width: `${progress}%` }} />
                </div>

                <div className="wipeProgressMeta">
                  {currentAmount >= target ? (
                    <strong className="wipeReady">🎉 하나은행 송금 가능!</strong>
                  ) : (
                    <span>10,000원까지 {remaining.toLocaleString('ko-KR')}원 남음</span>
                  )}
                  <span>{currentCount.toLocaleString('ko-KR')}장 절약</span>
                </div>

                <div className="wipeLifetime">
                  <span>현재까지 아낀 금액</span>
                  <strong>{totalSaved.toLocaleString('ko-KR')}원</strong>
                  <small>스티커판을 초기화해도 이 금액은 계속 누적돼요.</small>
                </div>
              </section>

              <section className="pageCard wipeStickerCard">
                <div className="wipeStickerHead">
                  <div>
                    <span className="wipeEyebrow">COIN BOARD</span>
                    <h2>동전 스티커판</h2>
                    <p>{currentBoardNumber}판째 · 한 판 100장</p>
                  </div>
                  <button className="wipeAddButton" type="button" onClick={addWipeSticker}>
                    <span className="wipeAddCoin">₩</span>
                    +35원 붙이기
                  </button>
                </div>

                <div className="wipeStickerBoard">
                  {Array.from({ length: 100 }, (_, index) => {
                    const filled = index < currentBoardFilled
                    const isNext = index === currentBoardFilled
                    return (
                      <button
                        type="button"
                        key={index}
                        className={filled ? 'wipeStickerSlot filled' : isNext ? 'wipeStickerSlot next' : 'wipeStickerSlot'}
                        onClick={isNext ? addWipeSticker : undefined}
                        disabled={!isNext}
                        aria-label={filled ? `${index + 1}번째 동전 적립 완료` : isNext ? '다음 동전 붙이기' : '빈 스티커 칸'}
                      >
                        {filled ? <span className="wipeCoinIcon">₩</span> : <span>{index + 1}</span>}
                      </button>
                    )
                  })}
                </div>
                <p className="wipeBoardHint">다음 빈 칸을 눌러도 35원이 적립돼요.</p>
              </section>

              <section className="wipeTransferCard">
                <div>
                  <span>하나은행 송금 기준</span>
                  <strong>10,000원 이상</strong>
                  {Number(quest.transferCount || 0) > 0 && (
                    <small>
                      지금까지 {Number(quest.transferCount || 0)}회 송금
                      {Number(quest.lastTransferAmount || 0) > 0
                        ? ` · 마지막 ${Number(quest.lastTransferAmount).toLocaleString('ko-KR')}원`
                        : ''}
                    </small>
                  )}
                </div>
                <button
                  type="button"
                  className="wipeResetButton"
                  disabled={currentAmount < target}
                  onClick={resetWipeQuestAfterTransfer}
                >
                  입금 후 초기화
                </button>
              </section>
            </section>
          )
        })()}

        {tab === 'houseMap' && (
          <section className="featurePage">
            <button className="backToMore" type="button" onClick={() => setTab('more')}>‹ 더보기</button>

            <section className="pageCard">
              <h2>위치 추가</h2>
              <p className="featureHint">실제 라벨링이 끝난 위치부터 하나씩 등록하면 돼요.</p>
              <div className="featureFormGrid">
                <Field label="공간">
                  <input
                    value={houseLocationForm.room}
                    onChange={(e) => setHouseLocationForm({ ...houseLocationForm, room: e.target.value })}
                    placeholder="예: 현관, 주방"
                  />
                </Field>
                <Field label="수납 위치">
                  <input
                    value={houseLocationForm.storage}
                    onChange={(e) => setHouseLocationForm({ ...houseLocationForm, storage: e.target.value })}
                    placeholder="예: 신발장 상단"
                  />
                </Field>
                <Field label="보관 내용">
                  <input
                    value={houseLocationForm.detail}
                    onChange={(e) => setHouseLocationForm({ ...houseLocationForm, detail: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && addHouseLocation()}
                    placeholder="예: 청소 재고, 병원 서류"
                  />
                </Field>
              </div>
              <div className="formActions"><button onClick={addHouseLocation}>위치 추가</button></div>
            </section>

            <section className="locationGroups">
              {Array.from(new Set(data.houseLocations.map((item) => item.room))).map((room) => (
                <article className="locationRoomCard" key={room}>
                  <h3>{room}</h3>
                  <div className="locationRows">
                    {data.houseLocations.filter((item) => item.room === room).map((item) => {
                      const linkedStock = data.stock.filter((stockItem) =>
                        (stockItem.storageLocation || '').includes(item.storage) ||
                        item.storage.includes(stockItem.storageLocation || '__none__')
                      )
                      return (
                        <div className="locationRow" key={item.id}>
                          <div>
                            <strong>{item.storage}</strong>
                            <span>{item.detail || '보관 내용 미입력'}</span>
                            {linkedStock.length > 0 && <small>연결된 재고 {linkedStock.length}개</small>}
                          </div>
                          <button className="delete" onClick={() => updateData({
                            houseLocations: data.houseLocations.filter((x) => x.id !== item.id),
                          })}>삭제</button>
                        </div>
                      )
                    })}
                  </div>
                </article>
              ))}
              {data.houseLocations.length === 0 && (
                <Empty title="등록된 위치가 없어요" text="라벨링이 끝난 수납 위치부터 추가해보세요." />
              )}
            </section>
          </section>
        )}

        {tab === 'careNotes' && (
          <section className="featurePage">
            <button className="backToMore" type="button" onClick={() => setTab('more')}>‹ 더보기</button>

            <section className="medicalNotice">
              개인 경험 기록이며 의료진의 진단이나 응급 판단을 대신하지 않아요.
            </section>

            <section className="pageCard">
              <h2>증상 기록 추가</h2>
              <div className="featureFormGrid">
                <Field label="제목">
                  <input
                    value={careNoteForm.title}
                    onChange={(e) => setCareNoteForm({ ...careNoteForm, title: e.target.value })}
                    placeholder="예: 가래 때문에 자주 깸"
                  />
                </Field>
                <Field label="발생일">
                  <input
                    type="date"
                    value={careNoteForm.date}
                    onChange={(e) => setCareNoteForm({ ...careNoteForm, date: e.target.value })}
                  />
                </Field>
                <Field label="보였던 증상">
                  <textarea
                    rows="3"
                    value={careNoteForm.symptoms}
                    onChange={(e) => setCareNoteForm({ ...careNoteForm, symptoms: e.target.value })}
                    placeholder="기침할 때 놀라서 울음, 그르렁거림"
                  />
                </Field>
                <Field label="해본 대응">
                  <textarea
                    rows="3"
                    value={careNoteForm.actions}
                    onChange={(e) => setCareNoteForm({ ...careNoteForm, actions: e.target.value })}
                    placeholder="흡인, 네뷸라이저, 자세 조절"
                  />
                </Field>
                <Field label="결과">
                  <textarea
                    rows="2"
                    value={careNoteForm.result}
                    onChange={(e) => setCareNoteForm({ ...careNoteForm, result: e.target.value })}
                    placeholder="무엇이 도움이 됐는지"
                  />
                </Field>
                <Field label="병원 안내·다음 진료 기준">
                  <textarea
                    rows="2"
                    value={careNoteForm.hospitalGuide}
                    onChange={(e) => setCareNoteForm({ ...careNoteForm, hospitalGuide: e.target.value })}
                    placeholder="의료진에게 들은 내용만 기록"
                  />
                </Field>
              </div>
              <div className="formActions"><button onClick={addCareNote}>기록 저장</button></div>
            </section>

            <section className="recordList">
              {data.careNotes.map((note) => (
                <article className="recordCard" key={note.id}>
                  <div className="recordHead">
                    <div><small>{note.date}</small><h3>{note.title}</h3></div>
                    <button className="delete" onClick={() => updateData({
                      careNotes: data.careNotes.filter((x) => x.id !== note.id),
                    })}>삭제</button>
                  </div>
                  {note.symptoms && <RecordSection label="보였던 증상" value={note.symptoms} />}
                  {note.actions && <RecordSection label="해본 대응" value={note.actions} />}
                  {note.result && <RecordSection label="결과" value={note.result} />}
                  {note.hospitalGuide && <RecordSection label="병원 안내·다음 진료 기준" value={note.hospitalGuide} />}
                </article>
              ))}
              {data.careNotes.length === 0 && (
                <Empty title="아직 기록이 없어요" text="다음에 비슷한 상황이 왔을 때 도움이 되도록 남겨보세요." />
              )}
            </section>
          </section>
        )}

        {tab === 'development' && (
          <section className="featurePage">
            <button className="backToMore" type="button" onClick={() => setTab('more')}>‹ 더보기</button>

            <section className="pageCard">
              <h2>발달 기록 추가</h2>
              <div className="featureFormGrid">
                <Field label="날짜">
                  <input
                    type="date"
                    value={developmentForm.date}
                    onChange={(e) => setDevelopmentForm({ ...developmentForm, date: e.target.value })}
                  />
                </Field>
                <Field label="영역">
                  <select
                    value={developmentForm.category}
                    onChange={(e) => setDevelopmentForm({ ...developmentForm, category: e.target.value })}
                  >
                    {['대근육', '소근육', '언어', '인지', '사회성', '식사 기술', '기타'].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </Field>
                <Field label="상태">
                  <select
                    value={developmentForm.status}
                    onChange={(e) => setDevelopmentForm({ ...developmentForm, status: e.target.value })}
                  >
                    {['처음 성공', '요즘 자주 함', '사라짐', '다시 시작', '관찰'].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </Field>
                <Field label="교정 월령">
                  <input
                    value={developmentForm.correctedAge}
                    onChange={(e) => setDevelopmentForm({ ...developmentForm, correctedAge: e.target.value })}
                    placeholder="예: 교정 12개월"
                  />
                </Field>
                <Field label="기록 제목">
                  <input
                    value={developmentForm.title}
                    onChange={(e) => setDevelopmentForm({ ...developmentForm, title: e.target.value })}
                    placeholder="예: 블록 8개를 통에 넣음"
                  />
                </Field>
                <Field label="상세 메모">
                  <textarea
                    rows="3"
                    value={developmentForm.note}
                    onChange={(e) => setDevelopmentForm({ ...developmentForm, note: e.target.value })}
                    placeholder="상황, 힌트 여부, 반복 횟수 등을 기록"
                  />
                </Field>
              </div>
              <div className="formActions"><button onClick={addDevelopmentRecord}>기록 저장</button></div>
            </section>

            <div className="developmentFilter">
              {['전체', '대근육', '소근육', '언어', '인지', '사회성', '식사 기술', '기타'].map((item) => (
                <button
                  type="button"
                  key={item}
                  className={developmentFilter === item ? 'active' : ''}
                  onClick={() => setDevelopmentFilter(item)}
                >{item}</button>
              ))}
            </div>

            <section className="developmentTimeline">
              {data.developmentRecords
                .filter((item) => developmentFilter === '전체' || item.category === developmentFilter)
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                .map((record) => (
                  <article className="developmentRecord" key={record.id}>
                    <div className="timelineDot" />
                    <div className="developmentCard">
                      <div className="recordHead">
                        <div>
                          <small>{record.date}{record.correctedAge ? ` · ${record.correctedAge}` : ''}</small>
                          <h3>{record.title}</h3>
                        </div>
                        <button className="delete" onClick={() => updateData({
                          developmentRecords: data.developmentRecords.filter((x) => x.id !== record.id),
                        })}>삭제</button>
                      </div>
                      <div className="recordTags">
                        <span>{record.category}</span>
                        <span>{record.status}</span>
                      </div>
                      {record.note && <p>{record.note}</p>}
                    </div>
                  </article>
                ))}
              {data.developmentRecords.filter(
                (item) => developmentFilter === '전체' || item.category === developmentFilter,
              ).length === 0 && (
                <Empty title="해당 기록이 없어요" text="작은 변화도 날짜와 함께 남겨보세요." />
              )}
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
        <Nav label="퀘스트" icon="🪙" active={tab === 'wipeQuest'} onClick={() => setTab('wipeQuest')} />
        <Nav label="Stock" icon="▣" active={tab === 'stock'} onClick={() => setTab('stock')} />
        <Nav
          label="더보기"
          icon="•••"
          active={['more', 'need', 'houseMap', 'careNotes', 'development'].includes(tab)}
          badge={data.needs.filter((item) => !item.purchased).length}
          onClick={() => setTab('more')}
        />
      </nav>
    </div>
  )
}

function normalizeState(value) {
  const parsed = value && typeof value === 'object' ? value : {}
  return {
    ...defaultState,
    ...parsed,
    stockCategories: parsed.stockCategories?.length
      ? parsed.stockCategories
      : Array.from(new Set([...defaultCategories, ...(parsed.stock || []).map((item) => item.category).filter(Boolean)])),
    todos: normalizeTodos(parsed.todos || defaultState.todos),
    stock: (parsed.stock || defaultState.stock).map((item) => ({
      storageLocation: '',
      noExpiry: !item.expiryDate,
      ...item,
    })),
    houseLocations: Array.isArray(parsed.houseLocations) ? parsed.houseLocations : [],
    careNotes: Array.isArray(parsed.careNotes) ? parsed.careNotes : [],
    developmentRecords: Array.isArray(parsed.developmentRecords) ? parsed.developmentRecords : [],
    wipeQuest: {
      ...defaultState.wipeQuest,
      ...(parsed.wipeQuest && typeof parsed.wipeQuest === 'object' ? parsed.wipeQuest : {}),
      unitPrice: 35,
      transferTarget: 10000,
    },
  }
}


function normalizeTodos(items) {
  const prepared = items.map((item, index) => ({
    createdAt: Date.now() - (items.length - index),
    inProgress: false,
    ...item,
  }))
  const bucketOrder = [...new Set(prepared.map((item) => item.bucket))]
  return bucketOrder.flatMap((bucket) => {
    const bucketItems = prepared.filter((item) => item.bucket === bucket)
    return [
      ...bucketItems.filter((item) => !item.done && item.inProgress),
      ...bucketItems.filter((item) => !item.done && !item.inProgress && item.important),
      ...bucketItems.filter((item) => !item.done && !item.inProgress && !item.important),
      ...bucketItems.filter((item) => item.done),
    ]
  })
}

function blankStockForm(category = defaultCategories[0]) {
  return {
    name: '',
    category,
    quantity: 1,
    unit: '개',
    threshold: 0,
    storageLocation: '',
    expiryDate: '',
    noExpiry: false,
    alertDays: 3,
    autoNeed: false,
  }
}

function isExpiring(item) {
  if (item.noExpiry || !item.expiryDate) return false
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

function RecordSection({ label, value }) {
  return (
    <section className="recordSection">
      <strong>{label}</strong>
      <p>{value}</p>
    </section>
  )
}

function Nav({ label, icon, active, badge = 0, onClick }) {
  return (
    <button className={active ? 'navButton active' : 'navButton'} onClick={onClick}>
      <span className="navIconWrap">
        <span className="navIcon">{icon}</span>
        {badge > 0 && <span className="navBadge">{badge > 99 ? '99+' : badge}</span>}
      </span>
      <span>{label}</span>
    </button>
  )
}

function titleFor(tab) {
  return { home: '오늘도 가볍게.', todo: 'Todo', meals: 'Meals', stock: 'Stock', need: 'Need', more: '더보기', houseMap: '집안 위치도', careNotes: '증상 대응 노트', development: '발달 기록', wipeQuest: '물티슈 절약 퀘스트' }[tab]
}

function subtitleFor(tab) {
  return {
    home: '해야 할 일과 집안 흐름을 한곳에서 정리해요.',
    todo: '오늘과 다음을 가볍게 정리해요.',
    meals: '이번 주 식단과 메뉴 반응을 한눈에.',
    stock: '부족 기준과 유통기한을 함께 관리해요.',
    need: '사야 할 것과 구매 완료를 나눠봐요.',
    more: '생활과 육아 기록을 한곳에 모았어요.',
    houseMap: '방과 수납 위치를 차근차근 정리해요.',
    careNotes: '우리 아이에게 있었던 증상과 대응을 남겨요.',
    development: '작은 변화도 날짜와 함께 기록해요.',
    wipeQuest: '한 장씩 아껴서 진짜 돈으로 모아봐요.',
  }[tab]
}

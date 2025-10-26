# DB-First Type Generation для Scrimspec

## 🎯 Принцип "DB-First"

**База данных Supabase является единственным источником истины.** Все типы TypeScript генерируются напрямую из живой базы данных, а не из схемы кода.

## 🚀 Использование

### Единственная команда для генерации типов:

```bash
# Из корня проекта
pnpm types:pull

# Или из packages/db
cd packages/db
pnpm types:pull
```

## 📋 Что происходит при выполнении команды

1. **Подключение к Supabase** - скрипт подключается к живой базе данных
2. **Генерация типов** - создаются TypeScript типы для всех схем:
   - `public`
   - `jobs` 
   - `studio`
   - `generation_pipeline`
   - `aes_core`
   - `analytics`
3. **Сохранение** - типы сохраняются в `packages/db/src/types/database.types.ts`

## ⚙️ Настройка

### Переменные окружения (.env)

```env
SUPABASE_ACCESS_TOKEN=your_access_token
SUPABASE_PROJECT_REF=cuwdjemjuszaaxpouprc
```

### Установка/обновление Supabase CLI

```bash
# Windows (PowerShell)
winget install Supabase.CLI

# macOS (Homebrew)
brew install supabase/tap/supabase

# Linux (Snap)
snap install supabase

# Или через npm (локально в проекте)
npm install supabase@latest
```

## 🔄 Workflow

1. **Изменение базы данных** - вносите изменения через Supabase Dashboard или SQL Editor
2. **Генерация типов** - запускайте `pnpm types:pull`
3. **Использование типов** - импортируйте типы в коде:

```typescript
import { Database } from '@scrimspec/db/types/database.types';

type Task = Database['public']['Tables']['tasks']['Row'];
type NewTask = Database['public']['Tables']['tasks']['Insert'];
```

## 🎯 Принципы

- ✅ **База данных = источник истины**
- ✅ **Одна команда для всех типов**
- ✅ **Простота и ясность**
- ❌ **Нет сложной синхронизации**
- ❌ **Нет генерации из схемы кода**

## 🐛 Решение проблем

### Ошибка подключения
```bash
# Проверьте токен доступа
echo $SUPABASE_ACCESS_TOKEN

# Обновите CLI
npm install -g supabase@latest
```

### Проблемы с типами
```bash
# Очистите и перегенерируйте
rm -rf packages/db/src/types
pnpm types:pull
```

## 📞 Поддержка

При проблемах проверьте:
1. Правильность `SUPABASE_ACCESS_TOKEN`
2. Версию Supabase CLI (`supabase --version`)
3. Подключение к интернету
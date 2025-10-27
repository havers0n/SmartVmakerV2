# Страница Ingest - Документация

## Описание
Страница Ingest предоставляет пользовательский интерфейс для запуска поиска и ингеста YouTube видео через Action `ingest.startSearch`.

## Архитектура

### 1. API-клиент (`apps/dashboard/src/shared/api/actions.ts`)
- **Функция**: `callAction<T>(action: string, payload: unknown)`
- **Назначение**: Универсальная функция для вызова Actions через Action Runner
- **Обработка ошибок**: Автоматическое перебрасывание ошибок с контекстом
- **Специализированная функция**: `startIngestSearch(query: string)` для удобства

### 2. UI-компонент (`apps/dashboard/src/features/ingest/StartIngestForm.tsx`)
- **Компонент**: `StartIngestForm`
- **Технологии**: React Hook Form + Zod + shadcn/ui
- **Функциональность**:
  - Валидация формы (минимум 3 символа)
  - Отправка запроса через API-клиент
  - Показ уведомлений об успехе/ошибке
  - Очистка формы после успешного сабмита
  - Состояние загрузки

### 3. Страница (`apps/dashboard/app/ingest/page.tsx`)
- **Путь**: `/ingest`
- **Компоненты**: StartIngestForm + информационные секции
- **Аутентификация**: Автоматическая через AuthProvider
- **Дизайн**: Responsive layout с Tailwind CSS

## Использование

### Доступ к странице
1. Откройте браузер и перейдите на `http://localhost:3000/ingest`
2. Если не авторизованы, будет перенаправление на `/login`
3. После авторизации откроется страница Ingest

### Запуск поиска
1. Введите поисковый запрос в поле "Поисковый запрос"
2. Минимум 3 символа (валидация на фронтенде и бэкенде)
3. Нажмите кнопку "Запустить поиск"
4. Дождитесь уведомления об успехе или ошибке

### Примеры запросов
- `funny cats compilation`
- `cooking tutorial`
- `music video`
- `tech review`

## UI/UX особенности

### Форма
- **Валидация в реальном времени**: Показ ошибок при вводе
- **Состояние загрузки**: Кнопка показывает "Запуск поиска..." во время обработки
- **Автоочистка**: Форма очищается после успешного сабмита
- **Accessibility**: Правильные labels и ARIA-атрибуты

### Уведомления
- **Успех**: Зеленое уведомление с Job ID
- **Ошибка**: Красное уведомление с описанием ошибки
- **Автозакрытие**: Уведомления исчезают автоматически

### Информационные секции
- **Как это работает**: Объяснение процесса в 3 шага
- **Статус системы**: Показ состояния очередей и обработки

## Технические детали

### Зависимости
```json
{
  "react-hook-form": "^7.55.0",
  "@hookform/resolvers": "^5.2.2",
  "zod": "^3.22.0",
  "@scrimspec/core-domain": "workspace:*"
}
```

### Импорты
```typescript
// API-клиент
import { startIngestSearch } from '@/shared/api/actions';

// UI компоненты
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';

// Уведомления
import { useToast } from '@/shared/hooks/use-toast';
```

### Схема валидации
```typescript
const ingestFormSchema = z.object({
  query: z.string().min(3, 'Поисковый запрос должен содержать минимум 3 символа'),
});
```

## Интеграция с Action Runner

### Запрос к API
```typescript
const result = await startIngestSearch(values.query);
// Эквивалентно:
const result = await callAction('ingest.startSearch', { query: values.query });
```

### Ответ сервера
```typescript
{
  message: "Ingest job started successfully",
  jobId: "uuid-generated-job-id"
}
```

### Обработка ошибок
- **Валидация**: Ошибки Zod отображаются под полем
- **Сеть**: Ошибки соединения показываются в toast
- **Сервер**: Ошибки API отображаются с деталями

## Расширение функциональности

### Добавление новых полей
1. Обновить схему валидации в `StartIngestForm.tsx`
2. Добавить поля в форму
3. Обновить схему в `core-domain`
4. Обновить обработчик в Action Runner

### Добавление новых Actions
1. Создать новую функцию в `actions.ts`
2. Добавить обработчик в Action Runner
3. Создать новый компонент формы
4. Интегрировать в страницу

## Безопасность
- **Аутентификация**: Автоматическая проверка через AuthProvider
- **Валидация**: Двойная валидация на фронтенде и бэкенде
- **Типизация**: Полная типизация TypeScript
- **Обработка ошибок**: Безопасная обработка без утечки данных

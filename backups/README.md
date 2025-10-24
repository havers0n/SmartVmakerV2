# Database Backups - ScrimSpec

Инструкции по созданию и восстановлению резервных копий базы данных.

---

## 🚀 Быстрый старт

### Windows (PowerShell):
```powershell
.\backups\dump_database.ps1 -Password "YOUR_DB_PASSWORD"
```

### Linux/Mac (Bash):
```bash
./backups/dump_database.sh YOUR_DB_PASSWORD
```

---

## 📦 Что создаётся

После выполнения скрипта будут созданы 3 файла:

1. **`full_backup_YYYYMMDD_HHMMSS.sql`**
   - Полная резервная копия (схема + данные)
   - Исключены: `audit_log`, `id_uuid_mapping` (большие таблицы)
   - Использовать для полного восстановления

2. **`schema_YYYYMMDD_HHMMSS.sql`**
   - Только структура БД (таблицы, индексы, функции, views)
   - Без данных
   - Использовать для развёртывания новой БД

3. **`data_YYYYMMDD_HHMMSS.sql`**
   - Только данные (без структуры)
   - Использовать для переноса данных

---

## 🔑 Получение пароля БД

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите проект **video** (cuwdjemjuszaaxpouprc)
3. Settings → Database → Database password
4. Используйте этот пароль в скриптах

---

## 📋 Альтернативные методы

### 1. Через Supabase Dashboard

1. Откройте Dashboard → Database → Backups
2. Нажмите "Create backup"
3. Скачайте файл после создания

### 2. Через Supabase CLI

```bash
# Установить CLI (если ещё не установлен)
npm install -g supabase

# Создать дамп
supabase db dump --project-ref cuwdjemjuszaaxpouprc --file backups/db_dump.sql
```

### 3. Вручную через pg_dump

```bash
pg_dump \
  --host=aws-1-ap-south-1.pooler.supabase.com \
  --port=6543 \
  --username=postgres.cuwdjemjuszaaxpouprc \
  --dbname=postgres \
  --schema=public \
  --no-owner \
  --no-privileges \
  --file=backups/manual_backup.sql
```

---

## 🔄 Восстановление из бэкапа

### Восстановить полную БД

```bash
# ВНИМАНИЕ: Это перезапишет все данные!

psql \
  --host=aws-1-ap-south-1.pooler.supabase.com \
  --port=6543 \
  --username=postgres.cuwdjemjuszaaxpouprc \
  --dbname=postgres \
  < backups/full_backup_20251024_220000.sql
```

### Восстановить только схему

```bash
psql \
  --host=aws-1-ap-south-1.pooler.supabase.com \
  --port=6543 \
  --username=postgres.cuwdjemjuszaaxpouprc \
  --dbname=postgres \
  < backups/schema_20251024_220000.sql
```

### Восстановить только данные

```bash
psql \
  --host=aws-1-ap-south-1.pooler.supabase.com \
  --port=6543 \
  --username=postgres.cuwdjemjuszaaxpouprc \
  --dbname=postgres \
  < backups/data_20251024_220000.sql
```

---

## 📊 Информация о БД

| Параметр | Значение |
|----------|----------|
| **Project** | video (cuwdjemjuszaaxpouprc) |
| **Region** | South Asia (Mumbai) |
| **Host** | aws-1-ap-south-1.pooler.supabase.com |
| **Port** | 6543 (connection pooler) |
| **Database** | postgres |
| **Schema** | public |

---

## 🗂️ Что исключено из бэкапа

По умолчанию скрипты исключают следующие таблицы:

1. **`audit_log`**
   - Очень большая (растёт со временем)
   - Можно восстановить из cron jobs
   - Сохраняется только структура

2. **`id_uuid_mapping`**
   - Вспомогательная таблица для миграции
   - Может быть пересоздана автоматически
   - Сохраняется только структура

**Если нужно включить эти таблицы**, удалите строки `--exclude-table-data` из скриптов.

---

## 🔐 Безопасность

### ⚠️ ВАЖНО

- **НЕ коммитьте** бэкапы в Git (они содержат данные!)
- Файлы в `backups/*.sql` уже добавлены в `.gitignore`
- **НЕ передавайте** пароль БД через незащищённые каналы
- Храните бэкапы в безопасном месте (шифрованное хранилище)

### Рекомендации

```bash
# Зашифровать бэкап (GPG)
gpg --symmetric --cipher-algo AES256 backups/full_backup_20251024_220000.sql

# Загрузить в облако (Google Drive, Dropbox, S3)
# Использовать Supabase Storage для хранения
```

---

## 📅 Автоматические бэкапы

### Через Supabase (встроенные)

Supabase автоматически создаёт бэкапы:
- **Daily backups** - хранятся 7 дней
- **Weekly backups** - хранятся 4 недели
- **Point-in-time recovery (PITR)** - доступно на Pro плане

Настройка: Dashboard → Database → Backups

### Через Cron (локально)

```bash
# Добавить в crontab (Linux/Mac)
0 2 * * * cd /path/to/scrimspec && ./backups/dump_database.sh YOUR_PASSWORD

# Task Scheduler (Windows)
# Создать задачу с запуском PowerShell скрипта
```

---

## 🛠️ Troubleshooting

### "pg_dump: command not found"

**Решение:** Установить PostgreSQL client tools

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# Mac (Homebrew)
brew install postgresql

# Windows
# Скачать с https://www.postgresql.org/download/windows/
```

### "Connection timeout"

**Решение:**
1. Проверить firewall/VPN
2. Убедиться что IP разрешён в Supabase (Dashboard → Settings → Database → Connection Pooling)
3. Попробовать через Direct connection (port 5432) вместо Pooler (6543)

### "Permission denied"

**Решение:**
1. Проверить пароль БД
2. Убедиться что пользователь `postgres.cuwdjemjuszaaxpouprc` существует
3. Проверить права доступа к schema `public`

---

## 📝 Логи и мониторинг

### Проверить последний бэкап

```bash
ls -lth backups/*.sql | head -3
```

### Проверить размер бэкапа

```bash
du -h backups/full_backup_*.sql
```

### Проверить содержимое (без восстановления)

```bash
head -50 backups/full_backup_20251024_220000.sql
```

---

## 🔗 Полезные ссылки

- [Supabase Backups Documentation](https://supabase.com/docs/guides/platform/backups)
- [pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

---

## 📧 Поддержка

При проблемах с бэкапами:
1. Проверить `.claude/settings.local.json` для актуальных credentials
2. Обратиться к [Supabase Support](https://supabase.com/docs/guides/platform/support)
3. Посмотреть логи: Dashboard → Project → Logs

---

**Последнее обновление:** 2025-10-24
**Версия БД:** 34 migrations applied

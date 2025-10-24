# 🚀 Как создать бэкап базы данных - Быстрая инструкция

## Шаг 1: Получить пароль БД

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите проект **video**
3. Перейдите в **Settings** → **Database**
4. Скопируйте **Database password** (если забыли - нажмите "Reset password")

## Шаг 2: Запустить скрипт бэкапа

### На Windows:

```powershell
cd C:\Projects\scrimspec

# Вставьте ваш пароль вместо YOUR_PASSWORD
.\backups\dump_database.ps1 -Password "YOUR_PASSWORD"
```

### На Linux/Mac:

```bash
cd /path/to/scrimspec

# Вставьте ваш пароль вместо YOUR_PASSWORD
./backups/dump_database.sh YOUR_PASSWORD
```

## Шаг 3: Проверить результат

Будут созданы 3 файла в папке `backups/`:

```
backups/
  ├── full_backup_20251024_223045.sql   (схема + данные)
  ├── schema_20251024_223045.sql        (только структура)
  └── data_20251024_223045.sql          (только данные)
```

## 📊 Ожидаемый размер

При текущем объёме данных (~1MB):
- Full backup: ~500-800 KB
- Schema: ~200-300 KB
- Data: ~100-200 KB

## ⚠️ Важно!

- **НЕ коммитьте** файлы `*.sql` в Git (они уже в .gitignore)
- **НЕ передавайте** пароль БД через незащищённые каналы
- Храните бэкапы в безопасном месте

## 🔄 Альтернативный метод (через Supabase Dashboard)

Если скрипты не работают:

1. Dashboard → Database → Backups
2. Нажмите "Create backup now"
3. Дождитесь завершения
4. Скачайте файл

---

**Полная документация:** `backups/README.md`

import React from 'react';
import { StartIngestForm } from '@/features/ingest/StartIngestForm';

/**
 * Страница Ingest - запуск поиска и ингеста YouTube видео
 */
export default function IngestPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        {/* Заголовок страницы */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Ingest</h1>
          <p className="text-muted-foreground mt-2">
            Поиск и загрузка видео с YouTube для анализа и генерации контента
          </p>
        </div>

        {/* Основной контент */}
        <div className="grid gap-8">
          {/* Форма запуска поиска */}
          <div className="flex justify-center">
            <StartIngestForm />
          </div>

          {/* Информационная секция */}
          <div className="bg-muted/50 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Как это работает</h2>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <h3 className="font-medium text-primary">1. Поиск</h3>
                <p className="text-muted-foreground">
                  Введите поисковый запрос, и система найдет релевантные видео на YouTube
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-primary">2. Загрузка</h3>
                <p className="text-muted-foreground">
                  Видео будут загружены и добавлены в очередь для дальнейшей обработки
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-primary">3. Анализ</h3>
                <p className="text-muted-foreground">
                  После загрузки видео пройдут анализ для извлечения метаданных и контента
                </p>
              </div>
            </div>
          </div>

          {/* Статус системы */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Статус системы</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Очередь ингеста</span>
                  <span className="text-sm text-muted-foreground">Активна</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Обработка видео</span>
                  <span className="text-sm text-muted-foreground">Работает</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Последний поиск</span>
                  <span className="text-sm text-muted-foreground">Недавно</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Всего видео</span>
                  <span className="text-sm text-muted-foreground">Загружается...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
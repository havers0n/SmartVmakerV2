'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription 
} from '@/shared/components/ui/form';
import { useToast } from '@/shared/hooks/use-toast';
import { startIngestSearch } from '@/shared/api/actions';

// Схема валидации формы - соответствует startSearchPayloadSchema
const ingestFormSchema = z.object({
  query: z.string().min(3, 'Поисковый запрос должен содержать минимум 3 символа'),
  order: z.enum(['date', 'rating', 'relevance', 'viewCount']).optional(),
  videoDuration: z.enum(['any', 'short', 'medium', 'long']).optional(),
  maxResults: z.number().min(1).max(50).optional(),
  publishedAfter: z.string().optional(),
  safeSearch: z.enum(['none', 'moderate', 'strict']).optional(),
  videoDefinition: z.enum(['any', 'high', 'standard']).optional(),
});

type IngestFormValues = z.infer<typeof ingestFormSchema>;

/**
 * Компонент формы для запуска поиска и ингеста YouTube видео
 */
export function StartIngestForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<IngestFormValues>({
    resolver: zodResolver(ingestFormSchema),
    defaultValues: {
      query: '',
      order: 'date',
      videoDuration: 'any',
      maxResults: 25,
      safeSearch: 'moderate',
      videoDefinition: 'any',
    },
  });

  const onSubmit = async (values: IngestFormValues) => {
    setIsSubmitting(true);

    try {
      // Подготовка payload со всеми параметрами
      const payload = {
        query: values.query,
        order: values.order,
        videoDuration: values.videoDuration,
        maxResults: values.maxResults,
        publishedAfter: values.publishedAfter
          ? new Date(values.publishedAfter).toISOString()
          : undefined,
        safeSearch: values.safeSearch,
        videoDefinition: values.videoDefinition,
      };

      const result = await startIngestSearch(payload);

      toast({
        title: 'Успешно!',
        description: `${result.message} Job ID: ${result.jobId}`,
      });

      // Очищаем форму после успешного сабмита
      form.reset();

    } catch (error) {
      console.error('Error starting ingest search:', error);

      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Произошла неизвестная ошибка',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Запуск поиска YouTube</CardTitle>
        <CardDescription>
          Настройте параметры поиска для ингеста видео с YouTube
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="query"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Поисковый запрос</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Например: funny cats compilation"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Минимум 3 символа. Система найдет и загрузит видео по этому запросу.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Сортировка</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger disabled={isSubmitting}>
                          <SelectValue placeholder="По дате" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="date">По дате</SelectItem>
                        <SelectItem value="relevance">По релевантности</SelectItem>
                        <SelectItem value="viewCount">По просмотрам</SelectItem>
                        <SelectItem value="rating">По рейтингу</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="videoDuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Длительность</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger disabled={isSubmitting}>
                          <SelectValue placeholder="Любая" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="any">Любая</SelectItem>
                        <SelectItem value="short">Короткие (&lt;4 мин)</SelectItem>
                        <SelectItem value="medium">Средние (4-20 мин)</SelectItem>
                        <SelectItem value="long">Длинные (&gt;20 мин)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="maxResults"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Макс. результатов</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        placeholder="25"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>1-50 видео</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="safeSearch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Безопасный поиск</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger disabled={isSubmitting}>
                          <SelectValue placeholder="Умеренный" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Отключен</SelectItem>
                        <SelectItem value="moderate">Умеренный</SelectItem>
                        <SelectItem value="strict">Строгий</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="publishedAfter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Опубликовано после</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>Опционально</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="videoDefinition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Качество</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger disabled={isSubmitting}>
                          <SelectValue placeholder="Любое" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="any">Любое</SelectItem>
                        <SelectItem value="high">HD</SelectItem>
                        <SelectItem value="standard">SD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Запуск поиска...' : 'Запустить поиск'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

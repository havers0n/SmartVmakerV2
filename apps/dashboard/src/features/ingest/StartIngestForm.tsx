'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
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

// Схема валидации формы
const ingestFormSchema = z.object({
  query: z.string().min(3, 'Поисковый запрос должен содержать минимум 3 символа'),
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
    },
  });

  const onSubmit = async (values: IngestFormValues) => {
    setIsSubmitting(true);
    
    try {
      const result = await startIngestSearch(values.query);
      
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
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Запуск поиска YouTube</CardTitle>
        <CardDescription>
          Введите поисковый запрос для начала ингеста видео с YouTube
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

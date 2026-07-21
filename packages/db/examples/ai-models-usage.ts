/**
 * Примеры использования таблиц ai_providers и ai_models
 *
 * Запуск: tsx packages/db/examples/ai-models-usage.ts
 */

import { getDrizzleClient } from '../src/client';
import { aiProviders, aiModels } from '../migrations/schema';
import { eq, and } from 'drizzle-orm';

const db = getDrizzleClient();

// ============================================
// Пример 1: Получить все провайдеры
// ============================================
async function getAllProviders() {
  console.log('\n📦 Все AI провайдеры:');

  const providers = await db
    .select()
    .from(aiProviders);

  providers.forEach(p => {
    console.log(`  - ${p.name} (${p.id})`);
    console.log(`    API: ${p.apiBaseUrl || 'N/A'}`);
    console.log(`    Auth: ${p.authenticationType}`);
    console.log(`    Env var: ${p.apiKeyEnvVarName}`);
  });
}

// ============================================
// Пример 2: Получить все модели с провайдерами
// ============================================
async function getAllModelsWithProviders() {
  console.log('\n🤖 Все AI модели:');

  const modelsWithProviders = await db
    .select({
      modelId: aiModels.id,
      modelName: aiModels.name,
      modelType: aiModels.type,
      isDefault: aiModels.isDefault,
      isEnabled: aiModels.isEnabled,
      providerName: aiProviders.name,
      providerId: aiProviders.id,
    })
    .from(aiModels)
    .leftJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
    .orderBy(aiProviders.name, aiModels.type);

  modelsWithProviders.forEach(m => {
    const status = m.isEnabled ? '✅' : '❌';
    const defaultBadge = m.isDefault ? ' [DEFAULT]' : '';
    console.log(`  ${status} ${m.providerName} - ${m.modelName}${defaultBadge}`);
    console.log(`     Type: ${m.modelType}`);
    console.log(`     ID: ${m.modelId}`);
  });
}

// ============================================
// Пример 3: Получить модель по умолчанию для типа
// ============================================
async function getDefaultModelForType(modelType: string) {
  console.log(`\n🎯 Модель по умолчанию для типа "${modelType}":`);

  const [defaultModel] = await db
    .select({
      model: aiModels,
      provider: aiProviders,
    })
    .from(aiModels)
    .leftJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
    .where(
      and(
        eq(aiModels.type, modelType as any),
        eq(aiModels.isDefault, true),
        eq(aiModels.isEnabled, true)
      )
    )
    .limit(1);

  if (defaultModel) {
    console.log(`  ✓ ${defaultModel.provider?.name} - ${defaultModel.model.name}`);
    console.log(`    ID: ${defaultModel.model.id}`);
    console.log(`    Capabilities: ${defaultModel.model.capabilities?.join(', ')}`);
  } else {
    console.log('  ✗ Модель не найдена');
  }

  return defaultModel;
}

// ============================================
// Пример 4: Получить все модели провайдера
// ============================================
async function getProviderModels(providerId: string) {
  console.log(`\n🔍 Модели провайдера "${providerId}":`);

  const models = await db
    .select()
    .from(aiModels)
    .where(
      and(
        eq(aiModels.providerId, providerId),
        eq(aiModels.isEnabled, true)
      )
    );

  models.forEach(m => {
    const defaultBadge = m.isDefault ? ' ⭐ DEFAULT' : '';
    console.log(`  • ${m.name}${defaultBadge}`);
    console.log(`    Type: ${m.type}`);
    console.log(`    Capabilities: ${m.capabilities?.join(', ') || 'None'}`);

    // Показать стоимость
    const cost = m.costDetails as any;
    if (cost) {
      console.log(`    Cost: ${JSON.stringify(cost)}`);
    }
  });

  return models;
}

// ============================================
// Пример 5: Создать AI клиент на основе модели
// ============================================
async function createAIClientForModel(modelId: string) {
  console.log(`\n🚀 Создание клиента для модели "${modelId}":`);

  const [result] = await db
    .select({
      model: aiModels,
      provider: aiProviders,
    })
    .from(aiModels)
    .leftJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
    .where(eq(aiModels.id, modelId))
    .limit(1);

  if (!result) {
    console.log('  ✗ Модель не найдена');
    return null;
  }

  const { model, provider } = result;

  if (!provider) {
    console.log('  ✗ Провайдер не найден');
    return null;
  }

  console.log(`  ✓ Модель: ${model.name}`);
  console.log(`  ✓ Провайдер: ${provider.name}`);
  console.log(`  ✓ API URL: ${provider.apiBaseUrl}`);
  console.log(`  ✓ Auth type: ${provider.authenticationType}`);
  console.log(`  ✓ Env var: ${provider.apiKeyEnvVarName}`);

  const apiKey = process.env[provider.apiKeyEnvVarName];

  if (!apiKey) {
    console.log(`  ⚠️  WARNING: API key not found in environment (${provider.apiKeyEnvVarName})`);
  } else {
    console.log(`  ✓ API key found: ${apiKey.substring(0, 10)}...`);
  }

  return {
    model,
    provider,
    apiKey,
  };
}

// ============================================
// Пример 6: Найти самую дешевую модель для типа
// ============================================
async function getCheapestModelForType(modelType: string) {
  console.log(`\n💰 Самая дешевая модель для типа "${modelType}":`);

  const models = await db
    .select({
      model: aiModels,
      provider: aiProviders,
    })
    .from(aiModels)
    .leftJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
    .where(
      and(
        eq(aiModels.type, modelType as any),
        eq(aiModels.isEnabled, true)
      )
    );

  if (models.length === 0) {
    console.log('  ✗ Модели не найдены');
    return null;
  }

  // Простая логика: найти модель с минимальной ценой за входные токены
  const cheapest = models.reduce((prev, current) => {
    const prevCost = (prev.model.costDetails as any)?.input_price_per_1m_tokens || Infinity;
    const currentCost = (current.model.costDetails as any)?.input_price_per_1m_tokens || Infinity;
    return currentCost < prevCost ? current : prev;
  });

  console.log(`  ✓ ${cheapest.provider?.name} - ${cheapest.model.name}`);
  console.log(`    Cost details: ${JSON.stringify(cheapest.model.costDetails)}`);

  return cheapest;
}

// ============================================
// Пример 7: Проверить доступность модели
// ============================================
async function checkModelAvailability(modelId: string) {
  console.log(`\n🔎 Проверка доступности модели "${modelId}":`);

  const [result] = await db
    .select({
      model: aiModels,
      provider: aiProviders,
    })
    .from(aiModels)
    .leftJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
    .where(eq(aiModels.id, modelId))
    .limit(1);

  if (!result) {
    console.log('  ✗ Модель не найдена в базе данных');
    return false;
  }

  const { model, provider } = result;

  console.log(`  ℹ️  Модель: ${model.name}`);
  console.log(`  ℹ️  Провайдер: ${provider?.name}`);

  // Проверки
  const checks = {
    'Модель активна (is_enabled)': model.isEnabled,
    'Провайдер найден': !!provider,
    'API URL задан': !!provider?.apiBaseUrl,
    'API ключ в окружении': !!process.env[provider?.apiKeyEnvVarName || ''],
  };

  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${check}`);
  });

  const allPassed = Object.values(checks).every(v => v);

  if (allPassed) {
    console.log('\n  ✅ Модель полностью готова к использованию!');
  } else {
    console.log('\n  ⚠️  Модель не готова к использованию');
  }

  return allPassed;
}

// ============================================
// Главная функция для запуска примеров
// ============================================
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   AI Providers & Models - Примеры использования       ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  try {
    // Запустить все примеры
    await getAllProviders();
    await getAllModelsWithProviders();

    await getDefaultModelForType('text-to-image');
    await getDefaultModelForType('text-to-text');

    await getProviderModels('minimax');
    await getProviderModels('google_gemini');

    await createAIClientForModel('minimax-m2');
    await createAIClientForModel('gemini-2.5-flash-image');

    await getCheapestModelForType('text-to-text');

    await checkModelAvailability('minimax-halu-video');

    console.log('\n✅ Все примеры выполнены успешно!');
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n👋 Готово!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export {
  getAllProviders,
  getAllModelsWithProviders,
  getDefaultModelForType,
  getProviderModels,
  createAIClientForModel,
  getCheapestModelForType,
  checkModelAvailability,
};

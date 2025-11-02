/**
 * Test Script for MiniMax Text Generation with Function Calling
 *
 * Run with: pnpm test:text
 *
 * Make sure to set MINIMAX_API_KEY environment variable
 */

import {
  createTextClient,
  generateScenariosWithTools,
  generateSimpleText,
  generateScenariosWithToolsStreaming,
} from './src/text';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

// ============================================================================
// Configuration
// ============================================================================

const API_KEY = process.env.MINIMAX_API_KEY;

if (!API_KEY) {
  console.error('❌ Error: MINIMAX_API_KEY environment variable is not set');
  console.log('\nPlease set it with:');
  console.log('  export MINIMAX_API_KEY=your_api_key_here');
  process.exit(1);
}

// ============================================================================
// Test Functions
// ============================================================================

/**
 * Test 1: Simple text generation without tools
 */
async function testSimpleGeneration() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: Simple Text Generation (No Tools)');
  console.log('='.repeat(80) + '\n');

  const client = createTextClient({ apiKey: API_KEY });

  const prompt = 'Explain what is MiniMax-M2 model in one sentence.';
  console.log(`📝 Prompt: ${prompt}\n`);

  try {
    const text = await generateSimpleText(client, prompt, {
      maxTokens: 200,
      temperature: 0.7,
    });

    console.log(`✅ Response:\n${text}\n`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Test 2: Function calling with scenario generation tool
 */
async function testFunctionCalling() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Function Calling - Scenario Generation');
  console.log('='.repeat(80) + '\n');

  const client = createTextClient({ apiKey: API_KEY });

  // Define a tool for generating video scenarios
  const tools: ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'generate_video_scenarios',
        description: 'Generate structured video scenarios with scenes, emotions, and AES (Attention-Emotion-Solution) scoring',
        parameters: {
          type: 'object',
          properties: {
            scenarios: {
              type: 'array',
              description: 'Array of scenario objects',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Scenario title' },
                  description: { type: 'string', description: 'Brief scenario description' },
                  aesScore: { type: 'number', description: 'AES score (0-100)' },
                  hookStrength: { type: 'number', description: 'Hook strength (0-100)' },
                  emotionalCurve: {
                    type: 'array',
                    description: 'Emotional progression',
                    items: { type: 'string' },
                  },
                  scenes: {
                    type: 'array',
                    description: 'Array of scenes',
                    items: {
                      type: 'object',
                      properties: {
                        phase: { type: 'string', description: 'Scene phase (e.g., Opening, Build, Climax)' },
                        duration: { type: 'number', description: 'Scene duration in seconds' },
                        description: { type: 'string', description: 'Visual description' },
                      },
                      required: ['phase', 'duration', 'description'],
                    },
                  },
                },
                required: ['title', 'description', 'aesScore', 'hookStrength', 'emotionalCurve', 'scenes'],
              },
            },
          },
          required: ['scenarios'],
        },
      },
    },
  ];

  const prompt = `Create 3 video scenarios (6 seconds each, 9:16 aspect ratio) about "A person discovering AI technology for the first time".
Each scenario should follow AES structure (Attention → Emotion → Solution) and include:
- Strong opening hook
- Emotional progression
- 2-3 scenes with specific visual descriptions
- Camera movements suitable for vertical video`;

  console.log(`📝 Prompt:\n${prompt}\n`);

  try {
    const response = await generateScenariosWithTools(client, prompt, tools, {
      systemMessage: 'You are an expert video scenario creator specializing in viral short-form content.',
      maxTokens: 4096,
      temperature: 0.8,
      toolChoice: 'auto',
    });

    console.log('📊 Response Analysis:');
    console.log(`  - Content: ${response.content ? '✅ Has text' : '❌ No text'}`);
    console.log(`  - Tool Calls: ${response.toolCalls ? `✅ ${response.toolCalls.length} call(s)` : '❌ No tool calls'}`);
    console.log(`  - Usage: ${response.usage ? `${response.usage.total_tokens} tokens` : 'N/A'}\n`);

    if (response.toolCalls) {
      console.log('🔧 Tool Calls Detected:\n');

      for (const toolCall of response.toolCalls) {
        console.log(`  Function: ${toolCall.function.name}`);
        console.log(`  ID: ${toolCall.id}`);
        console.log(`  Arguments (raw):\n${toolCall.function.arguments}\n`);

        if (toolCall.function.argumentsParsed) {
          console.log(`  Arguments (parsed):`);
          const scenarios = toolCall.function.argumentsParsed.scenarios;

          if (Array.isArray(scenarios)) {
            console.log(`\n  📹 Generated ${scenarios.length} Scenarios:\n`);

            scenarios.forEach((scenario: any, index: number) => {
              console.log(`  ${index + 1}. ${scenario.title}`);
              console.log(`     Description: ${scenario.description}`);
              console.log(`     AES Score: ${scenario.aesScore}/100`);
              console.log(`     Hook Strength: ${scenario.hookStrength}/100`);
              console.log(`     Emotional Curve: ${scenario.emotionalCurve?.join(' → ')}`);
              console.log(`     Scenes: ${scenario.scenes?.length || 0}`);

              if (scenario.scenes) {
                scenario.scenes.forEach((scene: any, sceneIndex: number) => {
                  console.log(`       Scene ${sceneIndex + 1}: ${scene.phase} (${scene.duration}s)`);
                  console.log(`         ${scene.description}`);
                });
              }

              console.log('');
            });
          }
        }
      }

      console.log('✅ Function calling successful!\n');
    } else if (response.content) {
      console.log(`📄 Text Response:\n${response.content}\n`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Test 3: Streaming generation
 */
async function testStreamingGeneration() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Streaming Text Generation');
  console.log('='.repeat(80) + '\n');

  const client = createTextClient({ apiKey: API_KEY });

  const prompt = 'Write a short story (3 sentences) about a robot learning to paint.';
  console.log(`📝 Prompt: ${prompt}\n`);
  console.log('📡 Streaming response:\n');

  try {
    const response = await generateScenariosWithToolsStreaming(
      client,
      prompt,
      [], // No tools for streaming test
      {
        maxTokens: 300,
        temperature: 0.9,
      },
      (chunk) => {
        process.stdout.write(chunk);
      }
    );

    console.log('\n\n✅ Streaming complete!');
    console.log(`📊 Total length: ${response.content?.length || 0} characters\n`);
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

/**
 * Test 4: Weather query (classic function calling example)
 */
async function testWeatherQuery() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 4: Classic Function Calling - Weather Query');
  console.log('='.repeat(80) + '\n');

  const client = createTextClient({ apiKey: API_KEY });

  const tools: ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get the current weather in a given location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City and state, e.g., San Francisco, CA',
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
              description: 'Temperature unit',
            },
          },
          required: ['location', 'unit'],
        },
      },
    },
  ];

  const prompt = "What's the weather like in San Francisco? Use celsius.";
  console.log(`📝 Prompt: ${prompt}\n`);

  try {
    const response = await generateScenariosWithTools(client, prompt, tools);

    if (response.toolCalls) {
      console.log('✅ Model wants to call a function:\n');

      for (const toolCall of response.toolCalls) {
        console.log(`  Function: ${toolCall.function.name}`);
        console.log(`  Arguments:`, toolCall.function.argumentsParsed);
        console.log('');

        // Simulate function execution
        const args = toolCall.function.argumentsParsed;
        console.log(`🌤️  Simulated result: Getting weather for ${args?.location} in ${args?.unit}...`);
        console.log(`   Result: 22°C, Partly cloudy\n`);
      }
    } else {
      console.log(`📄 Response: ${response.content}\n`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function main() {
  console.log('\n🚀 MiniMax Text Generation with Function Calling - Test Suite\n');
  console.log(`API Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`);
  console.log(`Model: MiniMax-M2`);
  console.log(`Base URL: https://api.minimax.io/v1`);

  try {
    // Run all tests
    await testSimpleGeneration();
    await testFunctionCalling();
    await testStreamingGeneration();
    await testWeatherQuery();

    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests completed!');
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
main();

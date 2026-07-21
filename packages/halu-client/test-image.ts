/**
 * Test script for HALU image generation functionality
 */

import { createHaluClient } from './src';

async function testImageGeneration() {
  // Create client
  const client = createHaluClient({
    apiKey: process.env.MINIMAX_API_KEY!,
  });

  try {
    console.log('Testing text-to-image generation...');
    
    // Test text-to-image
    const imageResponse = await client.generateImage({
      model: 'image-01',
      prompt: 'A beautiful sunset over the ocean, photorealistic, high quality',
      aspect_ratio: '16:9',
      response_format: 'base64'
    });

    console.log('Image generation response:', imageResponse);
    
    if (imageResponse.data && imageResponse.data.length > 0) {
      console.log('Successfully generated image!');
      console.log('Image data keys:', Object.keys(imageResponse.data[0]));
    } else {
      console.log('No image data returned');
    }
  } catch (error) {
    console.error('Error during image generation test:', error);
  }
}

// Run the test
testImageGeneration().catch(console.error);
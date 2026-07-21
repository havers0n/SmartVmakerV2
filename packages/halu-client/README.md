# @scrimspec/halu-client

TypeScript client for the MiniMax HALU video generation API.

## Features

- **Type-safe**: Full TypeScript support with comprehensive type definitions
- **Two generation modes**: Subject-Reference (S2V-01) and First & Last Frame (MiniMax-Hailuo-02)
- **Image generation**: Text-to-Image and Image-to-Image capabilities
- **Webhook support**: Built-in challenge handling and status updates
- **Polling utilities**: Easy task polling with progress callbacks
- **File retrieval**: Download generated videos directly

## Installation

```bash
pnpm add @scrimspec/halu-client
```

## Usage

### Basic Setup

```typescript
import { createHaluClient } from '@scrimspec/halu-client';

const client = createHaluClient({
  apiKey: process.env.MINIMAX_API_KEY!
});
```

### First & Last Frame Video Generation

```typescript
// Create a task
const task = await client.createFirstLastFrameTask({
  model: 'MiniMax-Hailuo-02',
  prompt: 'A little girl grows up. [Push in],[Pan right]',
  first_frame_image: 'https://example.com/first.jpg',
  last_frame_image: 'https://example.com/last.jpg',
  duration: 6,
  resolution: '768P',
  prompt_optimizer: true,
  callback_url: 'https://your.domain.com/webhook'
});

console.log('Task ID:', task.task_id);

// Poll for completion
const result = await client.pollTask(task.task_id, {
  intervalMs: 5000,
  maxAttempts: 60,
  onProgress: (status) => {
    console.log('Status:', status.status);
  }
});

if (result.status === 'success') {
  // Download the video
  const videoBuffer = await client.downloadVideo(result.file_id!);
  // Save to file, upload to storage, etc.
}
```

### Text-to-Image Generation

```typescript
// Generate image from text
const imageResponse = await client.generateImage({
  model: 'image-01',
  prompt: 'A beautiful sunset over the ocean, photorealistic, high quality',
  aspect_ratio: '16:9',
  response_format: 'base64'
});

// Save the image
const imageData = imageResponse.data[0].image_base64;
const imageBuffer = Buffer.from(imageData, 'base64');
fs.writeFileSync('sunset.png', imageBuffer);
```

### Image-to-Image Modification

```typescript
// Modify an existing image
const modifiedImageResponse = await client.modifyImage({
  model: 'image-01',
  prompt: 'Make the sky more blue and add dramatic clouds',
  image: 'https://example.com/source-image.jpg',
  aspect_ratio: '16:9',
  response_format: 'url'
});

// Get the modified image URL
const modifiedImageUrl = modifiedImageResponse.data[0].url;
```

### Subject-Reference Video Generation

```typescript
const task = await client.createSubjectReferenceTask({
  model: 'S2V-01',
  prompt: 'A girl runs toward the camera and winks with a smile.',
  prompt_optimizer: true,
  subject_reference: [{
    type: 'character',
    image: ['https://example.com/character.jpg']
  }],
  callback_url: 'https://your.domain.com/webhook'
});
```

### Webhook Handling

```typescript
import { HaluClient } from '@scrimspec/halu-client';

app.post('/webhook', async (req, res) => {
  const payload = req.body;

  // Handle challenge validation
  if ('challenge' in payload) {
    const response = HaluClient.handleWebhookChallenge(payload.challenge);
    return res.json(response);
  }

  // Handle status updates
  if (payload.status === 'success') {
    const videoBuffer = await client.downloadVideo(payload.file_id);
    // Process the video...
  } else if (payload.status === 'failed') {
    console.error('Generation failed for task:', payload.task_id);
  }

  res.json({ status: 'ok' });
});
```

### Camera Commands

The MiniMax-Hailuo-02 model supports camera movement commands in the prompt:

```typescript
const task = await client.createFirstLastFrameTask({
  model: 'MiniMax-Hailuo-02',
  prompt: 'A dramatic scene. [Push in,Tilt up], then [Pull out,Pan left]',
  // ... other params
});
```

Available camera movements:
- Truck left/right, Pan left/right
- Push in, Pull out
- Pedestal up/down, Tilt up/down
- Zoom in/out
- Shake, Tracking shot, Static shot

## API Reference

### `createHaluClient(config)`

Create a new HALU client instance.

**Parameters:**
- `config.apiKey` (required): Your MiniMax API key
- `config.baseUrl` (optional): Custom API base URL (default: 'https://api.minimax.io/v1')

### `client.generateImage(payload)`

Generate image from text description.

**Parameters:**
- `payload.model`: Must be `'image-01'`
- `payload.prompt` (required): Detailed text description
- `payload.aspect_ratio` (optional): Image aspect ratio (default: '16:9')
- `payload.response_format` (optional): 'url' or 'base64' (default: 'url')
- `payload.prompt_optimizer` (optional): Auto-optimize prompt (default: true)

**Returns:** Image generation response with image data

### `client.modifyImage(payload)`

Modify an existing image based on text instructions.

**Parameters:**
- `payload.model`: Must be `'image-01'`
- `payload.prompt` (required): Modification instructions
- `payload.image` (required): Source image URL or Data URL
- `payload.aspect_ratio` (optional): Image aspect ratio (default: '16:9')
- `payload.response_format` (optional): 'url' or 'base64' (default: 'url')
- `payload.prompt_optimizer` (optional): Auto-optimize prompt (default: true)

**Returns:** Image generation response with image data

### `client.createFirstLastFrameTask(payload)`

Create a First & Last Frame video generation task.

**Parameters:**
- `payload.model`: Must be `'MiniMax-Hailuo-02'`
- `payload.first_frame_image` (optional): First frame URL or Data URL
- `payload.last_frame_image` (required): Last frame URL or Data URL
- `payload.prompt` (optional): Text prompt with optional camera commands
- `payload.duration` (optional): 6 or 10 seconds (default: 6)
- `payload.resolution` (optional): '768P' or '1080P' (default: '768P')
- `payload.prompt_optimizer` (optional): Auto-optimize prompt (default: true)
- `payload.callback_url` (optional): Webhook URL for status updates

**Returns:** `{ task_id, base_resp }`

### `client.queryTask(taskId)`

Query the status of a video generation task.

**Returns:** Task status object with `status`, `file_id`, and `base_resp`

### `client.retrieveFile(fileId)`

Get file information and download URL for a file_id.

**Returns:** File metadata including `download_url`

### `client.downloadVideo(fileIdOrUrl)`

Download a video file as a Buffer.

**Parameters:**
- `fileIdOrUrl`: Either a file_id or a direct video URL

**Returns:** `Buffer` containing the video file

### `client.pollTask(taskId, options)`

Poll a task until completion.
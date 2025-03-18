export function isRenderEnvironment(): boolean {
  // Check if the RENDER environment variable is set (Render sets this automatically)
  return process.env.RENDER === 'true';
}

/**
 * Request body parsing with size limits.
 */

const DEFAULT_MAX_SIZE = 64 * 1024; // 64KB

/**
 * Parse a JSON request body with size limit enforcement.
 * Returns the parsed body on success, or a 413/400 Response on failure.
 */
export async function parseJsonBody(
  request: Request,
  maxSize: number = DEFAULT_MAX_SIZE
): Promise<{ data: unknown } | { error: Response }> {
  // Check Content-Length header if present
  const contentLength = request.headers.get("Content-Length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > maxSize) {
      return {
        error: Response.json(
          { error: `Request body too large (max ${maxSize} bytes)` },
          { status: 413 }
        ),
      };
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      error: Response.json({ error: "Failed to read request body" }, { status: 400 }),
    };
  }

  if (text.length > maxSize) {
    return {
      error: Response.json(
        { error: `Request body too large (max ${maxSize} bytes)` },
        { status: 413 }
      ),
    };
  }

  try {
    return { data: JSON.parse(text) };
  } catch {
    return {
      error: Response.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }
}

// Cancellation plumbing for the video-import pipeline.
//
// Bull's job `timeout` marks a job failed but does NOT stop the work already in
// flight: the ffmpeg child, the download and the Ollama request all keep going
// and accumulate as zombies across a multi-day bulk run. So every blocking call
// in the pipeline takes an AbortSignal, and each composes the job-scoped signal
// with its own shorter deadline — that way the logs name the stage that hung
// instead of only reporting that the job timed out.

// Compose the caller's (job-scoped) signal with this operation's own deadline.
// Either one firing aborts the operation.
export function withDeadline(
  timeoutMs: number,
  signal?: AbortSignal,
): AbortSignal {
  const deadline = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, deadline]) : deadline;
}

// True when an error came from cancellation or from a deadline killing a child
// process, rather than from the operation genuinely failing. Degraded-path
// fallbacks MUST rethrow these: retrying after a timeout spends the budget a
// second time, and carrying on after a cancellation defeats the cancellation.
export function isAbortError(err: unknown): boolean {
  const e = err as { name?: string; code?: string; killed?: boolean };
  return (
    // fetch/pipeline aborted, or execFile's signal fired
    e?.name === 'AbortError' ||
    // AbortSignal.timeout() rejects with a TimeoutError DOMException
    e?.name === 'TimeoutError' ||
    e?.code === 'ABORT_ERR' ||
    // execFile's own `timeout` option killed the child
    e?.killed === true
  );
}

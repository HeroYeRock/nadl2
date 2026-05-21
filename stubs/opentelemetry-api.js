// Supabase JS 가 가져오는 @opentelemetry/api 의 stub.
// Hermes 가 dynamic import() 를 컴파일 못 해서 비활성화 목적.
// RN 환경에서는 OpenTelemetry trace/metric 이 어차피 의미 없음.

const noop = () => {};
const noopSpan = {
  end: noop,
  setStatus: noop,
  setAttribute: noop,
  setAttributes: noop,
  recordException: noop,
  addEvent: noop,
  spanContext: () => ({ traceId: "", spanId: "", traceFlags: 0 }),
  isRecording: () => false,
  updateName: noop,
};

const noopTracer = {
  startSpan: () => noopSpan,
  startActiveSpan: (name, optionsOrFn, ctxOrFn, fn) => {
    const cb = typeof optionsOrFn === "function" ? optionsOrFn :
               typeof ctxOrFn === "function" ? ctxOrFn :
               typeof fn === "function" ? fn : null;
    return cb ? cb(noopSpan) : undefined;
  },
};

const trace = {
  getTracer: () => noopTracer,
  getActiveSpan: () => noopSpan,
  setSpan: (ctx) => ctx,
  getSpan: () => noopSpan,
  deleteSpan: (ctx) => ctx,
  setSpanContext: (ctx) => ctx,
  wrapSpanContext: () => noopSpan,
};

const context = {
  active: () => ({}),
  with: (ctx, fn) => fn(),
  bind: (ctx, target) => target,
  setValue: (ctx) => ctx,
  getValue: () => undefined,
  deleteValue: (ctx) => ctx,
};

const propagation = {
  inject: noop,
  extract: () => ({}),
  fields: () => [],
};

module.exports = {
  trace,
  context,
  propagation,
  SpanStatusCode: { UNSET: 0, OK: 1, ERROR: 2 },
  SpanKind: { INTERNAL: 0, SERVER: 1, CLIENT: 2, PRODUCER: 3, CONSUMER: 4 },
  default: { trace, context, propagation },
};

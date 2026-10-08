# Unity Lifecycle

Use this guidance for runtime components, scene objects, pooled objects, and
systems that subscribe to events or run asynchronous work.

## Inspect first

Determine which lifecycle methods the related system already uses:

- `Awake`
- `OnEnable`
- `Start`
- `Update`
- `FixedUpdate`
- `LateUpdate`
- `OnDisable`
- `OnDestroy`
- scene load and unload callbacks
- application pause and quit
- custom initialization interfaces
- DI container startup
- network spawn and despawn callbacks

## Initialization

Do not assume `Start` runs before another component accesses the object.

Prefer explicit initialization when order matters.

Ensure initialization is:

- idempotent when repeated calls are possible
- safe under disabled GameObjects
- clear about required dependencies
- compatible with scene reloads
- compatible with domain reload settings

## Enable and disable

Subscriptions created in `OnEnable` should normally be removed in `OnDisable`.

Do not register listeners repeatedly without removing them.

Decide whether disabled objects should:

- retain state
- reset state
- pause timers
- cancel asynchronous work
- stop receiving events

## Destruction and cleanup

Ensure:

- events are unsubscribed
- coroutines are stopped when needed
- cancellation tokens are cancelled
- temporary objects are released
- pooled objects reset reusable state
- network callbacks are removed
- external handles are disposed

## Update loops

Use:

- `Update` for frame-based input and presentation
- `FixedUpdate` for physics steps
- `LateUpdate` for follow-up presentation or camera work

Avoid:

- frame-dependent movement
- expensive hierarchy searches
- repeated allocations
- unrelated systems inside one lifecycle method

Keep execution order understandable.

## Time

Choose the correct time source:

- `Time.deltaTime`
- `Time.fixedDeltaTime`
- `Time.unscaledDeltaTime`
- network simulation time
- custom clocks

Consider pause, slow motion, deterministic simulation, and replay requirements.

## Coroutines and async

Follow the project's established async model.

Handle:

- cancellation
- destroyed owners
- scene unloading
- exceptions
- duplicate starts
- completion callbacks
- pooled reuse

Do not mix coroutines, `Task`, and UniTask without a clear need.

## Domain reload

If domain reload is disabled, static state may survive entering Play Mode.

Reset or initialize static state explicitly when relevant.

## Script execution order

Do not modify Script Execution Order to solve an architectural problem unless
there is a clear documented need.

Prefer explicit composition and initialization.

## Runtime checklist

- Is initialization order explicit?
- Are subscriptions balanced?
- Does disable behavior make sense?
- Does destruction clean up correctly?
- Does the system survive scene reload?
- Does pooled reuse reset state?
- Is the selected time source correct?
- Are async operations cancelled safely?
